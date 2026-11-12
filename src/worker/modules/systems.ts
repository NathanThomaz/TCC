import { z } from "zod";
import type { IssueDto, SystemDto, VersionDto } from "../../shared/api";
import { CATALOG_VERSION } from "../../shared/contract/catalog";
import { SCHEMA_VERSION, type ConfigDraft } from "../../shared/contract/schema";
import { validateDraft } from "../../shared/contract/validate";
import { authenticate, requireAdmin, requireSystemAccess } from "../auth/session";
import { readJson } from "../http/body";
import { beginIdempotent, recordStatement, replayAfterRace } from "../http/idempotency";
import { AppError, conflict, notFound } from "../http/errors";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import { canonicalJson, sha256Hex } from "../lib/hash";
import { isUnique, parse, triggerConflict } from "./comum";

// Sistemas e o ciclo de configuração (seção 8): rascunho → versão validada → aprovação da versão
// exata (hash) → ativação. Invariantes críticos também estão no D1 (migrations 0001 e 0002).

interface SystemRow {
  id: string;
  owner_id: string;
  name: string;
  status: "draft" | "active" | "archived";
  active_version_id: string | null;
  created_at: number;
  updated_at: number;
}

interface VersionRow {
  id: string;
  system_id: string;
  version: number;
  hash: string;
  origin: VersionDto["origem"];
  status: VersionDto["status"];
  config_json: string;
  created_at: number;
}

const CreateSystemBody = z.object({ nome: z.string().trim().min(1).max(80) });
const CreateVersionBody = z.object({
  origem: z.enum(["formulario", "chat"]),
  rascunho: z.unknown(),
});
const ApproveBody = z.object({ hash: z.string().regex(/^[0-9a-f]{64}$/) });
const ActivateBody = z.object({ versao: z.string().min(1).max(100) });

function publicSystem(row: SystemRow): SystemDto {
  return {
    id: row.id,
    nome: row.name,
    status: row.status,
    versaoAtiva: row.active_version_id,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  };
}

function publicVersion(row: VersionRow): VersionDto {
  return {
    id: row.id,
    versao: row.version,
    hash: row.hash,
    origem: row.origin,
    status: row.status,
    criadoEm: row.created_at,
  };
}

async function loadSystem(ctx: RequestContext, systemId: string): Promise<SystemRow> {
  const row = await ctx.env.DB.prepare("SELECT * FROM systems WHERE id = ?")
    .bind(systemId)
    .first<SystemRow>();
  if (!row) throw notFound();
  return row;
}

export const createSystem: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  requireAdmin(user);
  const body = parse(CreateSystemBody, await readJson(ctx.request));
  const cmd = { scope: "global", actorId: user.id, command: "system.create", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    return json(
      { sistema: publicSystem(await loadSystem(ctx, started.resourceId)) },
      { status: started.statusCode },
    );
  }
  const now = ctx.clock.now();
  const id = crypto.randomUUID();
  const db = ctx.env.DB;
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO systems (id, owner_id, name, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?)",
        )
        .bind(id, user.id, body.nome, now, now),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'system.created', 'system', ?, ?)",
        )
        .bind(id, user.id, id, now),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind !== "replay") throw error;
    return json(
      { sistema: publicSystem(await loadSystem(ctx, replay.resourceId)) },
      { status: replay.statusCode },
    );
  }
  return json({ sistema: publicSystem(await loadSystem(ctx, id)) }, { status: 201 });
};

export const listSystems: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  const db = ctx.env.DB;
  const { results } =
    user.role === "admin"
      ? await db
          .prepare("SELECT * FROM systems WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100")
          .bind(user.id)
          .all<SystemRow>()
      : await db
          .prepare(
            `SELECT s.* FROM systems s JOIN system_access a ON a.system_id = s.id
             WHERE a.user_id = ? AND a.status = 'active' AND s.owner_id = ? AND s.status <> 'archived'
             ORDER BY s.created_at DESC LIMIT 100`,
          )
          .bind(user.id, user.adminId)
          .all<SystemRow>();
  return json({ sistemas: results.map(publicSystem) });
};

