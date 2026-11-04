import { z } from "zod";
import type { MovimentoDto } from "../../../shared/api";
import { unidadesDoItem } from "../../../shared/dominio/precos";
import { requireAdmin } from "../../auth/session";
import { readJson } from "../../http/body";
import { conflict, notFound, validationFailed } from "../../http/errors";
import { beginIdempotent, recordIfChanged, replayAfterRace } from "../../http/idempotency";
import { json } from "../../http/responses";
import type { Handler, RequestContext } from "../../http/router";
import { isUnique, parse, triggerConflict } from "../comum";
import { carregarProduto, listarProdutosDoSistema } from "./cadastros";
import { abrirOperacao } from "./contexto";

// Estoque (seção 11): entrada (EST-02), correção só do administrador (EST-03/EST-04) e saldos
// (EST-05). Baixa e estorno de vendas são feitos pelos triggers da migration 0003.

interface MovimentoRow {
  id: string;
  product_id: string;
  kind: MovimentoDto["tipo"];
  delta: number;
  informed_boxes: number | null;
  informed_units: number | null;
  balance_after: number;
  reason: string | null;
  sale_id: string | null;
  actor_id: string;
  actor_email: string;
  created_at: number;
}

function publicMovimento(row: MovimentoRow): MovimentoDto {
  return {
    id: row.id,
    produto: row.product_id,
    tipo: row.kind,
    delta: row.delta,
    caixasInformadas: row.informed_boxes,
    unidadesInformadas: row.informed_units,
    saldoDepois: row.balance_after,
    motivo: row.reason,
    venda: row.sale_id,
    autor: row.actor_id,
    autorEmail: row.actor_email,
    criadoEm: row.created_at,
  };
}

const motivo = z.string().trim().min(3).max(300);
const quantidade = z.number().int().min(0).max(1_000_000);
const EntradaBody = z.object({
  produto: z.string().min(1).max(100),
  caixas: quantidade.default(0),
  unidades: quantidade.default(0),
  motivo,
});
const CorrecaoBody = z.object({
  produto: z.string().min(1).max(100),
  /** Físico que o administrador viu: se mudou nesse meio-tempo, a correção é recusada. */
  fisicoEsperado: z.number().int().min(0),
  novoFisico: z.number().int().min(0).max(100_000_000),
  motivo,
});

const SELECT_MOVIMENTO =
  "SELECT m.*, u.email AS actor_email FROM stock_movements m JOIN users u ON u.id = m.actor_id";

async function carregarMovimento(ctx: RequestContext, systemId: string, id: string) {
  const row = await ctx.env.DB.prepare(`${SELECT_MOVIMENTO} WHERE m.id = ? AND m.system_id = ?`)
    .bind(id, systemId)
    .first<MovimentoRow>();
  if (!row) throw notFound();
  return row;
}

export const listarEstoque: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "estoque");
  return json({ produtos: await listarProdutosDoSistema(ctx, op.systemId, null) });
};

export const listarMovimentos: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "estoque");
  const produto = ctx.url.searchParams.get("produto");
  const { results } = await ctx.env.DB.prepare(
    `${SELECT_MOVIMENTO} WHERE m.system_id = ?1 AND (?2 IS NULL OR m.product_id = ?2)
     ORDER BY m.created_at DESC, m.rowid DESC LIMIT 200`,
  )
    .bind(op.systemId, produto)
    .all<MovimentoRow>();
  return json({ movimentos: results.map(publicMovimento) });
};

