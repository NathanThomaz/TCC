import { z } from "zod";
import type { AtendimentoDto, FaltaDto, ItemVendaDto, VendaDto } from "../../../shared/api";
import type { ConfigDraft } from "../../../shared/contract/schema";
import { calcularTotais, unidadesDoItem } from "../../../shared/dominio/precos";
import { PAYMENT_METHODS, type PaymentMethod } from "../../../shared/contract/catalog";
import {
  conferirFormaPagamento,
  conferirLimitePorItem,
  conferirPedidoMinimo,
  conferirPrazoCancelamentoAtendimento,
  conferirPrazoCancelamentoVenda,
  vencimentoEmDias,
} from "../../../shared/dominio/regras";
import { readJson } from "../../http/body";
import { AppError, conflict, notFound, validationFailed } from "../../http/errors";
import {
  beginIdempotent,
  recordStatement,
  replayAfterRace,
  type IdempotentCommand,
  type IdempotencyOutcome,
} from "../../http/idempotency";
import { json } from "../../http/responses";
import type { Handler, RequestContext } from "../../http/router";
import { parse, triggerCode, triggerConflict } from "../comum";
import { atendimentosDaVenda } from "./agenda";
import {
  abrirOperacao,
  camposValidos,
  conflitoComDados,
  filtroDaQuery,
  lerCampos,
  type Operacao,
} from "./contexto";

// Vendas (seções 10 a 12). O rascunho reserva o estoque ao ser gravado (RES-01), tudo ou nada
// (RES-02); cada gravação renova o prazo (RES-03) e consultar não renova (RES-04). Vencido, o
// rascunho continua consultável (RES-05) e precisa ser regravado para concluir (RES-06).
// Concluir, descartar e cancelar disparam os efeitos de estoque nos triggers da migration 0003,
// que acontecem uma única vez porque cada transição de status só ocorre uma vez.

const STATUS = ["draft", "discarded", "completed", "cancelled"] as const;

interface VendaRow {
  id: string;
  customer_id: string;
  customer_name: string;
  status: (typeof STATUS)[number];
  revision: number;
  expires_at: number;
  wholesale_threshold_cents: number | null;
  reservation_minutes: number;
  subtotal_retail_cents: number;
  total_cents: number;
  price_tier: "varejo" | "atacado";
  extra_json: string;
  created_at: number;
  completed_at: number | null;
  cancelled_at: number | null;
  cancel_reason: string | null;
  payment_method: PaymentMethod | null;
}

interface ItemRow {
  product_id: string;
  product_name: string;
  position: number;
  boxes: number;
  loose_units: number;
  units_per_box: number | null;
  units: number;
  retail_unit_cents: number;
  wholesale_unit_cents: number | null;
  line_total_cents: number;
  added_at: number;
}

const ItemBody = z.object({
  produto: z.string().min(1).max(100),
  caixas: z.number().int().min(0).max(100_000).default(0),
  unidades: z.number().int().min(0).max(1_000_000).default(0),
});
const itens = z.array(ItemBody).min(1, "Inclua ao menos um item.").max(50);
const CriarBody = z.object({
  cliente: z.string().min(1).max(100),
  itens,
  campos: z.unknown().optional(),
});
const SalvarBody = z.object({ revisao: z.number().int().min(1), itens });
const ConcluirBody = z.object({
  revisao: z.number().int().min(1),
  /** Obrigatória com o módulo de pagamentos (ADR-006); ignorada sem ele. */
  formaPagamento: z.enum(PAYMENT_METHODS).optional(),
});
const CancelarBody = z.object({
  motivo: z.string().trim().min(3).max(300),
  /** CAN-04: confirma o cancelamento conjunto dos serviços vinculados ainda não iniciados. */
  cancelarServicos: z.boolean().default(false),
});