export const getSystem: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  const systemId = ctx.params.systemId ?? "";
  await requireSystemAccess(ctx.env.DB, user, systemId);
  const system = await loadSystem(ctx, systemId);
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM model_versions WHERE system_id = ? ORDER BY version DESC LIMIT 20",
  )
    .bind(systemId)
    .all<VersionRow>();
  const ultima = results[0];
  return json({
    sistema: publicSystem(system),
    // Histórico e configuração são do administrador; o secundário só opera o sistema.
    versoes: user.role === "admin" ? results.map(publicVersion) : [],
    ultimaConfig:
      user.role === "admin" && ultima ? (JSON.parse(ultima.config_json) as unknown) : null,
  });
};

/** Grava uma nova versão a partir do rascunho (formulário ou chat), com o diagnóstico. */
export const createVersion: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  requireAdmin(user);
  const systemId = ctx.params.systemId ?? "";
  const system = await requireSystemAccess(ctx.env.DB, user, systemId);
  const body = parse(CreateVersionBody, await readJson(ctx.request));
  // Repetição consultada antes dos bloqueios de estado: uma operação já feita devolve a mesma
  // resposta mesmo que o sistema tenha sido ativado depois.
  const cmd = { scope: systemId, actorId: user.id, command: "version.create", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    return versionResponse(ctx, started.resourceId, started.statusCode);
  }
  if (system.status === "archived") throw conflict("Sistema arquivado não recebe novas versões.");
  if (system.status === "active") {
    // Personalização após ativação é P2 (ADR-002): bloqueada até existir com as regras da seção 9.
    throw new AppError(
      409,
      "personalizacao_pos_ativacao_indisponivel",
      "Alterar a configuração de um sistema ativo ainda não está disponível nesta versão.",
    );
  }
  const result = validateDraft(body.rascunho);
  if (!result.draft) {
    // Estrutura inválida não vira versão: devolve o diagnóstico para correção.
    return json({ versao: null, issues: result.issues }, { status: 422 });
  }

  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    await db.batch([
      ...(await versaoStatements(ctx, {
        id,
        systemId,
        userId: user.id,
        origem: body.origem,
        draft: result.draft,
        issues: result.issues,
        now,
      })),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    if (!isUnique(error)) throw error;
    const replay = await replayAfterRace(ctx, cmd, started);
    if (replay?.kind === "replay")
      return versionResponse(ctx, replay.resourceId, replay.statusCode);
    // Duas gravações diferentes disputando o mesmo número de versão.
    throw conflict("Outra versão foi gravada ao mesmo tempo. Tente de novo.");
  }
  return versionResponse(ctx, id, 201);
};

/**
 * Instruções que gravam uma versão já validada estruturalmente (formulário ou chat passam pelo
 * mesmo caminho, T33): JSON canônico, hash, status pelo diagnóstico e auditoria.
 */
