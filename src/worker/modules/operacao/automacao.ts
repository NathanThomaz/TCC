import { z } from "zod";
import type { ImportacaoDto, VendaInterpretadaDto } from "../../../shared/api";
import { readJson } from "../../http/body";
import { AppError, notFound, validationFailed } from "../../http/errors";
import { beginIdempotent, recordStatement, replayAfterRace } from "../../http/idempotency";
import { json } from "../../http/responses";
import type { Handler, RequestContext } from "../../http/router";
import { chamarComOrcamento, iaNaoConfigurada, liberarChave } from "../../ia/orcamento";
import {
  instrucoesVendaDitada,
  vendaDitadaGeminiSchema,
  VendaDitadaSchema,
  type VendaDitada,
} from "../../ia/prompts";
import { isUnique, parse } from "../comum";
import { codigoBarras, codigoEmUso, codigoRepetido, precosDoProduto } from "./cadastros";
import { abrirOperacao, type Operacao } from "./contexto";

// Menos digitação nas vendas (pedido do dono, 2026-11-14): venda ditada ou escrita (a IA só liga
// o texto aos cadastros; a pessoa confere e salva pelo caminho normal), repetir a última compra
// do cliente e importar produtos e clientes de uma planilha.

/** Até quantos cadastros vão para a IA na venda ditada (o resto fica de fora da lista). */
const MAX_LISTA = 400;

// ---- Venda ditada ----

const TextoBody = z.object({ texto: z.string().trim().min(3).max(1000) });

/** Formas de pagamento que o sistema aceita (módulo pagamentos); vazio sem o módulo. */
function formasAceitas(op: Operacao): readonly string[] {
  if (!op.config.modulos.includes("pagamentos")) return [];
  const regra = op.config.regras.find(
    (r): r is Extract<typeof r, { tipo: "formas_pagamento" }> => r.tipo === "formas_pagamento",
  );
  return regra?.formas ?? [];
}

export const interpretarVenda: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "vendas");
  const { texto } = parse(TextoBody, await readJson(ctx.request));
  if (!ctx.ia) throw iaNaoConfigurada();
  const db = ctx.env.DB;
  const [produtos, clientes] = await db.batch([
    db
      .prepare(
        `SELECT id, name, units_per_box FROM products WHERE system_id = ? AND status = 'active'
         ORDER BY name COLLATE NOCASE LIMIT ${MAX_LISTA}`,
      )
      .bind(op.systemId),
    db
      .prepare(
        `SELECT id, name FROM customers WHERE system_id = ? AND status = 'active'
         ORDER BY name COLLATE NOCASE LIMIT ${MAX_LISTA}`,
      )
      .bind(op.systemId),
  ]);
  const listaP = (produtos?.results ?? []) as {
    id: string;
    name: string;
    units_per_box: number | null;
  }[];
  const listaC = (clientes?.results ?? []) as { id: string; name: string }[];
  const formas = formasAceitas(op);

  const resposta = await chamarComOrcamento(
    ctx,
    ctx.ia,
    {
      sistema: op.systemId,
      usuario: op.user.id,
      conta: op.user.adminId,
      finalidade: "consulta",
      chave: ctx.request.headers.get("idempotency-key") ?? crypto.randomUUID(),
    },
    {
      instrucoes: instrucoesVendaDitada(
        op.config.aparencia.nome,
        listaP.map((p) => ({ nome: p.name, caixa: p.units_per_box })),
        listaC.map((c) => c.name),
        formas,
      ),
      mensagens: [{ papel: "usuario", texto }],
      schema: vendaDitadaGeminiSchema(),
    },
  );
  // Nada é gravado com o resultado: a chave fica livre para a pessoa tentar de novo.
  await liberarChave(ctx, resposta.usoId);
  let ia: VendaDitada;
  try {
    ia = VendaDitadaSchema.parse(JSON.parse(resposta.texto));
  } catch {
    throw new AppError(
      502,
      "resposta_ia_invalida",
      "Não entendi a venda agora. Tente escrever de outro jeito.",
    );
  }
  return json({ venda: montarProposta(ia, listaP, listaC, formas) });
};