/** EST-02: entrada em caixas e/ou unidades, com motivo, responsável e data. */
export const registrarEntrada: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "estoque");
  const body = parse(EntradaBody, await readJson(ctx.request));
  const cmd = { scope: op.systemId, actorId: op.user.id, command: "estoque.entrada", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    const row = await carregarMovimento(ctx, op.systemId, started.resourceId);
    return json({ movimento: publicMovimento(row) }, { status: started.statusCode });
  }
  const produto = await carregarProduto(ctx, op.systemId, body.produto);
  if (produto.status !== "active") throw conflict("Produto inativo não recebe entrada.");
  let delta: number;
  try {
    delta = unidadesDoItem(body.caixas, body.unidades, produto.units_per_box);
  } catch {
    throw validationFailed("Este produto não tem caixa: informe a entrada em unidades.");
  }
  if (delta <= 0) throw validationFailed("Informe uma quantidade maior que zero.");

  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    const [update] = await db.batch([
      db
        .prepare(
          `UPDATE products SET physical = physical + ?, updated_at = max(updated_at, ?)
           WHERE id = ? AND system_id = ? AND status = 'active'`,
        )
        .bind(delta, now, produto.id, op.systemId),
      db
        .prepare(
          `INSERT INTO stock_movements
             (id, system_id, product_id, kind, delta, informed_boxes, informed_units, balance_after, reason, actor_id, created_at)
           SELECT ?, system_id, id, 'entrada', ?, ?, ?, physical, ?, ?, ? FROM products
           WHERE id = ? AND changes() = 1`,
        )
        .bind(id, delta, body.caixas, body.unidades, body.motivo, op.user.id, now, produto.id),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) SELECT ?, ?, 'estoque.entrada', 'movimento', ?, ? WHERE changes() = 1",
        )
        .bind(op.systemId, op.user.id, id, now),
      recordIfChanged(ctx, cmd, started, id, 201, now),
    ]);
    if ((update?.meta.changes ?? 0) === 0) throw conflict("Produto inativo não recebe entrada.");
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind !== "replay") throw error;
    const row = await carregarMovimento(ctx, op.systemId, replay.resourceId);
    return json({ movimento: publicMovimento(row) }, { status: replay.statusCode });
  }
  return json(
    { movimento: publicMovimento(await carregarMovimento(ctx, op.systemId, id)) },
    { status: 201 },
  );
};

/**
 * EST-03/EST-04: correção de saldo só pelo administrador, com motivo e diferença auditada. O
 * físico novo não pode ficar abaixo do reservado ativo (trigger products_physical_above_reserved).
 */
export const corrigirSaldo: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "estoque");
  requireAdmin(op.user);
  const body = parse(CorrecaoBody, await readJson(ctx.request));
  const cmd = { scope: op.systemId, actorId: op.user.id, command: "estoque.correcao", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    const row = await carregarMovimento(ctx, op.systemId, started.resourceId);
    return json({ movimento: publicMovimento(row) }, { status: started.statusCode });
  }
  await carregarProduto(ctx, op.systemId, body.produto);
  const delta = body.novoFisico - body.fisicoEsperado;
  if (delta === 0) throw validationFailed("O saldo informado é igual ao atual.");

  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  let changed = 0;
  try {
    const [update] = await db.batch([
      db
        .prepare(
          `UPDATE products SET physical = ?, updated_at = max(updated_at, ?)
           WHERE id = ? AND system_id = ? AND physical = ?`,
        )
        .bind(body.novoFisico, now, body.produto, op.systemId, body.fisicoEsperado),
      db
        .prepare(
          `INSERT INTO stock_movements
             (id, system_id, product_id, kind, delta, balance_after, reason, actor_id, created_at)
           SELECT ?, system_id, id, 'correcao', ?, physical, ?, ?, ? FROM products
           WHERE id = ? AND changes() = 1`,
        )
        .bind(id, delta, body.motivo, op.user.id, now, body.produto),
      db
        .prepare(
          `INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at)
           SELECT ?, ?, 'estoque.correcao', 'movimento', ?, json_object('antes', ?, 'depois', ?, 'motivo', ?), ?
           WHERE changes() = 1`,
        )
        .bind(op.systemId, op.user.id, id, body.fisicoEsperado, body.novoFisico, body.motivo, now),
      recordIfChanged(ctx, cmd, started, id, 201, now),
    ]);
    changed = update?.meta.changes ?? 0;
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind === "replay") {
      const row = await carregarMovimento(ctx, op.systemId, replay.resourceId);
      return json({ movimento: publicMovimento(row) }, { status: replay.statusCode });
    }
    triggerConflict(error, {
      abaixo_do_reservado:
        "O saldo não pode ficar abaixo do que está reservado em rascunhos de venda (EST-04).",
    });
  }
  if (changed === 0) {
    throw conflict("O saldo mudou desde a consulta. Confira o valor atual e tente de novo.");
  }
  return json(
    { movimento: publicMovimento(await carregarMovimento(ctx, op.systemId, id)) },
    { status: 201 },
  );
};
