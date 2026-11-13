import { z } from "zod";
import type { LancamentoDto, StatusLancamento, TipoLancamento } from "../../../shared/api";
import { paraCampoLocal } from "../../../shared/dominio/agenda";
import { readJson } from "../../http/body";
import { AppError, conflict, notFound, validationFailed } from "../../http/errors";
import { beginIdempotent, recordStatement, replayAfterRace } from "../../http/idempotency";
import { json } from "../../http/responses";
import type { Handler, RequestContext } from "../../http/router";
import { isUnique, parse, triggerConflict } from "../comum";
import { abrirOperacao } from "./contexto";

// Financeiro (ADR-006): contas a receber e a pagar, com vencimento em data local. Venda a prazo e
// compra geram a conta sozinhas; as manuais (aluguel, luz) são lançadas aqui. Pendente vai para
// paga (baixa) ou cancelada, uma vez; conta de venda ou compra só é cancelada pela origem.

/** Data local AAAA-MM-DD que existe no calendário. */
export const dataLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD")
  .refine((t) => {
    const [a, m, d] = t.split("-").map(Number) as [number, number, number];
    const data = new Date(Date.UTC(a, m - 1, d));
    return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
  }, "data inexistente");

const TIPOS = ["receber", "pagar"] as const;
const LIMITE_LISTA = 500;
const STATUS = ["pendente", "pago", "cancelado"] as const;

const LancamentoBody = z.object({
  tipo: z.enum(TIPOS),
  descricao: z.string().trim().min(3).max(200),
  valorCentavos: z.number().int().min(1).max(10_000_000_000),
  vencimento: dataLocal,
  cliente: z.string().min(1).max(100).optional(),
  fornecedor: z.string().min(1).max(100).optional(),
});
const CancelarBody = z.object({ motivo: z.string().trim().min(3).max(300) });

const MENSAGENS = {
  lancamento_encerrado: "Esta conta já foi paga ou cancelada.",
};

interface LancamentoRow {
  id: string;
  kind: TipoLancamento;
  description: string;
  amount_cents: number;
  due_date: string;
  status: StatusLancamento;
  paid_at: number | null;
  cancelled_at: number | null;
  cancel_reason: string | null;
  sale_id: string | null;
  purchase_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  counterpart: string | null;
  created_at: number;
}

const SELECT_LANCAMENTO = `
  SELECT f.*, COALESCE(c.name, s.name) AS counterpart FROM financial_entries f
  LEFT JOIN customers c ON c.id = f.customer_id
  LEFT JOIN suppliers s ON s.id = f.supplier_id`;

/** Hoje no fuso do Nexus (AAAA-MM-DD): vencido é pendente com vencimento antes disso. */
export const hojeLocal = (agora: number) => paraCampoLocal(agora).slice(0, 10);

function publicLancamento(row: LancamentoRow, hoje: string): LancamentoDto {
  return {
    id: row.id,
    tipo: row.kind,
    descricao: row.description,
    valorCentavos: row.amount_cents,
    vencimento: row.due_date,
    status: row.status,
    vencido: row.status === "pendente" && row.due_date < hoje,
    pagoEm: row.paid_at,
    canceladoEm: row.cancelled_at,
    motivoCancelamento: row.cancel_reason,
    venda: row.sale_id,
    compra: row.purchase_id,
    cliente: row.customer_id,
    fornecedor: row.supplier_id,
    contraparte: row.counterpart,
    criadoEm: row.created_at,
  };
}

/**
 * Depois do lote: se uma baixa e um cancelamento correram juntos, só um muda a conta. Quem perdeu
 * recebe 409 em vez de anunciar uma operação que não aconteceu.
 */
async function estadoFinal(
  ctx: RequestContext,
  systemId: string,
  id: string,
  esperado: StatusLancamento,
) {
  const row = await carregarLancamento(ctx, systemId, id);
  if (row.status !== esperado) {
    throw conflict(
      row.status === "pago"
        ? "Esta conta acabou de ser paga."
        : "Esta conta acabou de ser cancelada.",
    );
  }
  return row;
}

