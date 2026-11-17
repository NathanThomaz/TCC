import { z } from "zod";
import type {
  LancamentoDto,
  OrcamentoCategoriaDto,
  StatusLancamento,
  TipoLancamento,
} from "../../../shared/api";
import { normalizarRotulo } from "../../../shared/contract/catalog";
import type { ConfigDraft } from "../../../shared/contract/schema";
import { paraCampoLocal } from "../../../shared/dominio/agenda";
import { valorComEncargos } from "../../../shared/dominio/financeiro";
import { regraDo } from "../../../shared/dominio/regras";
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
  categoria: z.string().trim().min(2).max(40).optional(),
});
const CancelarBody = z.object({ motivo: z.string().trim().min(3).max(300) });
/** A tela manda o valor que mostrou; se a multa e os juros mudaram (virou o dia), não baixa. */
const BaixarBody = z.object({
  valorEsperadoCentavos: z.number().int().min(1).max(100_000_000_000).optional(),
});

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
  category: string | null;
  paid_amount_cents: number | null;
}

const SELECT_LANCAMENTO = `
  SELECT f.*, COALESCE(c.name, s.name) AS counterpart FROM financial_entries f
  LEFT JOIN customers c ON c.id = f.customer_id
  LEFT JOIN suppliers s ON s.id = f.supplier_id`;

/** Hoje no fuso do Nexus (AAAA-MM-DD): vencido é pendente com vencimento antes disso. */
export const hojeLocal = (agora: number) => paraCampoLocal(agora).slice(0, 10);

function publicLancamento(row: LancamentoRow, hoje: string, config?: ConfigDraft): LancamentoDto {
  const multa = config ? (regraDo(config, "multa_juros_atraso") ?? null) : null;
  const vencidaAReceber =
    row.status === "pendente" && row.kind === "receber" && row.due_date < hoje;
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
    categoria: row.category,
    valorPagoCentavos: row.status === "pago" ? (row.paid_amount_cents ?? row.amount_cents) : null,
    encargosHoje:
      multa && vencidaAReceber
        ? valorComEncargos(row.amount_cents, row.due_date, hoje, multa)
        : null,
  };
}

/** Categoria aceita para o tipo da conta (sem acento e caixa), no nome cadastrado na regra. */
function categoriaDaRegra(
  config: ConfigDraft,
  tipo: TipoLancamento,
  informada: string | undefined,
) {
  const regra = regraDo(config, "categorias_financeiras");
  if (!regra) {
    if (informada) throw validationFailed("Este sistema não usa categorias nas contas.");
    return null;
  }
  const lista = tipo === "pagar" ? regra.despesas : regra.receitas;
  if (!informada) {
    throw validationFailed(`Escolha a categoria (${tipo === "pagar" ? "despesa" : "receita"}).`);
  }
  const achada = lista.find((c) => normalizarRotulo(c) === normalizarRotulo(informada));
  if (!achada) {
    throw validationFailed(
      `A categoria "${informada}" não está entre as ${tipo === "pagar" ? "despesas" : "receitas"}.`,
    );
  }
  return achada;
}

/**
 * Uso do orçamento do mês (regra orcamento_mensal): contas a pagar não canceladas com vencimento
 * no mês, por categoria; paga conta pelo valor pago.
 */
