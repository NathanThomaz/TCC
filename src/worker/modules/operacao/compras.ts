import { z } from "zod";
import type { CompraDto, ItemCompraDto } from "../../../shared/api";
import { deCampoLocal } from "../../../shared/dominio/agenda";
import { unidadesDoItem } from "../../../shared/dominio/precos";
import { readJson } from "../../http/body";
import { AppError, conflict, notFound, validationFailed } from "../../http/errors";
import { beginIdempotent, recordStatement, replayAfterRace } from "../../http/idempotency";
import { json } from "../../http/responses";
import type { Handler, RequestContext } from "../../http/router";
import { isUnique, parse, triggerConflict } from "../comum";
import { abrirOperacao } from "./contexto";
import { dataLocal } from "./financeiro";

// Fornecedores e compras (ADR-006): a compra registra fornecedor, itens e custo e, no mesmo lote,
// dá entrada no estoque (gatilho purchase_items_effects, migration 0008). Com o financeiro, gera
// a conta a pagar. Cancelar devolve o estoque e cancela a conta pendente; conta paga impede.

const quantidade = z.number().int().min(0).max(1_000_000);
const ItemBody = z.object({
  produto: z.string().min(1).max(100),
  caixas: quantidade.default(0),
  unidades: quantidade.default(0),
  custoUnitarioCentavos: z.number().int().min(0).max(100_000_000),
});
const CompraBody = z.object({
  fornecedor: z.string().min(1).max(100),
  itens: z.array(ItemBody).min(1).max(50),
  observacao: z.string().trim().max(300).optional(),
  /** Vencimento da conta a pagar (AAAA-MM-DD); obrigatório com o financeiro. */
  vencimento: dataLocal.optional(),
});
const CancelarBody = z.object({ motivo: z.string().trim().min(3).max(300) });

/** Compras por listagem; as mais antigas aparecem filtrando pelo período. */
export const LIMITE_COMPRAS = 200;

/** Mesmo teto de uma conta no financeiro (CHECK de financial_entries). */
const TETO_COMPRA_CENTAVOS = 10_000_000_000;

const MENSAGENS = {
  fornecedor_inativo: "Fornecedor inativo não recebe novas compras.",
  produto_inativo: "Um dos produtos está inativo.",
  conta_ja_paga:
    "A conta a pagar desta compra já foi paga no financeiro: a compra não pode ser cancelada.",
  abaixo_do_reservado:
    "Parte do estoque desta compra já foi vendida ou está reservada: a compra não pode ser cancelada.",
  transicao_de_status_invalida: "Esta compra já foi cancelada.",
};

interface CompraRow {
  id: string;
  supplier_id: string;
  supplier_name: string;
  status: CompraDto["status"];
  total_cents: number;
  notes: string | null;
  created_at: number;
  cancelled_at: number | null;
  cancel_reason: string | null;
  entry_id: string | null;
}

interface ItemRow {
  purchase_id: string;
  product_id: string;
  product_name: string;
  informed_boxes: number;
  informed_units: number;
  units: number;
  unit_cost_cents: number;
  line_cents: number;
}

const SELECT_COMPRA = `
  SELECT c.id, c.supplier_id, s.name AS supplier_name, c.status, c.total_cents, c.notes,
         c.created_at, c.cancelled_at, c.cancel_reason,
         (SELECT f.id FROM financial_entries f WHERE f.purchase_id = c.id) AS entry_id
  FROM purchases c JOIN suppliers s ON s.id = c.supplier_id`;

function publicItem(row: ItemRow): ItemCompraDto {
  return {
    produto: row.product_id,
    nomeProduto: row.product_name,
    caixas: row.informed_boxes,
    unidadesSoltas: row.informed_units,
    unidades: row.units,
    custoUnitarioCentavos: row.unit_cost_cents,
    totalCentavos: row.line_cents,
  };
}

function publicCompra(row: CompraRow, itens: ItemRow[]): CompraDto {
  return {
    id: row.id,
    fornecedor: row.supplier_id,
    nomeFornecedor: row.supplier_name,
    status: row.status,
    totalCentavos: row.total_cents,
    observacao: row.notes,
    itens: itens.filter((i) => i.purchase_id === row.id).map(publicItem),
    conta: row.entry_id,
    criadoEm: row.created_at,
    canceladaEm: row.cancelled_at,
    motivoCancelamento: row.cancel_reason,
  };
}