function publicVenda(row: VendaRow, items: ItemRow[], now: number): VendaDto {
  return {
    id: row.id,
    cliente: row.customer_id,
    nomeCliente: row.customer_name,
    status: row.status,
    expirada: row.status === "draft" && row.expires_at <= now,
    revisao: row.revision,
    expiraEm: row.expires_at,
    limiteAtacadoCentavos: row.wholesale_threshold_cents,
    prazoReservaMinutos: row.reservation_minutes,
    subtotalVarejoCentavos: row.subtotal_retail_cents,
    totalCentavos: row.total_cents,
    faixa: row.price_tier,
    itens: items.map(publicItem),
    campos: lerCampos(row.extra_json),
    criadoEm: row.created_at,
    concluidaEm: row.completed_at,
    canceladaEm: row.cancelled_at,
    motivoCancelamento: row.cancel_reason,
    formaPagamento: row.payment_method,
  };
}

function publicItem(row: ItemRow): ItemVendaDto {
  return {
    produto: row.product_id,
    nomeProduto: row.product_name,
    caixas: row.boxes,
    unidadesSoltas: row.loose_units,
    unidadesPorCaixa: row.units_per_box,
    unidades: row.units,
    varejoCentavos: row.retail_unit_cents,
    atacadoCentavos: row.wholesale_unit_cents,
    totalCentavos: row.line_total_cents,
  };
}

const SELECT_VENDA = `
  SELECT s.*, c.name AS customer_name FROM sales s
  JOIN customers c ON c.id = s.customer_id AND c.system_id = s.system_id`;

async function carregarItens(ctx: RequestContext, saleId: string): Promise<ItemRow[]> {
  const { results } = await ctx.env.DB.prepare(
    `SELECT i.*, p.name AS product_name FROM sale_items i JOIN products p ON p.id = i.product_id
     WHERE i.sale_id = ? ORDER BY i.position`,
  )
    .bind(saleId)
    .all<ItemRow>();
  return results;
}

async function carregarVendaRow(ctx: RequestContext, systemId: string, id: string) {
  const row = await ctx.env.DB.prepare(`${SELECT_VENDA} WHERE s.id = ? AND s.system_id = ?`)
    .bind(id, systemId)
    .first<VendaRow>();
  if (!row) throw notFound();
  return row;
}

async function carregarVenda(ctx: RequestContext, systemId: string, id: string): Promise<VendaDto> {
  const row = await carregarVendaRow(ctx, systemId, id);
  return publicVenda(row, await carregarItens(ctx, id), ctx.clock.now());
}

// ---- Montagem dos itens com preço do momento ----

interface ProdutoParaVenda {
  id: string;
  name: string;
  status: string;
  retail_cents: number;
  wholesale_cents: number | null;
  units_per_box: number | null;
}

interface ItemMontado {
  produto: string;
  caixas: number;
  unidadesSoltas: number;
  unidadesPorCaixa: number | null;
  unidades: number;
  varejo: number;
  atacado: number | null;
  adicionadoEm: number;
}

/**
 * Converte o pedido em itens. Produto que já estava no rascunho mantém preços e fator da caixa
 * de quando entrou; produto novo usa os preços do momento (decisão do dono, 2026-11-04).
 */