/** Confere os números que a IA escolheu contra os cadastros e junta itens repetidos. */
export function montarProposta(
  ia: VendaDitada,
  produtos: { id: string; name: string; units_per_box: number | null }[],
  clientes: { id: string; name: string }[],
  formas: readonly string[],
): VendaInterpretadaDto {
  const naoEncontrados: string[] = [];
  const cliente = ia.cliente === null ? undefined : clientes[ia.cliente - 1];
  if (ia.cliente !== null && !cliente) naoEncontrados.push("cliente citado");
  if (ia.cliente_nao_encontrado) naoEncontrados.push(`cliente "${ia.cliente_nao_encontrado}"`);
  const itens = new Map<string, VendaInterpretadaDto["itens"][number]>();
  for (const item of ia.itens) {
    const p = item.produto === null ? undefined : produtos[item.produto - 1];
    if (!p) {
      naoEncontrados.push(item.texto);
      continue;
    }
    // Caixa só para produto com caixa; sem ela, a caixa vira unidades não dá: avisa.
    if (item.caixas > 0 && p.units_per_box === null) {
      naoEncontrados.push(`${item.texto} (este produto não tem caixa)`);
      continue;
    }
    const caixas = item.caixas;
    const unidades = item.caixas === 0 && item.unidades === 0 ? 1 : item.unidades;
    const atual = itens.get(p.id);
    itens.set(p.id, {
      produto: p.id,
      nome: p.name,
      caixas: (atual?.caixas ?? 0) + caixas,
      unidades: (atual?.unidades ?? 0) + unidades,
    });
  }
  const forma =
    ia.forma_pagamento && formas.includes(ia.forma_pagamento) ? ia.forma_pagamento : null;
  return {
    cliente: cliente ? { id: cliente.id, nome: cliente.name } : null,
    itens: [...itens.values()],
    formaPagamento: forma,
    naoEncontrados,
  };
}

// ---- Última compra do cliente ----

export const ultimaCompra: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "vendas");
  const cliente = ctx.params.id ?? "";
  const db = ctx.env.DB;
  const existe = await db
    .prepare("SELECT 1 FROM customers WHERE id = ? AND system_id = ?")
    .bind(cliente, op.systemId)
    .first();
  if (!existe) throw notFound();
  const venda = await db
    .prepare(
      `SELECT id, completed_at FROM sales WHERE system_id = ? AND customer_id = ? AND status = 'completed'
       ORDER BY completed_at DESC, rowid DESC LIMIT 1`,
    )
    .bind(op.systemId, cliente)
    .first<{ id: string; completed_at: number }>();
  if (!venda) return json({ ultima: null });
  // Só os produtos que ainda estão ativos; os preços são os de hoje (a venda nova recalcula).
  const { results } = await db
    .prepare(
      `SELECT i.product_id AS produto, p.name AS nome, i.boxes AS caixas, i.loose_units AS unidades
       FROM sale_items i JOIN products p ON p.id = i.product_id
       WHERE i.sale_id = ? AND p.status = 'active' ORDER BY i.position`,
    )
    .bind(venda.id)
    .all<{ produto: string; nome: string; caixas: number; unidades: number }>();
  return json({ ultima: { concluidaEm: venda.completed_at, itens: results } });
};

// ---- Importar de planilha ----

/** Linhas por envio: o lote do D1 grava tudo ou nada. */
export const MAX_IMPORTACAO = 200;

const centavos = z.number().int().min(1).max(100_000_000);
const LinhaProduto = z.object({
  nome: z.string().trim().min(1).max(120),
  varejoCentavos: centavos,
  atacadoCentavos: centavos.nullable().optional(),
  unidadesPorCaixa: z.number().int().min(2).max(1000).nullable().optional(),
  estoque: z.number().int().min(0).max(1_000_000).nullable().optional(),
  estoqueMinimo: z.number().int().min(1).max(1_000_000).nullable().optional(),
  codigoBarras: codigoBarras.nullable().optional(),
});
const ImportarProdutosBody = z.object({ linhas: z.array(LinhaProduto).min(1).max(MAX_IMPORTACAO) });
const ImportarClientesBody = z.object({
  linhas: z
    .array(z.object({ nome: z.string().trim().min(1).max(120) }))
    .min(1)
    .max(MAX_IMPORTACAO),
});

const chaveNome = (nome: string) => nome.trim().toLocaleLowerCase("pt-BR");

/** Nomes que já existem na tabela (comparação sem diferenciar maiúsculas). */
async function nomesExistentes(
  ctx: RequestContext,
  tabela: "products" | "customers",
  systemId: string,
) {
  const { results } = await ctx.env.DB.prepare(`SELECT name FROM ${tabela} WHERE system_id = ?`)
    .bind(systemId)
    .all<{ name: string }>();
  return new Set(results.map((r) => chaveNome(r.name)));
}

async function respostaImportacao(
  ctx: RequestContext,
  systemId: string,
  comando: string,
  status: number,
) {
  const row = await ctx.env.DB.prepare(
    `SELECT details_json FROM audit_events WHERE system_id = ? AND action = ?
     ORDER BY id DESC LIMIT 1`,
  )
    .bind(systemId, comando)
    .first<{ details_json: string }>();
  const d = row ? (JSON.parse(row.details_json) as { criados?: number }) : {};
  const body: ImportacaoDto = { criados: d.criados ?? 0, ignorados: [] };
  return json({ importacao: body }, { status });
}