async function carregarLancamento(ctx: RequestContext, systemId: string, id: string) {
  const row = await ctx.env.DB.prepare(`${SELECT_LANCAMENTO} WHERE f.id = ? AND f.system_id = ?`)
    .bind(id, systemId)
    .first<LancamentoRow>();
  if (!row) throw notFound();
  return row;
}

const opcao = <T extends string>(valor: string | null, aceitos: readonly T[]): T | null =>
  valor !== null && (aceitos as readonly string[]).includes(valor) ? (valor as T) : null;

/** Lista com filtros: tipo, situação ("vencido" = pendente antes de hoje) e período do vencimento. */
export const listarLancamentos: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "financeiro");
  const q = ctx.url.searchParams;
  const tipo = opcao(q.get("tipo"), TIPOS);
  const situacao = q.get("status");
  const status = opcao(situacao, STATUS);
  const de = dataLocal.safeParse(q.get("de")).data ?? null;
  const ate = dataLocal.safeParse(q.get("ate")).data ?? null;
  const hoje = hojeLocal(ctx.clock.now());
  const { results } = await ctx.env.DB.prepare(
    `${SELECT_LANCAMENTO}
     WHERE f.system_id = ?1 AND (?2 IS NULL OR f.kind = ?2) AND (?3 IS NULL OR f.status = ?3)
       AND (?4 = 0 OR (f.status = 'pendente' AND f.due_date < ?5))
       AND (?6 IS NULL OR f.due_date >= ?6) AND (?7 IS NULL OR f.due_date <= ?7)
     ORDER BY f.due_date, f.created_at LIMIT ${LIMITE_LISTA}`,
  )
    .bind(op.systemId, tipo, status, situacao === "vencido" ? 1 : 0, hoje, de, ate)
    .all<LancamentoRow>();
  // Resumo sobre todas as pendentes (a lista tem limite de 500 linhas).
  const r = await ctx.env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'receber' THEN amount_cents END), 0) AS rt,
       SUM(kind = 'receber') AS rn,
       COALESCE(SUM(CASE WHEN kind = 'pagar' THEN amount_cents END), 0) AS pt,
       SUM(kind = 'pagar') AS pn,
       COALESCE(SUM(CASE WHEN due_date < ?2 THEN amount_cents END), 0) AS vt,
       SUM(kind = 'receber' AND due_date < ?2) AS vrn,
       SUM(kind = 'pagar' AND due_date < ?2) AS vpn
     FROM financial_entries WHERE system_id = ?1 AND status = 'pendente'`,
  )
    .bind(op.systemId, hoje)
    .first<Record<string, number | null>>();
  const n = (k: string) => r?.[k] ?? 0;
  return json({
    lancamentos: results.map((row) => publicLancamento(row, hoje)),
    resumoFinanceiro: {
      aReceber: { quantidade: n("rn"), totalCentavos: n("rt") },
      aPagar: { quantidade: n("pn"), totalCentavos: n("pt") },
      vencidos: { receber: n("vrn"), pagar: n("vpn"), totalCentavos: n("vt") },
      limiteAtingido: results.length >= LIMITE_LISTA,
    },
  });
};

/** Lançamento manual: a receber (de um cliente, opcional) ou a pagar (a um fornecedor, opcional). */
export const criarLancamento: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "financeiro");
  const body = parse(LancamentoBody, await readJson(ctx.request));
  const cmd = { scope: op.systemId, actorId: op.user.id, command: "financeiro.create", body };
  const started = await beginIdempotent(ctx, cmd);
  const hoje = hojeLocal(ctx.clock.now());
  if (started.kind === "replay") {
    const row = await carregarLancamento(ctx, op.systemId, started.resourceId);
    return json({ lancamento: publicLancamento(row, hoje) }, { status: started.statusCode });
  }
  if (body.cliente && body.tipo !== "receber") {
    throw validationFailed("Cliente só entra em conta a receber.");
  }
  if (body.fornecedor && body.tipo !== "pagar") {
    throw validationFailed("Fornecedor só entra em conta a pagar.");
  }
  if (body.fornecedor && !op.config.modulos.includes("fornecedores")) {
    throw validationFailed("Este sistema não tem o módulo de fornecedores.");
  }
  const db = ctx.env.DB;
  const contraparte = body.cliente
    ? await db
        .prepare("SELECT 1 AS n FROM customers WHERE id = ? AND system_id = ?")
        .bind(body.cliente, op.systemId)
        .first()
    : body.fornecedor
      ? await db
          .prepare("SELECT 1 AS n FROM suppliers WHERE id = ? AND system_id = ?")
          .bind(body.fornecedor, op.systemId)
          .first()
      : true;
  if (!contraparte) throw notFound();
  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO financial_entries (id, system_id, kind, description, amount_cents, due_date,
             customer_id, supplier_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          op.systemId,
          body.tipo,
          body.descricao,
          body.valorCentavos,
          body.vencimento,
          body.cliente ?? null,
          body.fornecedor ?? null,
          op.user.id,
          now,
          now,
        ),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'financeiro.created', 'lancamento', ?, ?)",
        )
        .bind(op.systemId, op.user.id, id, now),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind !== "replay") throw error;
    const row = await carregarLancamento(ctx, op.systemId, replay.resourceId);
    return json({ lancamento: publicLancamento(row, hoje) }, { status: replay.statusCode });
  }
  const row = await carregarLancamento(ctx, op.systemId, id);
  return json({ lancamento: publicLancamento(row, hoje) }, { status: 201 });
};

/** Baixa: a conta pendente vira paga (recebida, se for a receber), com quem baixou e quando. */
export const baixarLancamento: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "financeiro");
  const id = ctx.params.id ?? "";
  const atual = await carregarLancamento(ctx, op.systemId, id);
  const now = ctx.clock.now();
  const hoje = hojeLocal(now);
  if (atual.status === "pago") return json({ lancamento: publicLancamento(atual, hoje) });
  if (atual.status === "cancelado") throw conflict("Conta cancelada não recebe baixa.");
  const db = ctx.env.DB;
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE financial_entries SET status = 'pago', paid_at = ?, paid_by = ?,
             updated_at = max(updated_at, ?) WHERE id = ? AND system_id = ? AND status = 'pendente'`,
        )
        .bind(now, op.user.id, now, id, op.systemId),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) SELECT ?, ?, 'financeiro.paid', 'lancamento', ?, ? WHERE changes() = 1",
        )
        .bind(op.systemId, op.user.id, id, now),
    ]);
  } catch (error) {
    triggerConflict(error, MENSAGENS);
  }
  return json({
    lancamento: publicLancamento(await estadoFinal(ctx, op.systemId, id, "pago"), hoje),
  });
};