async function montarItens(
  ctx: RequestContext,
  config: ConfigDraft,
  systemId: string,
  pedido: z.infer<typeof itens>,
  anteriores: ItemRow[],
  now: number,
): Promise<ItemMontado[]> {
  const ids = pedido.map((i) => i.produto);
  if (new Set(ids).size !== ids.length) {
    throw validationFailed("Cada produto aparece uma vez; some caixas e unidades no mesmo item.");
  }
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, name, status, retail_cents, wholesale_cents, units_per_box FROM products
     WHERE system_id = ? AND id IN (SELECT value FROM json_each(?))`,
  )
    .bind(systemId, JSON.stringify(ids))
    .all<ProdutoParaVenda>();
  const porId = new Map(results.map((p) => [p.id, p]));
  const snapshot = new Map(anteriores.map((i) => [i.product_id, i]));

  return pedido.map((pedidoItem) => {
    const produto = porId.get(pedidoItem.produto);
    if (!produto) throw validationFailed("Produto não encontrado neste sistema.");
    const antes = snapshot.get(produto.id);
    if (!antes && produto.status !== "active") {
      throw new AppError(409, "produto_inativo", `${produto.name} está inativo.`);
    }
    const fator = antes ? antes.units_per_box : produto.units_per_box;
    let unidades: number;
    try {
      unidades = unidadesDoItem(pedidoItem.caixas, pedidoItem.unidades, fator);
    } catch {
      throw validationFailed(`${produto.name} não é vendido em caixas.`);
    }
    if (unidades <= 0) throw validationFailed(`Informe a quantidade de ${produto.name}.`);
    const limite = conferirLimitePorItem(config, produto.name, unidades);
    if (limite) throw new AppError(422, limite.code, limite.message);
    return {
      produto: produto.id,
      caixas: pedidoItem.caixas,
      unidadesSoltas: pedidoItem.unidades,
      unidadesPorCaixa: fator,
      unidades,
      varejo: antes ? antes.retail_unit_cents : produto.retail_cents,
      atacado: antes ? antes.wholesale_unit_cents : produto.wholesale_cents,
      adicionadoEm: antes ? antes.added_at : now,
    };
  });
}

/** Instruções que regravam itens e reservas (RES-02: no mesmo lote, tudo ou nada). */
function gravarItensEReservas(
  db: D1Database,
  saleId: string,
  systemId: string,
  montados: ItemMontado[],
  linhas: number[],
  now: number,
  expiresAt: number,
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        "UPDATE reservations SET status = 'released' WHERE sale_id = ? AND status = 'active'",
      )
      .bind(saleId),
    db.prepare("DELETE FROM sale_items WHERE sale_id = ?").bind(saleId),
    ...montados.map((item, index) =>
      db
        .prepare(
          `INSERT INTO sale_items
             (sale_id, system_id, product_id, position, boxes, loose_units, units_per_box, units,
              retail_unit_cents, wholesale_unit_cents, line_total_cents, added_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          saleId,
          systemId,
          item.produto,
          index + 1,
          item.caixas,
          item.unidadesSoltas,
          item.unidadesPorCaixa,
          item.unidades,
          item.varejo,
          item.atacado,
          linhas[index] ?? 0,
          item.adicionadoEm,
        ),
    ),
    ...montados.map((item) =>
      db
        .prepare(
          "INSERT INTO reservations (id, system_id, sale_id, product_id, quantity, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(crypto.randomUUID(), systemId, saleId, item.produto, item.unidades, now, expiresAt),
    ),
  ];
}

/** RES-06: diz o que falta, produto a produto, sem contar a reserva da própria venda. */
async function faltas(
  ctx: RequestContext,
  saleId: string | null,
  montados: ItemMontado[],
): Promise<FaltaDto[]> {
  const now = ctx.clock.now();
  const { results } = await ctx.env.DB.prepare(
    `SELECT p.id, p.name, p.physical - (
       SELECT COALESCE(SUM(r.quantity), 0) FROM reservations r
       WHERE r.product_id = p.id AND r.status = 'active' AND r.expires_at > ?1
         AND (?2 IS NULL OR r.sale_id <> ?2)) AS available
     FROM products p WHERE p.id IN (SELECT value FROM json_each(?3))`,
  )
    .bind(now, saleId, JSON.stringify(montados.map((m) => m.produto)))
    .all<{ id: string; name: string; available: number }>();
  const porId = new Map(results.map((r) => [r.id, r]));
  return montados
    .map((m) => {
      const p = porId.get(m.produto);
      return {
        produto: m.produto,
        nomeProduto: p?.name ?? m.produto,
        pedido: m.unidades,
        disponivel: Math.max(0, p?.available ?? 0),
      };
    })
    .filter((f) => f.pedido > f.disponivel);
}

