import { z } from "zod";
import type {
  InicioDto,
  IssueDto,
  ResumoSistemaDto,
  SystemDto,
  VersionDto,
} from "../../shared/api";
import { CATALOG_VERSION } from "../../shared/contract/catalog";
import { deCampoLocal, paraCampoLocal } from "../../shared/dominio/agenda";
import { SCHEMA_VERSION, type ConfigDraft } from "../../shared/contract/schema";
import { compatibilidadeComAtiva, validateDraft } from "../../shared/contract/validate";
import { authenticate, requireAdmin, requireSystemAccess } from "../auth/session";
import { readJson } from "../http/body";
import { beginIdempotent, recordStatement, replayAfterRace } from "../http/idempotency";
import { AppError, conflict, notFound } from "../http/errors";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import { consumoDoMes } from "../ia/orcamento";
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
  /** Última versão que a tela viu: se outra foi gravada depois, a nova é recusada. */
  base: z.string().min(1).max(100).optional(),
});
const ApproveBody = z.object({ hash: z.string().regex(/^[0-9a-f]{64}$/) });
const ActivateBody = z.object({
  versao: z.string().min(1).max(100),
  /** Sistema ativo (ADR-008): versão ativa que a edição partiu; outra troca no meio recusa. */
  base: z.string().min(1).max(100).optional(),
});

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

/** Sistemas que o usuário vê: os do administrador; os liberados para a conta secundária. */
async function sistemasDoUsuario(
  ctx: RequestContext,
  user: Awaited<ReturnType<typeof authenticate>>,
) {
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
  return results;
}

export const listSystems: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  return json({ sistemas: (await sistemasDoUsuario(ctx, user)).map(publicSystem) });
};

const LIMITE_INICIO = 100;

/**
 * GET /inicio — resumo da tela inicial: cada sistema com modelo, módulos, cor, última atividade e,
 * se ativo, os números principais. As consultas são agrupadas por sistema e vão num único lote:
 * a quantidade não cresce com o número de sistemas (limite de consultas por requisição do D1).
 * Pedidos ao desenvolvedor e consumo da IA são só do administrador.
 */