export async function orcamentoDoMes(
  db: D1Database,
  systemId: string,
  config: ConfigDraft,
  hoje: string,
): Promise<OrcamentoCategoriaDto[] | undefined> {
  const regra = regraDo(config, "orcamento_mensal");
  if (!regra) return undefined;
  const mes = hoje.slice(0, 7);
  const { results } = await db
    .prepare(
      `SELECT category, COALESCE(SUM(COALESCE(paid_amount_cents, amount_cents)), 0) AS total
       FROM financial_entries
       WHERE system_id = ? AND kind = 'pagar' AND status <> 'cancelado' AND category IS NOT NULL
         AND substr(due_date, 1, 7) = ?
       GROUP BY category`,
    )
    .bind(systemId, mes)
    .all<{ category: string; total: number }>();
  const gasto = new Map<string, number>();
  for (const r of results) {
    const k = normalizarRotulo(r.category);
    gasto.set(k, (gasto.get(k) ?? 0) + r.total);
  }
  return regra.limites.map((l) => ({
    categoria: l.categoria,
    limiteCentavos: l.valor_centavos,
    gastoCentavos: gasto.get(normalizarRotulo(l.categoria)) ?? 0,
  }));
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
  const categoria = q.get("categoria")?.trim() || null;
  // Categorias que já aparecem em contas (renomeadas ou tiradas da regra continuam filtráveis).
  const categoriasUsadas = (
    await ctx.env.DB.prepare(
      `SELECT DISTINCT category FROM financial_entries
       WHERE system_id = ? AND category IS NOT NULL ORDER BY category LIMIT 100`,
    )
      .bind(op.systemId)
      .all<{ category: string }>()
  ).results.map((r) => r.category);
  // A mesma categoria com outra grafia (acento, caixa) vale para o filtro, como no orçamento.
  const grafias = categoria
    ? JSON.stringify(
        categoriasUsadas.filter((c) => normalizarRotulo(c) === normalizarRotulo(categoria)),
      )
    : null;
  const hoje = hojeLocal(ctx.clock.now());
  const { results } = await ctx.env.DB.prepare(
    `${SELECT_LANCAMENTO}
     WHERE f.system_id = ?1 AND (?2 IS NULL OR f.kind = ?2) AND (?3 IS NULL OR f.status = ?3)
       AND (?4 = 0 OR (f.status = 'pendente' AND f.due_date < ?5))
       AND (?6 IS NULL OR f.due_date >= ?6) AND (?7 IS NULL OR f.due_date <= ?7)
       AND (?8 IS NULL OR f.category IN (SELECT value FROM json_each(?8)))
     ORDER BY f.due_date, f.created_at LIMIT ${LIMITE_LISTA}`,
  )
    .bind(op.systemId, tipo, status, situacao === "vencido" ? 1 : 0, hoje, de, ate, grafias)
    .all<LancamentoRow>();
  // Por categoria no mês (regra categorias_financeiras): quanto foi para cada uma.
  const porCategoria = regraDo(op.config, "categorias_financeiras")
    ? (
        await ctx.env.DB.prepare(
          `SELECT kind, category, COALESCE(SUM(COALESCE(paid_amount_cents, amount_cents)), 0) AS total
           FROM financial_entries
           WHERE system_id = ? AND status <> 'cancelado' AND category IS NOT NULL
             AND substr(due_date, 1, 7) = ?
           GROUP BY kind, category ORDER BY total DESC`,
        )
          .bind(op.systemId, hoje.slice(0, 7))
          .all<{ kind: TipoLancamento; category: string; total: number }>()
      ).results.map((r) => ({ tipo: r.kind, categoria: r.category, totalCentavos: r.total }))
    : undefined;
  const orcamento = await orcamentoDoMes(ctx.env.DB, op.systemId, op.config, hoje);
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
    lancamentos: results.map((row) => publicLancamento(row, hoje, op.config)),
    ...(porCategoria ? { porCategoria } : {}),
    ...(orcamento ? { orcamento } : {}),
    categoriasUsadas,
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
    return json(
      { lancamento: publicLancamento(row, hoje, op.config) },
      { status: started.statusCode },
    );
  }
  if (body.cliente && body.tipo !== "receber") {
    throw validationFailed("Cliente só entra em conta a receber.");
  }
  if (body.fornecedor && body.tipo !== "pagar") {
    throw validationFailed("Fornecedor só entra em conta a pagar.");
  }
  // Controle financeiro (ADR-015) não tem clientes: a conta a receber fica sem contraparte.
  if (body.cliente && !op.config.modulos.includes("clientes")) {
    throw validationFailed("Este sistema não tem o cadastro de clientes.");
  }
  if (body.fornecedor && !op.config.modulos.includes("fornecedores")) {
    throw validationFailed("Este sistema não tem o módulo de fornecedores.");
  }
  const categoria = categoriaDaRegra(op.config, body.tipo, body.categoria);
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
             customer_id, supplier_id, category, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          categoria,
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
    return json(
      { lancamento: publicLancamento(row, hoje, op.config) },
      { status: replay.statusCode },
    );
  }
  const row = await carregarLancamento(ctx, op.systemId, id);
  return json({ lancamento: publicLancamento(row, hoje, op.config) }, { status: 201 });
};

/** Baixa: a conta pendente vira paga (recebida, se for a receber), com quem baixou e quando. */
export const baixarLancamento: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "financeiro");
  const id = ctx.params.id ?? "";
  const atual = await carregarLancamento(ctx, op.systemId, id);
  const now = ctx.clock.now();
  const hoje = hojeLocal(now);
  if (atual.status === "pago")
    return json({ lancamento: publicLancamento(atual, hoje, op.config) });
  if (atual.status === "cancelado") throw conflict("Conta cancelada não recebe baixa.");
  // A receber paga depois do vencimento, com a regra: grava o valor com multa e juros.
  const multa =
    atual.kind === "receber" ? (regraDo(op.config, "multa_juros_atraso") ?? null) : null;
  const pago = valorComEncargos(atual.amount_cents, atual.due_date, hoje, multa).totalCentavos;
  const { valorEsperadoCentavos } = parse(BaixarBody, await readJson(ctx.request));
  if (valorEsperadoCentavos !== undefined && valorEsperadoCentavos !== pago) {
    throw new AppError(
      409,
      "valor_mudou",
      `O valor com multa e juros mudou para R$ ${(pago / 100).toFixed(2).replace(".", ",")}. Confira e receba de novo.`,
    );
  }
  const db = ctx.env.DB;
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE financial_entries SET status = 'pago', paid_at = ?, paid_by = ?,
             paid_amount_cents = ?, updated_at = max(updated_at, ?)
           WHERE id = ? AND system_id = ? AND status = 'pendente'`,
        )
        .bind(now, op.user.id, pago, now, id, op.systemId),
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
    lancamento: publicLancamento(await estadoFinal(ctx, op.systemId, id, "pago"), hoje, op.config),
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
  if (atual.status === "cancelado")
    return json({ lancamento: publicLancamento(atual, hoje, op.config) });
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
    lancamento: publicLancamento(
      await estadoFinal(ctx, op.systemId, id, "cancelado"),
      hoje,
      op.config,
    ),
  });
};