const MENSAGENS = {
  venda_alterada: "A venda foi alterada em outra tela. Recarregue para ver a versão atual.",
  venda_nao_editavel: "Só um rascunho pode ter os itens alterados (PRE-07).",
  cliente_inativo: "Cliente inativo não pode receber novas vendas.",
  produto_inativo: "Um dos produtos está inativo.",
  reserva_expirada:
    "A reserva venceu. Grave o rascunho de novo para reservar o estoque antes de concluir (RES-06).",
  servicos_vinculados:
    "Há serviços vinculados a esta venda que precisam ser resolvidos antes do cancelamento.",
  conta_ja_paga:
    "A conta a receber desta venda já foi recebida no financeiro: a venda não pode ser cancelada.",
  forma_pagamento_imutavel: "A forma de pagamento é registrada só na conclusão.",
};

function limiteAtacado(config: ConfigDraft): number | null {
  for (const regra of config.regras)
    if (regra.tipo === "limite_atacado") return regra.valor_centavos;
  return null;
}

function prazoReserva(config: ConfigDraft): number {
  for (const regra of config.regras) if (regra.tipo === "prazo_reserva") return regra.minutos;
  // O validador exige prazo_reserva com vendas (REQUIRED_RULES); sem ele, a operação para.
  throw conflict("A configuração ativa não define o prazo de reserva.");
}

async function respostaRepetida(
  ctx: RequestContext,
  op: Operacao,
  outcome: Extract<IdempotencyOutcome, { kind: "replay" }>,
) {
  return json(
    { venda: await carregarVenda(ctx, op.systemId, outcome.resourceId) },
    { status: outcome.statusCode },
  );
}

/** Executa o lote do rascunho; traduz falta de estoque e conflitos em respostas claras. */
async function executarGravacao(
  ctx: RequestContext,
  op: Operacao,
  cmd: IdempotentCommand,
  started: Extract<IdempotencyOutcome, { kind: "new" }>,
  saleId: string,
  isNew: boolean,
  montados: ItemMontado[],
  statements: D1PreparedStatement[],
): Promise<Response> {
  try {
    await ctx.env.DB.batch(statements);
  } catch (error) {
    // Mesma chave em paralelo: a outra requisição pode ter vencido (UNIQUE da chave, falta de
    // estoque ou revisão já avançada por ela). Se o pedido já foi atendido, devolve o resultado.
    const replay = await replayAfterRace(ctx, cmd, started);
    if (replay?.kind === "replay") return respostaRepetida(ctx, op, replay);
    if (triggerCode(error, ["estoque_insuficiente"])) {
      return conflitoComDados(
        ctx,
        "estoque_insuficiente",
        "Não há estoque disponível para todos os itens. Nada foi reservado nem alterado.",
        { faltas: await faltas(ctx, isNew ? null : saleId, montados) },
      );
    }
    triggerConflict(error, MENSAGENS);
  }
  return json(
    { venda: await carregarVenda(ctx, op.systemId, saleId) },
    { status: isNew ? 201 : 200 },
  );
}

// ---- Rotas ----

export const listarVendas: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "vendas");
  const status = filtroDaQuery(ctx.url, "status", STATUS);
  const { results } = await ctx.env.DB.prepare(
    `${SELECT_VENDA} WHERE s.system_id = ?1 AND (?2 IS NULL OR s.status = ?2)
     ORDER BY s.created_at DESC LIMIT 200`,
  )
    .bind(op.systemId, status)
    .all<VendaRow>();
  const now = ctx.clock.now();
  return json({ vendas: results.map((row) => publicVenda(row, [], now)) });
};

export const obterVenda: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "vendas");
  const id = ctx.params.id ?? "";
  // RES-04: consultar não renova o prazo (só leitura).
  const venda = await carregarVenda(ctx, op.systemId, id);
  const servicos = op.config.modulos.includes("agenda")
    ? await atendimentosDaVenda(ctx, op.systemId, id)
    : [];
  return json({ venda, servicos });
};

