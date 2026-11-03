import { z } from "zod";
import type { SystemDto, VersionDto } from "../../shared/api";
import { CATALOG_VERSION } from "../../shared/contract/catalog";
import { SCHEMA_VERSION } from "../../shared/contract/schema";
import { validateDraft } from "../../shared/contract/validate";
import { authenticate, requireAdmin, requireSystemAccess } from "../auth/session";
import { readJson } from "../http/body";
import { AppError, conflict, notFound, validationFailed } from "../http/errors";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import { canonicalJson, sha256Hex } from "../lib/hash";

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

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw validationFailed("Campos inválidos.", { issues: result.error.issues.length });
  }
  return result.data;
}

/** Converte a recusa de um trigger do D1 em conflito com mensagem clara. */
function triggerConflict(error: unknown, messages: Record<string, string>): never {
  const text = error instanceof Error ? error.message : String(error);
  for (const [code, message] of Object.entries(messages)) {
    if (text.includes(code)) throw new AppError(409, code, message);
  }
  throw error;
}

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
  const user = await authenticate(ctx, ctx.verifyToken);
  requireAdmin(user);
  const { nome } = parse(CreateSystemBody, await readJson(ctx.request));
  const now = ctx.clock.now();
  const id = crypto.randomUUID();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      "INSERT INTO systems (id, owner_id, name, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?)",
    ).bind(id, user.id, nome, now, now),
    ctx.env.DB.prepare(
      "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'system.created', 'system', ?, ?)",
    ).bind(id, user.id, id, now),
  ]);
  return json({ sistema: publicSystem(await loadSystem(ctx, id)) }, { status: 201 });
};

export const listSystems: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.verifyToken);
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
  const user = await authenticate(ctx, ctx.verifyToken);
  const systemId = ctx.params.systemId ?? "";
  await requireSystemAccess(ctx.env.DB, user, systemId);
  const system = await loadSystem(ctx, systemId);
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM model_versions WHERE system_id = ? ORDER BY version DESC LIMIT 20",
  )
    .bind(systemId)
    .all<VersionRow>();
  return json({
    sistema: publicSystem(system),
    // Histórico de versões é da configuração: só o administrador vê.
    versoes: user.role === "admin" ? results.map(publicVersion) : [],
  });
};

/** Grava uma nova versão a partir do rascunho (formulário ou chat), com o diagnóstico. */
export const createVersion: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.verifyToken);
  requireAdmin(user);
  const systemId = ctx.params.systemId ?? "";
  const system = await requireSystemAccess(ctx.env.DB, user, systemId);
  if (system.status === "archived") throw conflict("Sistema arquivado não recebe novas versões.");
  if (system.status === "active") {
    // Personalização após ativação é P2 (ADR-002): bloqueada até existir com as regras da seção 9.
    throw new AppError(
      409,
      "personalizacao_pos_ativacao_indisponivel",
      "Alterar a configuração de um sistema ativo ainda não está disponível nesta versão.",
    );
  }
  const body = parse(CreateVersionBody, await readJson(ctx.request));
  const result = validateDraft(body.rascunho);
  if (!result.draft) {
    // Estrutura inválida não vira versão: devolve o diagnóstico para correção.
    return json({ versao: null, issues: result.issues }, { status: 422 });
  }

  const configJson = canonicalJson(result.draft);
  const hash = await sha256Hex(configJson);
  const blocking = result.issues.filter((issue) => issue.severity === "bloqueante").length;
  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO model_versions
             (id, system_id, version, schema_version, catalog_version, config_json, hash, origin, status, created_by, created_at)
           SELECT ?, ?, COALESCE(MAX(version), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?
           FROM model_versions WHERE system_id = ?`,
        )
        .bind(
          id,
          systemId,
          SCHEMA_VERSION,
          CATALOG_VERSION,
          configJson,
          hash,
          body.origem,
          blocking === 0 ? "valid" : "invalid",
          user.id,
          now,
          systemId,
        ),
      db
        .prepare(
          "INSERT INTO validation_runs (id, model_version_id, blocking_count, issues_json, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(crypto.randomUUID(), id, blocking, JSON.stringify(result.issues), now),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'version.created', 'model_version', ?, ?)",
        )
        .bind(systemId, user.id, id, now),
    ]);
  } catch (error) {
    // Duas gravações simultâneas disputando o mesmo número de versão.
    if (error instanceof Error && /UNIQUE/i.test(error.message)) {
      throw conflict("Outra versão foi gravada ao mesmo tempo. Tente de novo.");
    }
    throw error;
  }

  const row = await db
    .prepare("SELECT * FROM model_versions WHERE id = ?")
    .bind(id)
    .first<VersionRow>();
  if (!row) throw new Error("versão gravada não encontrada");
  return json({ versao: publicVersion(row), issues: result.issues }, { status: 201 });
};

/** Aprova a versão exata: o hash enviado tem de ser o da versão, e ela não pode ter bloqueios. */
export const approveVersion: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.verifyToken);
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
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, 'version.approved', 'model_version', ?, json_object('hash', ?), ?)",
        )
        .bind(systemId, user.id, versionId, hash, now),
    ]);
  } catch (error) {
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
  const user = await authenticate(ctx, ctx.verifyToken);
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
  try {
    await db.batch([
      db
        .prepare(
          "UPDATE systems SET active_version_id = ?, status = 'active', updated_at = ? WHERE id = ? AND status = 'draft'",
        )
        .bind(versao, now, systemId),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'system.activated', 'model_version', ?, ?)",
        )
        .bind(systemId, user.id, versao, now),
    ]);
  } catch (error) {
    triggerConflict(error, {
      versao_nao_aprovada: "Só uma versão aprovada deste sistema pode ser ativada.",
    });
  }
  return json({ sistema: publicSystem(await loadSystem(ctx, systemId)) });
};