/** Cancela uma conta manual pendente; a de venda ou compra é cancelada pela origem. */
export const cancelarLancamento: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "financeiro");
  const id = ctx.params.id ?? "";
  const { motivo } = parse(CancelarBody, await readJson(ctx.request));
  const atual = await carregarLancamento(ctx, op.systemId, id);
  const now = ctx.clock.now();
  const hoje = hojeLocal(now);
  if (atual.status === "cancelado") return json({ lancamento: publicLancamento(atual, hoje) });
  if (atual.status === "pago") throw conflict("Conta já paga não é cancelada.");
  if (atual.sale_id || atual.purchase_id) {
    throw new AppError(
      409,
      "conta_de_origem",
      atual.sale_id
        ? "Esta conta veio de uma venda a prazo: cancele a venda."
        : "Esta conta veio de uma compra: cancele a compra.",
    );
  }
  const db = ctx.env.DB;
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE financial_entries SET status = 'cancelado', cancelled_at = ?, cancelled_by = ?,
             cancel_reason = ?, updated_at = max(updated_at, ?)
           WHERE id = ? AND system_id = ? AND status = 'pendente'`,
        )
        .bind(now, op.user.id, motivo, now, id, op.systemId),
      db
        .prepare(
          `INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at)
           SELECT ?, ?, 'financeiro.cancelled', 'lancamento', ?, json_object('motivo', ?), ? WHERE changes() = 1`,
        )
        .bind(op.systemId, op.user.id, id, motivo, now),
    ]);
  } catch (error) {
    triggerConflict(error, MENSAGENS);
  }
  return json({
    lancamento: publicLancamento(await estadoFinal(ctx, op.systemId, id, "cancelado"), hoje),
  });
};