export const obterInicio: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  const db = ctx.env.DB;
  const agora = ctx.clock.now();
  const admin = user.role === "admin";
  // Ativos primeiro, para os números de hoje não sumirem atrás de rascunhos recentes.
  const { results: linhas } = admin
    ? await db
        .prepare(
          `SELECT * FROM systems WHERE owner_id = ?
           ORDER BY status = 'active' DESC, created_at DESC LIMIT ${LIMITE_INICIO + 1}`,
        )
        .bind(user.id)
        .all<SystemRow>()
    : await db
        .prepare(
          `SELECT s.* FROM systems s JOIN system_access a ON a.system_id = s.id
           WHERE a.user_id = ? AND a.status = 'active' AND s.owner_id = ? AND s.status <> 'archived'
           ORDER BY s.status = 'active' DESC, s.created_at DESC LIMIT ${LIMITE_INICIO + 1}`,
        )
        .bind(user.id, user.adminId)
        .all<SystemRow>();
  const truncado = linhas.length > LIMITE_INICIO;
  const sistemas = linhas.slice(0, LIMITE_INICIO);
  const ids = JSON.stringify(sistemas.map((s) => s.id));

  const configs = await db
    .prepare(
      `SELECT s.id, COALESCE(
         (SELECT config_json FROM model_versions WHERE id = s.active_version_id),
         (SELECT config_json FROM model_versions WHERE system_id = s.id ORDER BY version DESC LIMIT 1)
       ) AS config_json,
       max(s.updated_at,
         COALESCE((SELECT MAX(created_at) FROM model_versions WHERE system_id = s.id), 0),
         COALESCE((SELECT MAX(m.created_at) FROM messages m JOIN conversations c ON c.id = m.conversation_id
                   WHERE c.system_id = s.id AND c.kind = 'criacao'), 0)) AS atividade
       FROM systems s WHERE s.id IN (SELECT value FROM json_each(?))`,
    )
    .bind(ids)
    .all<{ id: string; config_json: string | null; atividade: number }>();
  const configDe = new Map(
    configs.results.map((c) => [
      c.id,
      {
        config: c.config_json ? (JSON.parse(c.config_json) as ConfigDraft) : null,
        atividade: c.atividade,
      },
    ]),
  );
  const ativos = sistemas.filter((s) => s.status === "active" && configDe.get(s.id)?.config);
  const tem = (s: SystemRow, m: string) =>
    configDe.get(s.id)?.config?.modulos.includes(m as never) ?? false;
  const idsCom = (m: string) => JSON.stringify(ativos.filter((s) => tem(s, m)).map((s) => s.id));
  // Estoque mínimo de cada sistema (regra estoque_minimo), para contar os críticos no SQL.
  const minimoDe: Record<string, number | null> = Object.fromEntries(
    ativos.map((s) => {
      const regra = configDe
        .get(s.id)
        ?.config?.regras.find((r) => (r.tipo as string) === "estoque_minimo") as
        { unidades: number } | undefined;
      return [s.id, regra?.unidades ?? null];
    }),
  );
  const minimos = JSON.stringify(minimoDe);
  const hoje = paraCampoLocal(agora).slice(0, 10);
  const [ano, mes] = hoje.split("-").map(Number) as [number, number];
  const iso = (a: number, m: number, d: number) =>
    new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10);
  const dia = Number(hoje.slice(8, 10));
  const inicioHoje = deCampoLocal(`${hoje}T00:00`)!;
  const inicioAmanha = deCampoLocal(`${iso(ano, mes, dia + 1)}T00:00`)!;
  const inicioMes = deCampoLocal(`${iso(ano, mes, 1)}T00:00`)!;
  const inicioProximoMes = deCampoLocal(`${iso(ano, mes + 1, 1)}T00:00`)!;

  const [vendas, clientes, estoque, agenda, contas, pedidos] = await db.batch([
    db
      .prepare(
        `SELECT system_id AS id,
           SUM(completed_at >= ?2 AND completed_at < ?3) AS hq,
           COALESCE(SUM(CASE WHEN completed_at >= ?2 AND completed_at < ?3 THEN total_cents END), 0) AS ht,
           SUM(completed_at >= ?4 AND completed_at < ?5) AS mq,
           COALESCE(SUM(CASE WHEN completed_at >= ?4 AND completed_at < ?5 THEN total_cents END), 0) AS mt
         FROM sales WHERE status = 'completed' AND system_id IN (SELECT value FROM json_each(?1))
         GROUP BY system_id`,
      )
      .bind(idsCom("vendas"), inicioHoje, inicioAmanha, inicioMes, inicioProximoMes),
    db
      .prepare(
        `SELECT system_id AS id, COUNT(*) AS n FROM customers
         WHERE status = 'active' AND system_id IN (SELECT value FROM json_each(?)) GROUP BY system_id`,
      )
      .bind(idsCom("clientes")),
    db
      .prepare(
        `WITH m AS (SELECT key AS system_id, value AS minimo FROM json_each(?2)),
         d AS (SELECT p.system_id, p.physical - (SELECT COALESCE(SUM(r.quantity), 0) FROM reservations r
                 WHERE r.product_id = p.id AND r.status = 'active' AND r.expires_at > ?3) AS disp
               FROM products p WHERE p.status = 'active'
                 AND p.system_id IN (SELECT value FROM json_each(?1)))
         SELECT d.system_id AS id,
           SUM(CASE WHEN m.minimo IS NULL THEN d.disp <= 0 ELSE d.disp < m.minimo END) AS n
         FROM d LEFT JOIN m ON m.system_id = d.system_id GROUP BY d.system_id`,
      )
      .bind(idsCom("produtos"), minimos, agora),
    db
      .prepare(
        `SELECT system_id AS id, COUNT(*) AS n FROM appointments
         WHERE status IN ('scheduled', 'in_progress', 'done') AND start_at >= ?2 AND start_at < ?3
           AND system_id IN (SELECT value FROM json_each(?1)) GROUP BY system_id`,
      )
      .bind(idsCom("agenda"), inicioHoje, inicioAmanha),
    db
      .prepare(
        `SELECT system_id AS id, COUNT(*) AS n, SUM(amount_cents) AS t FROM financial_entries
         WHERE status = 'pendente' AND due_date < ?2
           AND system_id IN (SELECT value FROM json_each(?1)) GROUP BY system_id`,
      )
      .bind(idsCom("financeiro"), hoje),
    db
      .prepare(
        `SELECT system_id AS id, status, COUNT(*) AS n FROM dev_requests
         WHERE ?2 = 1 AND system_id IN (SELECT value FROM json_each(?1)) GROUP BY system_id, status`,
      )
      .bind(ids, admin ? 1 : 0),
  ]);
  type Linha = Record<string, number | string | null> & { id: string };
  const porId = (r: D1Result | undefined) =>
    new Map<string, Linha>(
      (r?.results ?? []).map((x) => {
        const linha = x as Linha;
        return [linha.id, linha];
      }),
    );
  const [v, c, e, a, f] = [vendas, clientes, estoque, agenda, contas].map(porId);
  const num = (x: Linha | undefined, k: string) => Number(x?.[k] ?? 0);
  const listaPedidos = (pedidos?.results ?? []) as { id: string; status: string; n: number }[];
  const contar = (status: string, sistema?: string) =>
    listaPedidos
      .filter((p) => p.status === status && (!sistema || p.id === sistema))
      .reduce((soma, p) => soma + p.n, 0);

  const resumoDe = (s: SystemRow): ResumoSistemaDto => {
    const r: ResumoSistemaDto = {};
    if (tem(s, "vendas")) {
      const x = v!.get(s.id);
      r.vendas = {
        hoje: { quantidade: num(x, "hq"), totalCentavos: num(x, "ht") },
        mes: { quantidade: num(x, "mq"), totalCentavos: num(x, "mt") },
      };
    }
    if (tem(s, "clientes")) r.clientesAtivos = num(c!.get(s.id), "n");
    if (tem(s, "produtos")) {
      r.estoque = {
        criticos: num(e!.get(s.id), "n"),
        comMinimo: (minimoDe[s.id] ?? null) !== null,
      };
    }
    if (tem(s, "agenda")) r.atendimentosHoje = num(a!.get(s.id), "n");
    if (tem(s, "financeiro")) {
      r.contasVencidas = {
        quantidade: num(f!.get(s.id), "n"),
        totalCentavos: num(f!.get(s.id), "t"),
      };
    }
    return r;
  };

  const resumo: InicioDto = {
    hoje,
    sistemas: sistemas.map((row) => {
      const dados = configDe.get(row.id);
      const config = dados?.config ?? null;
      return {
        sistema: publicSystem(row),
        modelo: config?.modelo ?? null,
        modulos: config?.modulos ?? [],
        corPrimaria: config?.aparencia.cor_primaria ?? null,
        resumo: row.status === "active" && config ? resumoDe(row) : null,
        pedidosAbertos: contar("aberto", row.id) + contar("em_analise", row.id),
        ultimaAtividade: dados?.atividade ?? row.updated_at,
      };
    }),
    truncado,
    pedidos: admin
      ? {
          abertos: contar("aberto"),
          emAnalise: contar("em_analise"),
          implementados: contar("implementado"),
        }
      : null,
    ia: admin ? await consumoDoMes(ctx.env, agora) : null,
  };
  return json({ inicio: resumo });
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
  if (body.base) {
    const ultima = await ctx.env.DB.prepare(
      "SELECT id FROM model_versions WHERE system_id = ? ORDER BY version DESC LIMIT 1",
    )
      .bind(systemId)
      .first<{ id: string }>();
    if (ultima && ultima.id !== body.base) {
      throw new AppError(
        409,
        "versao_desatualizada",
        "O sistema mudou em outra tela. Recarregue para conferir a versão atual.",
      );
    }
  }
  const result = validateDraft(body.rascunho);
  if (!result.draft) {
    // Estrutura inválida não vira versão: devolve o diagnóstico para correção.
    return json({ versao: null, issues: result.issues }, { status: 422 });
  }
  // Sistema ativo (ADR-008): a versão nova só pode somar ao que está em uso.
  if (system.status === "active") {
    requireAdmin(user);
    const ativa = await configAtiva(ctx, systemId);
    if (ativa) result.issues.push(...compatibilidadeComAtiva(ativa, result.draft));
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
        base: body.base,
      })),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    // Com base, a versão só é inserida se a última ainda for ela; se outra entrou no meio, o
    // diagnóstico sem versão falha e o lote inteiro é desfeito.
    if (body.base && !isUnique(error)) {
      throw new AppError(
        409,
        "versao_desatualizada",
        "O sistema mudou em outra tela. Recarregue para conferir a versão atual.",
      );
    }
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
    /** Só grava se a última versão ainda for esta (na mesma instrução: sem janela de corrida). */
    base?: string | undefined;
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
         FROM model_versions WHERE system_id = ?
         HAVING ? IS NULL
           OR (SELECT id FROM model_versions WHERE system_id = ? ORDER BY version DESC LIMIT 1) = ?`,
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
        v.base ?? null,
        v.systemId,
        v.base ?? null,
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
  const { versao, base } = parse(ActivateBody, await readJson(ctx.request));
  const row = await loadSystem(ctx, systemId);

  if (row.status === "active" && row.active_version_id === versao) {
    return json({ sistema: publicSystem(row) });
  }
  if (system.status === "active") {
    // A alteração parte de uma versão ativa: se outra foi aplicada no meio, esta não sobrescreve.
    if (!base || base !== row.active_version_id) {
      throw new AppError(
        409,
        "versao_desatualizada",
        "O sistema foi alterado em outra tela. Recarregue e confira antes de aplicar.",
      );
    }
    return aplicarAlteracao(ctx, user.id, row, versao);
  }
  if (system.status !== "draft") {
    throw conflict("Só um sistema em rascunho ou ativo pode receber uma versão.");
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

/** Configuração da versão ativa (null se o sistema ainda não foi ativado). */
async function configAtiva(ctx: RequestContext, systemId: string): Promise<ConfigDraft | null> {
  const row = await ctx.env.DB.prepare(
    `SELECT v.config_json FROM systems s JOIN model_versions v ON v.id = s.active_version_id
     WHERE s.id = ?`,
  )
    .bind(systemId)
    .first<{ config_json: string }>();
  return row ? (JSON.parse(row.config_json) as ConfigDraft) : null;
}

/**
 * Aplica a alteração de um sistema ativo (ADR-008): troca a versão ativa pela nova aprovada, de
 * uma vez, só se a ativa ainda for a que a pessoa alterou (outra troca no meio recusa) e se a nova
 * continuar compatível com ela. As operações passam a usar a nova configuração na hora.
 */
async function aplicarAlteracao(
  ctx: RequestContext,
  userId: string,
  row: SystemRow,
  versao: string,
): Promise<Response> {
  const db = ctx.env.DB;
  const nova = await db
    .prepare("SELECT config_json, status FROM model_versions WHERE id = ? AND system_id = ?")
    .bind(versao, row.id)
    .first<{ config_json: string; status: string }>();
  if (!nova) throw notFound();
  const ativa = await configAtiva(ctx, row.id);
  if (ativa) {
    const incompativel = compatibilidadeComAtiva(
      ativa,
      JSON.parse(nova.config_json) as ConfigDraft,
    );
    if (incompativel.length) {
      throw new AppError(409, "alteracao_incompativel", incompativel[0]!.message);
    }
  }
  const now = ctx.clock.now();
  let changed = 0;
  try {
    const [update] = await db.batch([
      db
        .prepare(
          `UPDATE systems SET active_version_id = ?, updated_at = ?
           WHERE id = ? AND status = 'active' AND active_version_id IS ?`,
        )
        .bind(versao, now, row.id, row.active_version_id),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) SELECT ?, ?, 'system.updated', 'model_version', ?, ? WHERE changes() = 1",
        )
        .bind(row.id, userId, versao, now),
    ]);
    changed = update?.meta.changes ?? 0;
  } catch (error) {
    triggerConflict(error, {
      versao_nao_aprovada: "Só uma versão aprovada deste sistema pode ser aplicada.",
    });
  }
  const depois = await loadSystem(ctx, row.id);
  if (changed === 0 && depois.active_version_id !== versao) {
    throw conflict("O sistema foi alterado em outra tela. Recarregue e confira.");
  }
  return json({ sistema: publicSystem(depois) });
}