/** RES-01: cria o rascunho já reservando o estoque; condições comerciais copiadas agora (PRE-06). */
export const criarVenda: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "vendas");
  const body = parse(CriarBody, await readJson(ctx.request));
  const cmd = { scope: op.systemId, actorId: op.user.id, command: "venda.create", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return respostaRepetida(ctx, op, started);

  const cliente = await ctx.env.DB.prepare(
    "SELECT status FROM customers WHERE id = ? AND system_id = ?",
  )
    .bind(body.cliente, op.systemId)
    .first<{ status: string }>();
  if (!cliente) throw validationFailed("Cliente não encontrado neste sistema.");
  if (cliente.status !== "active") throw conflict(MENSAGENS.cliente_inativo);
  const extra = camposValidos(op.config, "vendas", body.campos);

  const now = ctx.clock.now();
  const limite = limiteAtacado(op.config);
  const minutos = prazoReserva(op.config);
  const expiresAt = now + minutos * 60_000;
  const montados = await montarItens(ctx, op.config, op.systemId, body.itens, [], now);
  const totais = calcularTotais(
    montados.map((m) => ({
      unidades: m.unidades,
      varejoCentavos: m.varejo,
      atacadoCentavos: m.atacado,
    })),
    limite,
  );
  const id = crypto.randomUUID();
  const db = ctx.env.DB;
  return executarGravacao(ctx, op, cmd, started, id, true, montados, [
    db
      .prepare(
        `INSERT INTO sales
           (id, system_id, customer_id, model_version_id, wholesale_threshold_cents, reservation_minutes,
            expires_at, subtotal_retail_cents, total_cents, price_tier, extra_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        op.systemId,
        body.cliente,
        op.versionId,
        limite,
        minutos,
        expiresAt,
        totais.subtotalVarejoCentavos,
        totais.totalCentavos,
        totais.faixa,
        extra,
        op.user.id,
        now,
        now,
      ),
    ...gravarItensEReservas(db, id, op.systemId, montados, totais.linhas, now, expiresAt),
    db
      .prepare(
        "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'venda.draft_saved', 'venda', ?, ?)",
      )
      .bind(op.systemId, op.user.id, id, now),
    recordStatement(ctx, cmd, started, id, 201, now),
  ]);
};

/**
 * RES-03/RES-06: regrava os itens do rascunho (também para retomar um vencido). A revisão
 * enviada tem de ser a atual; o limite de atacado continua o da criação (PRE-06).
 */
export const salvarItens: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "vendas");
  const id = ctx.params.id ?? "";
  const body = parse(SalvarBody, await readJson(ctx.request));
  const cmd = { scope: op.systemId, actorId: op.user.id, command: `venda.save:${id}`, body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return respostaRepetida(ctx, op, started);

  const venda = await carregarVendaRow(ctx, op.systemId, id);
  if (venda.status !== "draft" || venda.revision !== body.revisao) {
    // Repetição da mesma chave que perdeu a corrida: a vencedora já avançou a revisão.
    const replay = await replayAfterRace(ctx, cmd, started);
    if (replay?.kind === "replay") return respostaRepetida(ctx, op, replay);
    throw conflict(
      venda.status !== "draft" ? MENSAGENS.venda_nao_editavel : MENSAGENS.venda_alterada,
    );
  }

  const now = ctx.clock.now();
  const expiresAt = now + venda.reservation_minutes * 60_000;
  const montados = await montarItens(
    ctx,
    op.config,
    op.systemId,
    body.itens,
    await carregarItens(ctx, id),
    now,
  );
  const totais = calcularTotais(
    montados.map((m) => ({
      unidades: m.unidades,
      varejoCentavos: m.varejo,
      atacadoCentavos: m.atacado,
    })),
    venda.wholesale_threshold_cents,
  );
  const db = ctx.env.DB;
  return executarGravacao(ctx, op, cmd, started, id, false, montados, [
    // O trigger sales_revision_check recusa se outra gravação passou na frente.
    db
      .prepare(
        `UPDATE sales SET revision = ?, expires_at = ?, subtotal_retail_cents = ?, total_cents = ?,
           price_tier = ?, updated_at = max(updated_at, ?) WHERE id = ? AND system_id = ?`,
      )
      .bind(
        body.revisao + 1,
        expiresAt,
        totais.subtotalVarejoCentavos,
        totais.totalCentavos,
        totais.faixa,
        now,
        id,
        op.systemId,
      ),
    ...gravarItensEReservas(db, id, op.systemId, montados, totais.linhas, now, expiresAt),
    db
      .prepare(
        "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'venda.draft_saved', 'venda', ?, ?)",
      )
      .bind(op.systemId, op.user.id, id, now),
    recordStatement(ctx, cmd, started, id, 200, now),
  ]);
};

/** RES-07: descartar libera a reserva na hora. Repetir é inofensivo. */
export const descartarVenda: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "vendas");
  const id = ctx.params.id ?? "";
  const venda = await carregarVendaRow(ctx, op.systemId, id);
  if (venda.status === "discarded")
    return json({ venda: await carregarVenda(ctx, op.systemId, id) });
  if (venda.status !== "draft") {
    throw conflict("Venda concluída não é descartada; use o cancelamento.");
  }
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  await db.batch([
    db
      .prepare(
        "UPDATE sales SET status = 'discarded', discarded_at = ?, updated_at = max(updated_at, ?) WHERE id = ? AND system_id = ? AND status = 'draft'",
      )
      .bind(now, now, id, op.systemId),
    db
      .prepare(
        "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) SELECT ?, ?, 'venda.discarded', 'venda', ?, ? WHERE changes() = 1",
      )
      .bind(op.systemId, op.user.id, id, now),
  ]);
  const depois = await carregarVenda(ctx, op.systemId, id);
  if (depois.status !== "discarded") throw conflict("A venda foi concluída antes do descarte.");
  return json({ venda: depois });
};

/** RES-08 / T21: concluir baixa o físico e encerra a reserva uma única vez. */
export const concluirVenda: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "vendas");
  const id = ctx.params.id ?? "";
  const { revisao, formaPagamento } = parse(ConcluirBody, await readJson(ctx.request));
  const venda = await carregarVendaRow(ctx, op.systemId, id);
  if (venda.status === "completed")
    return json({ venda: await carregarVenda(ctx, op.systemId, id) });
  if (venda.status !== "draft") throw conflict("Só um rascunho pode ser concluído.");
  const now = ctx.clock.now();
  if (venda.expires_at <= now)
    throw new AppError(409, "reserva_expirada", MENSAGENS.reserva_expirada);
  if (venda.revision !== revisao) throw conflict(MENSAGENS.venda_alterada);
  const minimo = conferirPedidoMinimo(op.config, venda.total_cents);
  if (minimo) throw new AppError(409, minimo.code, minimo.message);
  const pagamento = conferirFormaPagamento(op.config, formaPagamento);
  if ("code" in pagamento) throw new AppError(422, pagamento.code, pagamento.message);

  const db = ctx.env.DB;
  // Venda a prazo com o financeiro gera a conta a receber no mesmo lote (ADR-006).
  const conta =
    pagamento.forma === "a_prazo" && op.config.modulos.includes("financeiro")
      ? db
          .prepare(
            `INSERT INTO financial_entries (id, system_id, kind, description, amount_cents, due_date,
               sale_id, customer_id, created_by, created_at, updated_at)
             SELECT ?, system_id, 'receber', substr('Venda a prazo — ' || ?, 1, 200), total_cents, ?,
               id, customer_id, ?, ?, ? FROM sales WHERE id = ? AND status = 'completed'`,
          )
          .bind(
            crypto.randomUUID(),
            venda.customer_name,
            vencimentoEmDias(now, pagamento.prazoDias),
            op.user.id,
            now,
            now,
            id,
          )
      : null;
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE sales SET status = 'completed', completed_at = ?, completed_by = ?, revision = ?,
             payment_method = ?, updated_at = max(updated_at, ?)
           WHERE id = ? AND system_id = ? AND status = 'draft'`,
        )
        .bind(now, op.user.id, revisao + 1, pagamento.forma, now, id, op.systemId),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) SELECT ?, ?, 'venda.completed', 'venda', ?, ? WHERE changes() = 1",
        )
        .bind(op.systemId, op.user.id, id, now),
      ...(conta ? [conta] : []),
    ]);
  } catch (error) {
    triggerConflict(error, MENSAGENS);
  }
  const depois = await carregarVenda(ctx, op.systemId, id);
  if (depois.status !== "completed") throw conflict("A venda não pôde ser concluída. Recarregue.");
  return json({ venda: depois });
};