export const importarProdutos: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "produtos");
  const { linhas } = parse(ImportarProdutosBody, await readJson(ctx.request));
  const cmd = {
    scope: op.systemId,
    actorId: op.user.id,
    command: "produto.importar",
    body: { linhas },
  };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    return respostaImportacao(ctx, op.systemId, "produto.importados", started.statusCode);
  }
  const temEstoque = op.config.modulos.includes("estoque");
  // Cada linha passa pelas mesmas regras do cadastro; um erro recusa tudo, com a linha.
  const erros: string[] = [];
  linhas.forEach((l, i) => {
    try {
      precosDoProduto(op.config, l);
    } catch (e) {
      erros.push(`Linha ${i + 1} (${l.nome}): ${e instanceof Error ? e.message : "inválida"}`);
    }
    if (!temEstoque && (l.estoque || l.estoqueMinimo)) {
      erros.push(`Linha ${i + 1} (${l.nome}): este sistema não controla estoque.`);
    }
  });
  const codigos = linhas.map((l) => l.codigoBarras).filter((c): c is string => !!c);
  if (new Set(codigos).size !== codigos.length)
    erros.push("Há códigos de barras repetidos na planilha.");
  if (erros.length) throw validationFailed(erros.slice(0, 10).join(" "), { erros });

  const existentes = await nomesExistentes(ctx, "products", op.systemId);
  const vistos = new Set<string>();
  const ignorados: string[] = [];
  const novas = linhas.filter((l) => {
    const k = chaveNome(l.nome);
    if (existentes.has(k) || vistos.has(k)) {
      ignorados.push(l.nome);
      return false;
    }
    vistos.add(k);
    return true;
  });
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  const instrucoes: D1PreparedStatement[] = [];
  for (const l of novas) {
    const id = crypto.randomUUID();
    instrucoes.push(
      db
        .prepare(
          `INSERT INTO products (id, system_id, name, retail_cents, wholesale_cents, units_per_box, min_units, barcode, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          op.systemId,
          l.nome,
          l.varejoCentavos,
          l.atacadoCentavos ?? null,
          l.unidadesPorCaixa ?? null,
          l.estoqueMinimo ?? null,
          l.codigoBarras || null,
          op.user.id,
          now,
          now,
        ),
    );
    // Estoque da planilha entra como a primeira entrada, com histórico (EST-01).
    if (l.estoque) {
      instrucoes.push(
        db.prepare("UPDATE products SET physical = physical + ? WHERE id = ?").bind(l.estoque, id),
        db
          .prepare(
            `INSERT INTO stock_movements
               (id, system_id, product_id, kind, delta, informed_units, balance_after, reason, actor_id, created_at)
             SELECT ?, system_id, id, 'entrada', ?, ?, physical, 'Estoque inicial (planilha)', ?, ? FROM products
             WHERE id = ?`,
          )
          .bind(crypto.randomUUID(), l.estoque, l.estoque, op.user.id, now, id),
      );
    }
  }
  try {
    await db.batch([
      ...instrucoes,
      db
        .prepare(
          `INSERT INTO audit_events (system_id, actor_id, action, target_type, details_json, created_at)
           VALUES (?, ?, 'produto.importados', 'produto', json_object('criados', ?, 'ignorados', ?), ?)`,
        )
        .bind(op.systemId, op.user.id, novas.length, ignorados.length, now),
      recordStatement(ctx, cmd, started, op.systemId, 201, now),
    ]);
  } catch (error) {
    if (codigoRepetido(error)) throw codigoEmUso();
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind === "replay") {
      return respostaImportacao(ctx, op.systemId, "produto.importados", replay.statusCode);
    }
    throw error;
  }
  const body: ImportacaoDto = { criados: novas.length, ignorados };
  return json({ importacao: body }, { status: 201 });
};

export const importarClientes: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "clientes");
  const { linhas } = parse(ImportarClientesBody, await readJson(ctx.request));
  const cmd = {
    scope: op.systemId,
    actorId: op.user.id,
    command: "cliente.importar",
    body: { linhas },
  };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    return respostaImportacao(ctx, op.systemId, "cliente.importados", started.statusCode);
  }
  const existentes = await nomesExistentes(ctx, "customers", op.systemId);
  const vistos = new Set<string>();
  const ignorados: string[] = [];
  const novas = linhas.filter((l) => {
    const k = chaveNome(l.nome);
    if (existentes.has(k) || vistos.has(k)) {
      ignorados.push(l.nome);
      return false;
    }
    vistos.add(k);
    return true;
  });
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    await db.batch([
      ...novas.map((l) =>
        db
          .prepare(
            "INSERT INTO customers (id, system_id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(crypto.randomUUID(), op.systemId, l.nome, op.user.id, now, now),
      ),
      db
        .prepare(
          `INSERT INTO audit_events (system_id, actor_id, action, target_type, details_json, created_at)
           VALUES (?, ?, 'cliente.importados', 'cliente', json_object('criados', ?, 'ignorados', ?), ?)`,
        )
        .bind(op.systemId, op.user.id, novas.length, ignorados.length, now),
      recordStatement(ctx, cmd, started, op.systemId, 201, now),
    ]);
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind === "replay") {
      return respostaImportacao(ctx, op.systemId, "cliente.importados", replay.statusCode);
    }
    throw error;
  }
  const body: ImportacaoDto = { criados: novas.length, ignorados };
  return json({ importacao: body }, { status: 201 });
};