async function itensDe(ctx: RequestContext, systemId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const { results } = await ctx.env.DB.prepare(
    `SELECT i.purchase_id, i.product_id, p.name AS product_name, i.informed_boxes, i.informed_units,
            i.units, i.unit_cost_cents, i.line_cents
     FROM purchase_items i JOIN products p ON p.id = i.product_id
     WHERE i.system_id = ? AND i.purchase_id IN (SELECT value FROM json_each(?))
     ORDER BY i.purchase_id, i.position`,
  )
    .bind(systemId, JSON.stringify(ids))
    .all<ItemRow>();
  return results;
}

async function carregarCompra(ctx: RequestContext, systemId: string, id: string) {
  const row = await ctx.env.DB.prepare(`${SELECT_COMPRA} WHERE c.id = ? AND c.system_id = ?`)
    .bind(id, systemId)
    .first<CompraRow>();
  if (!row) throw notFound();
  return publicCompra(row, await itensDe(ctx, systemId, [id]));
}

export const listarCompras: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "fornecedores");
  const q = ctx.url.searchParams;
  const fornecedor = q.get("fornecedor");
  // Período pela data local da compra (inclusive), para chegar às compras além das 200 últimas.
  const de = dataLocal.safeParse(q.get("de")).data;
  const ate = dataLocal.safeParse(q.get("ate")).data;
  const inicio = de ? deCampoLocal(`${de}T00:00`) : null;
  const fim = ate ? (deCampoLocal(`${ate}T00:00`) ?? 0) + 86_400_000 : null;
  const { results } = await ctx.env.DB.prepare(
    `${SELECT_COMPRA} WHERE c.system_id = ?1 AND (?2 IS NULL OR c.supplier_id = ?2)
       AND (?3 IS NULL OR c.created_at >= ?3) AND (?4 IS NULL OR c.created_at < ?4)
     ORDER BY c.created_at DESC LIMIT ${LIMITE_COMPRAS}`,
  )
    .bind(op.systemId, fornecedor, inicio, fim)
    .all<CompraRow>();
  const itens = await itensDe(
    ctx,
    op.systemId,
    results.map((r) => r.id),
  );
  return json({ compras: results.map((r) => publicCompra(r, itens)) });
};

/** Registra a compra: entrada no estoque, último custo e, com o financeiro, a conta a pagar. */
export const criarCompra: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "fornecedores");
  const body = parse(CompraBody, await readJson(ctx.request));
  const cmd = { scope: op.systemId, actorId: op.user.id, command: "compra.create", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    return json(
      { compra: await carregarCompra(ctx, op.systemId, started.resourceId) },
      { status: started.statusCode },
    );
  }
  const financeiro = op.config.modulos.includes("financeiro");
  if (financeiro && !body.vencimento) {
    throw validationFailed("Informe o vencimento da conta a pagar desta compra.");
  }
  const ids = body.itens.map((i) => i.produto);
  if (new Set(ids).size !== ids.length) {
    throw validationFailed("Cada produto aparece uma vez na compra: some as quantidades.");
  }
  const db = ctx.env.DB;
  const [fornecedor, produtos] = await Promise.all([
    db
      .prepare("SELECT id, name, status FROM suppliers WHERE id = ? AND system_id = ?")
      .bind(body.fornecedor, op.systemId)
      .first<{ id: string; name: string; status: string }>(),
    db
      .prepare(
        `SELECT id, name, status, units_per_box FROM products
         WHERE system_id = ? AND id IN (SELECT value FROM json_each(?))`,
      )
      .bind(op.systemId, JSON.stringify(ids))
      .all<{ id: string; name: string; status: string; units_per_box: number | null }>(),
  ]);
  if (!fornecedor) throw notFound();
  if (fornecedor.status !== "active") throw conflict(MENSAGENS.fornecedor_inativo);
  const porId = new Map(produtos.results.map((p) => [p.id, p]));
  const itens = body.itens.map((item, position) => {
    const produto = porId.get(item.produto);
    if (!produto) throw notFound();
    if (produto.status !== "active") throw conflict(`${produto.name} está inativo.`);
    let unidades: number;
    try {
      unidades = unidadesDoItem(item.caixas, item.unidades, produto.units_per_box);
    } catch {
      throw validationFailed(`${produto.name} não tem caixa: informe a compra em unidades.`);
    }
    if (unidades <= 0) throw validationFailed(`Informe a quantidade de ${produto.name}.`);
    return {
      produto: item.produto,
      caixas: item.caixas,
      soltas: item.unidades,
      custo: item.custoUnitarioCentavos,
      position,
      unidades,
      linha: unidades * item.custoUnitarioCentavos,
    };
  });
  const total = itens.reduce((soma, i) => soma + i.linha, 0);
  // Teto de uma conta no financeiro (e muito abaixo do inteiro seguro do JavaScript).
  if (!Number.isSafeInteger(total) || total > TETO_COMPRA_CENTAVOS) {
    throw new AppError(
      422,
      "valor_acima_do_limite",
      "O total desta compra passa do limite de R$ 100.000.000,00. Divida em compras menores.",
    );
  }

  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO purchases (id, system_id, supplier_id, total_cents, notes, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, op.systemId, fornecedor.id, total, body.observacao || null, op.user.id, now, now),
      ...itens.map((i) =>
        db
          .prepare(
            `INSERT INTO purchase_items (purchase_id, system_id, position, product_id, units,
               informed_boxes, informed_units, unit_cost_cents, line_cents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            op.systemId,
            i.position,
            i.produto,
            i.unidades,
            i.caixas,
            i.soltas,
            i.custo,
            i.linha,
          ),
      ),
      // Compra de valor zero (bonificação) não gera conta.
      ...(financeiro && total > 0 && body.vencimento
        ? [
            db
              .prepare(
                `INSERT INTO financial_entries (id, system_id, kind, description, amount_cents,
                   due_date, purchase_id, supplier_id, created_by, created_at, updated_at)
                 VALUES (?, ?, 'pagar', ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                crypto.randomUUID(),
                op.systemId,
                `Compra — ${fornecedor.name}`.slice(0, 200),
                total,
                body.vencimento,
                id,
                fornecedor.id,
                op.user.id,
                now,
                now,
              ),
          ]
        : []),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'compra.created', 'compra', ?, ?)",
        )
        .bind(op.systemId, op.user.id, id, now),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    if (isUnique(error)) {
      const replay = await replayAfterRace(ctx, cmd, started);
      if (replay?.kind === "replay") {
        return json(
          { compra: await carregarCompra(ctx, op.systemId, replay.resourceId) },
          { status: replay.statusCode },
        );
      }
    }
    triggerConflict(error, MENSAGENS);
  }
  return json({ compra: await carregarCompra(ctx, op.systemId, id) }, { status: 201 });
};