export async function versaoStatements(
  ctx: Pick<RequestContext, "env">,
  v: {
    id: string;
    systemId: string;
    userId: string;
    origem: VersionDto["origem"];
    draft: ConfigDraft;
    issues: IssueDto[];
    now: number;
  },
): Promise<D1PreparedStatement[]> {
  const db = ctx.env.DB;
  const configJson = canonicalJson(v.draft);
  const hash = await sha256Hex(configJson);
  const blocking = v.issues.filter((issue) => issue.severity === "bloqueante").length;
  return [
    db
      .prepare(
        `INSERT INTO model_versions
           (id, system_id, version, schema_version, catalog_version, config_json, hash, origin, status, created_by, created_at)
         SELECT ?, ?, COALESCE(MAX(version), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?
         FROM model_versions WHERE system_id = ?`,
      )
      .bind(
        v.id,
        v.systemId,
        SCHEMA_VERSION,
        CATALOG_VERSION,
        configJson,
        hash,
        v.origem,
        blocking === 0 ? "valid" : "invalid",
        v.userId,
        v.now,
        v.systemId,
      ),
    db
      .prepare(
        "INSERT INTO validation_runs (id, model_version_id, blocking_count, issues_json, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(crypto.randomUUID(), v.id, blocking, JSON.stringify(v.issues), v.now),
    db
      .prepare(
        "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'version.created', 'model_version', ?, ?)",
      )
      .bind(v.systemId, v.userId, v.id, v.now),
  ];
}

/** Versão + o diagnóstico guardado na última validação dela. */
export async function versionResponse(
  ctx: RequestContext,
  versionId: string,
  status: number,
): Promise<Response> {
  const db = ctx.env.DB;
  const row = await db
    .prepare("SELECT * FROM model_versions WHERE id = ?")
    .bind(versionId)
    .first<VersionRow>();
  if (!row) throw notFound();
  const run = await db
    .prepare(
      "SELECT issues_json FROM validation_runs WHERE model_version_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(versionId)
    .first<{ issues_json: string }>();
  const issues = run ? (JSON.parse(run.issues_json) as IssueDto[]) : [];
  return json({ versao: publicVersion(row), issues }, { status });
}

/** Aprova a versão exata: o hash enviado tem de ser o da versão, e ela não pode ter bloqueios. */
export const approveVersion: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  requireAdmin(user);
  const systemId = ctx.params.systemId ?? "";
  const versionId = ctx.params.versionId ?? "";
  await requireSystemAccess(ctx.env.DB, user, systemId);
  const { hash } = parse(ApproveBody, await readJson(ctx.request));
  const now = ctx.clock.now();
  const db = ctx.env.DB;

  const current = await db
    .prepare("SELECT * FROM model_versions WHERE id = ? AND system_id = ?")
    .bind(versionId, systemId)
    .first<VersionRow>();
  if (!current) throw notFound();
  if (current.status === "approved" && current.hash === hash) {
    return json({ versao: publicVersion(current) }); // repetição idempotente
  }

  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO approvals (id, system_id, model_version_id, hash, actor_id, decision, created_at) VALUES (?, ?, ?, ?, ?, 'approved', ?)",
        )
        .bind(crypto.randomUUID(), systemId, versionId, hash, user.id, now),
      db
        .prepare("UPDATE model_versions SET status = 'approved' WHERE id = ? AND status = 'valid'")
        .bind(versionId),
      // changes() = linhas da instrução anterior do mesmo batch: só audita transição efetiva.
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at) SELECT ?, ?, 'version.approved', 'model_version', ?, json_object('hash', ?), ? WHERE changes() = 1",
        )
        .bind(systemId, user.id, versionId, hash, now),
    ]);
  } catch (error) {
    // Aprovação idêntica concorrente: se a outra venceu com o mesmo hash, é repetição.
    const after = await db
      .prepare("SELECT * FROM model_versions WHERE id = ? AND system_id = ?")
      .bind(versionId, systemId)
      .first<VersionRow>();
    if (after?.status === "approved" && after.hash === hash) {
      return json({ versao: publicVersion(after) });
    }
    triggerConflict(error, {
      aprovacao_invalida:
        "A aprovação não corresponde à versão: o conteúdo mudou ou há erro bloqueante.",
    });
  }
  const row = await db
    .prepare("SELECT * FROM model_versions WHERE id = ?")
    .bind(versionId)
    .first<VersionRow>();
  if (!row) throw notFound();
  return json({ versao: publicVersion(row) });
};

/** Ativa a versão aprovada; repetir a mesma ativação não duplica efeitos (T10). */
export const activateSystem: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  requireAdmin(user);
  const systemId = ctx.params.systemId ?? "";
  const system = await requireSystemAccess(ctx.env.DB, user, systemId);
  const { versao } = parse(ActivateBody, await readJson(ctx.request));
  const row = await loadSystem(ctx, systemId);

  if (row.status === "active" && row.active_version_id === versao) {
    return json({ sistema: publicSystem(row) });
  }
  if (system.status !== "draft") {
    throw conflict("Só um sistema em rascunho pode ser ativado nesta versão do Nexus.");
  }

  const now = ctx.clock.now();
  const db = ctx.env.DB;
  let changed = 0;
  try {
    const [update] = await db.batch([
      db
        .prepare(
          "UPDATE systems SET active_version_id = ?, status = 'active', updated_at = ? WHERE id = ? AND status = 'draft'",
        )
        .bind(versao, now, systemId),
      // Só audita se o UPDATE anterior do mesmo batch ativou de fato.
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) SELECT ?, ?, 'system.activated', 'model_version', ?, ? WHERE changes() = 1",
        )
        .bind(systemId, user.id, versao, now),
    ]);
    changed = update?.meta.changes ?? 0;
  } catch (error) {
    triggerConflict(error, {
      versao_nao_aprovada: "Só uma versão aprovada deste sistema pode ser ativada.",
    });
  }
  const after = await loadSystem(ctx, systemId);
  if (changed === 0 && !(after.status === "active" && after.active_version_id === versao)) {
    // Outra ativação concorrente venceu com outra versão: nada foi ativado por esta requisição.
    throw conflict("O sistema já foi ativado com outra versão.");
  }
  return json({ sistema: publicSystem(after) });
};