/**
 * CAN-01/CAN-02/CAN-06: cancelar a venda concluída devolve o estoque uma vez e guarda motivo,
 * ator e data. CAN-04: serviços vinculados não iniciados pedem confirmação e são cancelados no
 * mesmo lote; CAN-05: serviço já iniciado bloqueia o cancelamento.
 */
export const cancelarVenda: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "vendas");
  const id = ctx.params.id ?? "";
  const body = parse(CancelarBody, await readJson(ctx.request));
  const venda = await carregarVendaRow(ctx, op.systemId, id);
  if (venda.status === "cancelled") {
    return json({ venda: await carregarVenda(ctx, op.systemId, id), jaCancelada: true });
  }
  if (venda.status !== "completed") {
    throw conflict("Só venda concluída é cancelada; um rascunho é descartado.");
  }
  const prazoCancelar = conferirPrazoCancelamentoVenda(
    op.config,
    venda.completed_at ?? 0,
    ctx.clock.now(),
  );
  if (prazoCancelar) throw new AppError(409, prazoCancelar.code, prazoCancelar.message);

  const servicos: AtendimentoDto[] = op.config.modulos.includes("agenda")
    ? (await atendimentosDaVenda(ctx, op.systemId, id)).filter((a) => a.status !== "cancelled")
    : [];
  const iniciados = servicos.filter((a) => a.status === "in_progress" || a.status === "done");
  if (iniciados.length > 0) {
    return conflitoComDados(
      ctx,
      "servico_iniciado",
      "Um serviço vinculado já foi iniciado: a venda não pode ser cancelada (CAN-05).",
      { servicos: iniciados },
    );
  }
  const prazoServicos = servicos.length
    ? conferirPrazoCancelamentoAtendimento(
        op.config,
        Math.min(...servicos.map((a) => a.inicio)),
        ctx.clock.now(),
      )
    : null;
  if (prazoServicos) throw new AppError(409, prazoServicos.code, prazoServicos.message);
  if (servicos.length > 0 && !body.cancelarServicos) {
    return conflitoComDados(
      ctx,
      "confirmar_servicos",
      "Esta venda tem serviços agendados. Confirme para cancelar a venda e os serviços juntos.",
      { servicos },
    );
  }

  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE appointments SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?,
             updated_at = max(updated_at, ?) WHERE sale_id = ? AND system_id = ? AND status = 'scheduled'`,
        )
        .bind(now, op.user.id, body.motivo, now, id, op.systemId),
      db
        .prepare(
          `UPDATE sales SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?,
             updated_at = max(updated_at, ?) WHERE id = ? AND system_id = ? AND status = 'completed'`,
        )
        .bind(now, op.user.id, body.motivo, now, id, op.systemId),
      db
        .prepare(
          `INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at)
           SELECT ?, ?, 'venda.cancelled', 'venda', ?, json_object('motivo', ?, 'servicos', ?), ? WHERE changes() = 1`,
        )
        .bind(op.systemId, op.user.id, id, body.motivo, servicos.length, now),
    ]);
  } catch (error) {
    triggerConflict(error, MENSAGENS);
  }
  const depois = await carregarVenda(ctx, op.systemId, id);
  if (depois.status !== "cancelled") throw conflict("A venda não pôde ser cancelada. Recarregue.");
  // Cancelamento concorrente: o outro pedido fez o estorno; este só informa (CAN-02).
  return json({ venda: depois });
};