/** Cancela a compra: devolve o estoque (correção) e cancela a conta a pagar pendente. */
export const cancelarCompra: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "fornecedores");
  const id = ctx.params.id ?? "";
  const { motivo } = parse(CancelarBody, await readJson(ctx.request));
  const compra = await carregarCompra(ctx, op.systemId, id);
  if (compra.status === "cancelled") return json({ compra });
  const db = ctx.env.DB;
  const now = ctx.clock.now();
  // Mensagem clara antes do lote; os gatilhos garantem o mesmo se algo mudar no meio-tempo.
  const paga = await db
    .prepare("SELECT 1 AS n FROM financial_entries WHERE purchase_id = ? AND status = 'pago'")
    .bind(id)
    .first<{ n: number }>();
  if (paga) throw new AppError(409, "conta_ja_paga", MENSAGENS.conta_ja_paga);
  const { results: saldos } = await db
    .prepare(
      `SELECT p.name, p.physical - i.units -
         (SELECT COALESCE(SUM(r.quantity), 0) FROM reservations r
           WHERE r.product_id = p.id AND r.status = 'active' AND r.expires_at > ?1) AS sobra
       FROM purchase_items i JOIN products p ON p.id = i.product_id
       WHERE i.purchase_id = ?2 AND i.system_id = ?3`,
    )
    .bind(now, id, op.systemId)
    .all<{ name: string; sobra: number }>();
  const faltando = saldos.filter((s) => s.sobra < 0).map((s) => s.name);
  if (faltando.length) {
    throw new AppError(
      409,
      "estoque_insuficiente",
      `Não há estoque livre para devolver: ${faltando.join(", ")}. Parte já foi vendida ou reservada.`,
    );
  }
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE purchases SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?,
             cancel_reason = ?, updated_at = max(updated_at, ?)
           WHERE id = ? AND system_id = ? AND status = 'completed'`,
        )
        .bind(now, op.user.id, motivo, now, id, op.systemId),
      db
        .prepare(
          `INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at)
           SELECT ?, ?, 'compra.cancelled', 'compra', ?, json_object('motivo', ?), ? WHERE changes() = 1`,
        )
        .bind(op.systemId, op.user.id, id, motivo, now),
    ]);
  } catch (error) {
    triggerConflict(error, MENSAGENS);
  }
  return json({ compra: await carregarCompra(ctx, op.systemId, id) });
};
