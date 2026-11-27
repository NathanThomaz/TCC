import type { ModuleId } from "../../../shared/contract/catalog";
import { MODULE_INFO, PAYMENT_LABELS } from "../../../shared/contract/catalog";
import type { ConfigDraft } from "../../../shared/contract/schema";
import { deCampoLocal, formatarDataHora, paraCampoLocal } from "../../../shared/dominio/agenda";
import { formatarCentavos } from "../../../shared/dominio/precos";
import { regraDo } from "../../../shared/dominio/regras";
import type { RequestContext } from "../../http/router";
import { nomeClienteSql } from "../comum";
import type { Consulta } from "../../ia/prompts";
import type { Operacao } from "./contexto";
import { hojeLocal } from "./financeiro";
import { calcularPainel } from "./painel";

// Respostas do chat de consulta para os demais módulos (pedido do dono, 2026-11-13): resumo
// geral, clientes, produtos, mais vendidos, formas de pagamento, compras e fornecedores,
// financeiro, profissionais, regras e "como usar". Mesma regra da seção 15: a IA só classifica e
// extrai argumentos; os números saem daqui, de SQL parametrizado e somente leitura.

export interface Resposta {
  texto: string;
  filtros: string[];
  origem: string;
}

const LISTA = 15;

/** Letras acentuadas do português e a letra base (para a busca no SQL). */
const ACENTOS: [string, string][] = [
  ..."áàâãä".split("").map((l): [string, string] => [l, "a"]),
  ..."éèêë".split("").map((l): [string, string] => [l, "e"]),
  ..."íìîï".split("").map((l): [string, string] => [l, "i"]),
  ..."óòôõö".split("").map((l): [string, string] => [l, "o"]),
  ..."úùûü".split("").map((l): [string, string] => [l, "u"]),
  ["ç", "c"],
  ["ñ", "n"],
];

/**
 * Coluna em minúsculas e sem acento, em SQL. O lower() do SQLite só converte letras ASCII
 * ("Água" continuaria "Água"), então as acentuadas, maiúsculas e minúsculas, viram a letra base.
 */
export function semAcentoSql(coluna: string): string {
  // Acentos gravados como caractere separado (forma decomposta, "A" + U+0301) também saem.
  let sql = `lower(${coluna})`;
  for (const codigo of [0x300, 0x301, 0x302, 0x303, 0x308, 0x327]) {
    sql = `replace(${sql}, char(${codigo}), '')`;
  }
  for (const [acento, base] of ACENTOS) {
    sql = `replace(replace(${sql}, '${acento}', '${base}'), '${acento.toUpperCase()}', '${base}')`;
  }
  return sql;
}

/** O termo da pergunta no mesmo formato (minúsculas, sem acento). */
export const termoBusca = (t: string | null | undefined): string | null =>
  t
    ? t
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
    : null;

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const tem = (config: ConfigDraft, m: ModuleId) => config.modulos.includes(m);

export const semModulo = (nome: string): Resposta => ({
  texto: `Este sistema não tem o módulo de ${nome}, então não há o que consultar sobre isso.`,
  filtros: [],
  origem: "configuração ativa",
});

/**
 * Período da pergunta ou, sem ele, o mês corrente (dito nos filtros). Devolve o intervalo em ms
 * [de, ate) no fuso do Nexus e o texto do filtro.
 */
/** Data AAAA-MM-DD que existe no calendário (31/02 não vira 03/03). */
export function dataExiste(iso: string): boolean {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

export function periodoOuMes(
  c: Consulta,
  agora: number,
): { de: number; ate: number; texto: string; deIso: string; ateIso: string } | null {
  const hoje = paraCampoLocal(agora).slice(0, 10);
  const [ano, mes] = hoje.split("-").map(Number) as [number, number];
  const iso = (a: number, m: number, d: number) =>
    new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10);
  const deIso = c.periodo?.de ?? iso(ano, mes, 1);
  const ateIso = c.periodo?.ate ?? iso(ano, mes + 1, 0);
  if (!dataExiste(deIso) || !dataExiste(ateIso)) return null;
  const [a2, m2, d2] = ateIso.split("-").map(Number) as [number, number, number];
  const de = deCampoLocal(`${deIso}T00:00`);
  const ate = deCampoLocal(`${iso(a2, m2, d2 + 1)}T00:00`);
  if (de === null || ate === null || ate <= de || ate - de > 400 * 86_400_000) return null;
  const texto = c.periodo
    ? `Período: ${dataBr(deIso)} a ${dataBr(ateIso)} (horário de Brasília)`
    : `Período: este mês, ${dataBr(deIso)} a ${dataBr(ateIso)} (nenhum período foi citado)`;
  return { de, ate, texto, deIso, ateIso };
}

const periodoInvalido: Resposta = {
  texto: "Não entendi o período. Pode repetir as datas?",
  filtros: [],
  origem: "—",
};

/** "Como está meu negócio?": os números do painel do sistema, em texto. */
export async function resumoGeral(ctx: RequestContext, op: Operacao): Promise<Resposta> {
  const p = await calcularPainel(ctx.env.DB, op.systemId, op.config, ctx.clock.now());
  const linhas: string[] = [];
  if (p.vendas) {
    const ticket = p.vendas.mes.quantidade
      ? Math.round(p.vendas.mes.totalCentavos / p.vendas.mes.quantidade)
      : 0;
    linhas.push(
      `Vendas hoje: ${formatarCentavos(p.vendas.hoje.totalCentavos)} em ${plural(p.vendas.hoje.quantidade, "venda", "vendas")}.`,
      `Vendas no mês: ${formatarCentavos(p.vendas.mes.totalCentavos)} em ${plural(p.vendas.mes.quantidade, "venda", "vendas")} (ticket médio ${formatarCentavos(ticket)}); ${plural(p.vendas.canceladasNoMes, "cancelada", "canceladas")}.`,
      `Pedidos abertos segurando estoque: ${p.vendas.abertas}.`,
    );
  }
  if (p.clientes) {
    linhas.push(
      `Clientes ativos: ${p.clientes.ativos} (${plural(p.clientes.novosNoMes, "novo", "novos")} no mês).`,
    );
  }
  if (p.estoque) {
    const critico =
      p.estoque.abaixoDoMinimo === null
        ? `${plural(p.estoque.semEstoque, "produto sem estoque", "produtos sem estoque")}`
        : `${plural(p.estoque.abaixoDoMinimo, "produto abaixo do mínimo", "produtos abaixo do mínimo")}${p.estoque.minimo === null ? "" : ` (regra: ${p.estoque.minimo})`}`;
    linhas.push(
      `Estoque: ${plural(p.estoque.produtosAtivos, "produto ativo", "produtos ativos")}, ${critico}; valor a preço de varejo ${formatarCentavos(p.estoque.valorVarejoCentavos)}.`,
    );
  }
  if (p.agenda) {
    const h = p.agenda.hoje;
    linhas.push(
      `Agenda hoje: ${h.agendados + h.emAtendimento + h.concluidos} atendimentos (${h.emAtendimento} em andamento, ${h.concluidos} concluídos); próximos 7 dias: ${p.agenda.proximos7Dias}.`,
    );
  }
  if (p.financeiro) {
    const f = p.financeiro;
    linhas.push(
      `Financeiro: a receber ${formatarCentavos(f.aReceber.totalCentavos)}, a pagar ${formatarCentavos(f.aPagar.totalCentavos)}; vencidas: ${f.vencidosReceber.quantidade + f.vencidosPagar.quantidade}.`,
    );
  }
  if (p.compras) {
    linhas.push(
      `Compras no mês: ${formatarCentavos(p.compras.noMes.totalCentavos)} em ${plural(p.compras.noMes.quantidade, "compra", "compras")}.`,
    );
  }
  return {
    texto: linhas.length ? linhas.join("\n") : "Ainda não há movimento neste sistema.",
    filtros: [`Hoje: ${dataBr(p.hoje)}`, "Mês corrente"],
    origem: "mesmos números do painel do sistema",
  };
}

/** Clientes: um cliente citado (compras no período, total, última compra) ou os que mais compraram. */
export async function clientes(ctx: RequestContext, op: Operacao, c: Consulta): Promise<Resposta> {
  if (!tem(op.config, "clientes")) return semModulo("clientes");
  const db = ctx.env.DB;
  const vendas = tem(op.config, "vendas");
  const situacao = (status: string) => (status === "active" ? "ativo" : "inativo");
  if (c.cliente && !vendas) {
    // Sem o módulo de vendas, só o cadastro (nenhuma consulta às vendas).
    const { results } = await db
      .prepare(
        `SELECT ${nomeClienteSql("customers")} AS name, status FROM customers
         WHERE system_id = ?1 AND instr(${semAcentoSql(nomeClienteSql("customers"))}, ?2) > 0
         ORDER BY name COLLATE NOCASE LIMIT ${LISTA}`,
      )
      .bind(op.systemId, termoBusca(c.cliente))
      .all<{ name: string; status: string }>();
    return {
      texto: results.length
        ? results.map((r) => `${r.name} (${situacao(r.status)})`).join("\n")
        : `Nenhum cliente com “${c.cliente}” no nome.`,
      filtros: [`Cliente: contém “${c.cliente}”`],
      origem: "cadastro de clientes",
    };
  }
  if (c.cliente) {
    const per = periodoOuMes(c, ctx.clock.now());
    if (!per) return periodoInvalido;
    const { results } = await db
      .prepare(
        `SELECT ${nomeClienteSql("c")} AS name, c.status,
           (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id AND s.status = 'completed'
              AND s.completed_at >= ?3 AND s.completed_at < ?4) AS n,
           (SELECT COALESCE(SUM(total_cents), 0) FROM sales s WHERE s.customer_id = c.id
              AND s.status = 'completed' AND s.completed_at >= ?3 AND s.completed_at < ?4) AS total,
           (SELECT MAX(completed_at) FROM sales s WHERE s.customer_id = c.id AND s.status = 'completed') AS ultima
         FROM customers c WHERE c.system_id = ?1 AND instr(${semAcentoSql(nomeClienteSql("c"))}, ?2) > 0
         ORDER BY name COLLATE NOCASE LIMIT ${LISTA}`,
      )
      .bind(op.systemId, termoBusca(c.cliente), per.de, per.ate)
      .all<{ name: string; status: string; n: number; total: number; ultima: number | null }>();
    return {
      texto: results.length
        ? results
            .map(
              (r) =>
                `${r.name} (${situacao(r.status)}): ${plural(r.n, "compra", "compras")} no período, total ${formatarCentavos(r.total)}` +
                (r.ultima
                  ? `; última compra (em qualquer data) em ${formatarDataHora(r.ultima).slice(0, 10)}`
                  : ""),
            )
            .join("\n")
        : `Nenhum cliente com “${c.cliente}” no nome.`,
      filtros: [`Cliente: contém “${c.cliente}”`, per.texto],
      origem: "cadastro de clientes e vendas concluídas (sem canceladas)",
    };
  }
  const contagem = await db
    .prepare(
      "SELECT SUM(status = 'active') AS a, SUM(status = 'inactive') AS i FROM customers WHERE system_id = ?",
    )
    .bind(op.systemId)
    .first<{ a: number | null; i: number | null }>();
  const base = `Clientes ativos: ${contagem?.a ?? 0}; inativos: ${contagem?.i ?? 0}.`;
  if (!vendas) {
    return { texto: base, filtros: [], origem: "cadastro de clientes" };
  }
  const per = periodoOuMes(c, ctx.clock.now());
  if (!per) return periodoInvalido;
  const { results } = await db
    .prepare(
      `SELECT ${nomeClienteSql("c")} AS name, COUNT(*) AS n, SUM(s.total_cents) AS total FROM sales s
       JOIN customers c ON c.id = s.customer_id AND c.system_id = s.system_id
       WHERE s.system_id = ? AND s.status = 'completed' AND s.completed_at >= ? AND s.completed_at < ?
       GROUP BY c.id ORDER BY total DESC LIMIT 5`,
    )
    .bind(op.systemId, per.de, per.ate)
    .all<{ name: string; n: number; total: number }>();
  return {
    texto:
      base +
      (results.length
        ? `\nQuem mais comprou:\n${results.map((r, i) => `${i + 1}. ${r.name}: ${formatarCentavos(r.total)} em ${plural(r.n, "compra", "compras")}`).join("\n")}`
        : "\nNenhuma venda concluída no período."),
    filtros: [per.texto],
    origem: "cadastro de clientes e vendas concluídas (sem canceladas)",
  };
}

/** Produtos: preços de varejo e atacado, custo da última compra e margem. */
export async function produtos(ctx: RequestContext, op: Operacao, c: Consulta): Promise<Resposta> {
  if (!tem(op.config, "produtos")) return semModulo("produtos");
  const { results } = await ctx.env.DB.prepare(
    `SELECT name, retail_cents, wholesale_cents, units_per_box,
       COALESCE(last_cost_cents, cost_cents) AS last_cost_cents FROM products
     WHERE system_id = ?1 AND status = 'active' AND (?2 IS NULL OR instr(${semAcentoSql("name")}, ?2) > 0)
     ORDER BY name COLLATE NOCASE LIMIT ${LISTA + 1}`,
  )
    .bind(op.systemId, termoBusca(c.produto))
    .all<{
      name: string;
      retail_cents: number;
      wholesale_cents: number | null;
      units_per_box: number | null;
      last_cost_cents: number | null;
    }>();
  const filtros = c.produto ? [`Produto: contém “${c.produto}”`] : ["Todos os produtos ativos"];
  if (!results.length) {
    return {
      texto: c.produto
        ? `Nenhum produto ativo com “${c.produto}” no nome.`
        : "Não há produtos ativos.",
      filtros,
      origem: "cadastro de produtos",
    };
  }
  const linhas = results.slice(0, LISTA).map((p) => {
    const partes = [`varejo ${formatarCentavos(p.retail_cents)}`];
    if (p.wholesale_cents !== null) partes.push(`atacado ${formatarCentavos(p.wholesale_cents)}`);
    if (p.units_per_box) partes.push(`caixa com ${p.units_per_box}`);
    if (p.last_cost_cents !== null) {
      const margem = Math.round(((p.retail_cents - p.last_cost_cents) / p.retail_cents) * 100);
      partes.push(`custo ${formatarCentavos(p.last_cost_cents)} (margem de ${margem}% no varejo)`);
    }
    return `${p.name}: ${partes.join(", ")}`;
  });
  return {
    texto:
      linhas.join("\n") +
      (results.length > LISTA
        ? `\n(Mostrando ${LISTA}; cite o nome do produto para filtrar.)`
        : ""),
    filtros,
    origem: "cadastro de produtos (custo = última compra registrada)",
  };
}

/** Produtos mais vendidos no período (unidades e valor), sem vendas canceladas. */
export async function maisVendidos(
  ctx: RequestContext,
  op: Operacao,
  c: Consulta,
): Promise<Resposta> {
  if (!tem(op.config, "vendas")) return semModulo("vendas");
  const per = periodoOuMes(c, ctx.clock.now());
  if (!per) return periodoInvalido;
  const { results } = await ctx.env.DB.prepare(
    `SELECT p.name AS nome, SUM(i.units) AS unidades, SUM(i.line_total_cents) AS total
     FROM sale_items i JOIN sales s ON s.id = i.sale_id JOIN products p ON p.id = i.product_id
     WHERE s.system_id = ? AND s.status = 'completed' AND s.completed_at >= ? AND s.completed_at < ?
     GROUP BY i.product_id ORDER BY unidades DESC, total DESC LIMIT 10`,
  )
    .bind(op.systemId, per.de, per.ate)
    .all<{ nome: string; unidades: number; total: number }>();
  return {
    texto: results.length
      ? results
          .map(
            (r, i) => `${i + 1}. ${r.nome}: ${r.unidades} unidades, ${formatarCentavos(r.total)}`,
          )
          .join("\n")
      : "Nenhuma venda concluída no período.",
    filtros: [per.texto],
    origem: "itens de vendas concluídas (sem canceladas)",
  };
}

/** Vendas por forma de pagamento no período. */
export async function pagamentos(
  ctx: RequestContext,
  op: Operacao,
  c: Consulta,
): Promise<Resposta> {
  if (!tem(op.config, "pagamentos")) return semModulo("formas de pagamento");
  const per = periodoOuMes(c, ctx.clock.now());
  if (!per) return periodoInvalido;
  const { results } = await ctx.env.DB.prepare(
    `SELECT payment_method AS forma, COUNT(*) AS n, SUM(total_cents) AS total FROM sales
     WHERE system_id = ? AND status = 'completed' AND payment_method IS NOT NULL
       AND completed_at >= ? AND completed_at < ?
     GROUP BY payment_method ORDER BY n DESC, total DESC`,
  )
    .bind(op.systemId, per.de, per.ate)
    .all<{ forma: keyof typeof PAYMENT_LABELS; n: number; total: number }>();
  return {
    texto: results.length
      ? results
          .map(
            (r) =>
              `${PAYMENT_LABELS[r.forma]}: ${plural(r.n, "venda", "vendas")}, ${formatarCentavos(r.total)}`,
          )
          .join("\n")
      : "Nenhuma venda concluída com forma de pagamento no período.",
    filtros: [per.texto],
    origem: "vendas concluídas pela forma registrada na conclusão",
  };
}

/** Compras do período, por fornecedor (ou de um fornecedor citado). */
export async function compras(ctx: RequestContext, op: Operacao, c: Consulta): Promise<Resposta> {
  if (!tem(op.config, "fornecedores")) return semModulo("fornecedores e compras");
  const per = periodoOuMes(c, ctx.clock.now());
  if (!per) return periodoInvalido;
  const db = ctx.env.DB;
  const filtro = `FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.system_id = ?1 AND p.status = 'completed' AND p.created_at >= ?2 AND p.created_at < ?3
       AND (?4 IS NULL OR instr(${semAcentoSql("s.name")}, ?4) > 0)`;
  const args = [op.systemId, per.de, per.ate, termoBusca(c.fornecedor)] as const;
  // O total soma todas as compras do filtro; só a lista por fornecedor tem limite.
  const [soma, lista] = await db.batch([
    db.prepare(`SELECT COALESCE(SUM(p.total_cents), 0) AS total ${filtro}`).bind(...args),
    db
      .prepare(
        `SELECT s.name AS fornecedor, COUNT(*) AS n, SUM(p.total_cents) AS total ${filtro}
         GROUP BY s.id ORDER BY total DESC LIMIT ${LISTA + 1}`,
      )
      .bind(...args),
  ]);
  const total = Number((soma?.results[0] as { total?: number } | undefined)?.total ?? 0);
  const todos = (lista?.results ?? []) as { fornecedor: string; n: number; total: number }[];
  const mostrados = todos.slice(0, LISTA);
  const filtros = [per.texto, ...(c.fornecedor ? [`Fornecedor: contém “${c.fornecedor}”`] : [])];
  return {
    texto: mostrados.length
      ? `Total comprado: ${formatarCentavos(total)}.\n` +
        mostrados
          .map(
            (r) =>
              `${r.fornecedor}: ${plural(r.n, "compra", "compras")}, ${formatarCentavos(r.total)}`,
          )
          .join("\n") +
        (todos.length > LISTA ? `\n(Mostrando os ${LISTA} maiores fornecedores.)` : "")
      : "Nenhuma compra registrada no período.",
    filtros,
    origem: "compras concluídas (sem canceladas)",
  };
}

const DIA = 86_400_000;
/** Saída média calculada sobre os últimos 30 dias; a sugestão cobre 14 dias de saída. */
const DIAS_DE_SAIDA = 30;
const DIAS_DE_COBERTURA = 14;

export interface SaldoProduto {
  nome: string;
  fisico: number;
  reservado: number;
  disponivel: number;
  /** Mínimo do produto ou, sem ele, o da regra estoque_minimo. */
  minimo: number | null;
  /** Abaixo do mínimo ou, sem mínimo, sem estoque (mesmo critério do painel). */
  abaixo: boolean;
  unidadesPorCaixa: number | null;
  custoCentavos: number | null;
  /** Unidades que saíram nos últimos 30 dias (0 quando não foi pedido; ver saldosDoEstoque). */
  saida30: number;
}

/** Saldos de agora, mínimo, custo e saída dos últimos 30 dias de cada produto ativo. */
export async function saldosDoEstoque(
  ctx: RequestContext,
  op: Operacao,
  produto: string | null,
  comSaida = false,
): Promise<SaldoProduto[]> {
  const agora = ctx.clock.now();
  const minimoRegra = regraDo(op.config, "estoque_minimo")?.unidades ?? null;
  // Saída dos últimos 30 dias (só a reposição precisa; a consulta de estoque não paga o custo):
  // - vendas, menos os estornos de vendas feitas na própria janela (estorno de venda antiga não
  //   apaga a saída recente);
  // - saídas e correções de inventário em saldo líquido (uma baixa desfeita depois não conta);
  // - a correção do cancelamento de compra (purchase_id) só desfaz a entrada: não é consumo.
  // Cada parte é limitada a zero separadamente: uma correção para cima não apaga vendas.
  const parte = (caso: string) =>
    `max(0, (SELECT COALESCE(SUM(CASE ${caso} ELSE 0 END), 0) FROM stock_movements m
       WHERE m.system_id = p.system_id AND m.product_id = p.id AND m.created_at >= ?3))`;
  const saida = comSaida
    ? `(${parte(`WHEN m.kind = 'venda' THEN -m.delta
           WHEN m.kind = 'estorno' AND EXISTS (SELECT 1 FROM stock_movements v
             WHERE v.system_id = m.system_id AND v.product_id = m.product_id AND v.kind = 'venda'
               AND v.sale_id = m.sale_id AND v.created_at >= ?3) THEN -m.delta`)}
       + ${parte("WHEN m.kind = 'correcao' AND m.purchase_id IS NULL THEN -m.delta")})`
    : "0";
  const { results } = await ctx.env.DB.prepare(
    `SELECT p.name, p.physical, p.min_units, p.units_per_box,
       COALESCE(p.last_cost_cents, p.cost_cents) AS custo,
       (SELECT COALESCE(SUM(r.quantity), 0) FROM reservations r
         WHERE r.product_id = p.id AND r.status = 'active' AND r.expires_at > ?1) AS reserved,
       ${saida} AS saida
     FROM products p WHERE p.system_id = ?2 AND p.status = 'active'
       AND (?4 IS NULL OR instr(${semAcentoSql("p.name")}, ?4) > 0)
     ORDER BY p.name COLLATE NOCASE`,
  )
    .bind(agora, op.systemId, agora - DIAS_DE_SAIDA * DIA, termoBusca(produto))
    .all<{
      name: string;
      physical: number;
      min_units: number | null;
      units_per_box: number | null;
      custo: number | null;
      reserved: number;
      saida: number;
    }>();
  return results.map((p) => {
    const disponivel = p.physical - p.reserved;
    const minimo = p.min_units ?? minimoRegra;
    return {
      nome: p.name,
      fisico: p.physical,
      reservado: p.reserved,
      disponivel,
      minimo,
      abaixo: minimo !== null ? disponivel < minimo : disponivel <= 0,
      unidadesPorCaixa: p.units_per_box,
      custoCentavos: p.custo,
      saida30: Math.max(0, p.saida),
    };
  });
}

const umaCasa = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/**
 * Sugestão de compra (pedido do dono, 2026-11-27): o que repor primeiro, quanto e quanto custa.
 * Repor até cobrir 14 dias da saída média dos últimos 30 dias e, no mínimo, até o estoque mínimo;
 * em caixas fechadas quando o produto tem caixa. O custo é o da última compra (ou o cadastrado).
 * É só uma sugestão calculada: o chat não compra nem altera nada.
 */
export async function reposicao(ctx: RequestContext, op: Operacao, c: Consulta): Promise<Resposta> {
  if (!tem(op.config, "estoque")) return semModulo("estoque");
  const saldos = await saldosDoEstoque(ctx, op, c.produto, true);
  if (saldos.length === 0) {
    return {
      texto: c.produto
        ? `Nenhum produto ativo com “${c.produto}” no nome.`
        : "Não há produtos ativos.",
      filtros: c.produto ? [`Produto: contém “${c.produto}”`] : [],
      origem: "cadastro de produtos",
    };
  }
  const calculados = saldos.map((p) => {
    const porDia = p.saida30 / DIAS_DE_SAIDA;
    const alvo = Math.max(p.minimo ?? 0, Math.ceil(porDia * DIAS_DE_COBERTURA));
    let comprar = Math.max(0, alvo - p.disponivel);
    if (comprar > 0 && p.unidadesPorCaixa) {
      comprar = Math.ceil(comprar / p.unidadesPorCaixa) * p.unidadesPorCaixa;
    }
    const dias = porDia > 0 ? Math.max(0, p.disponivel) / porDia : null;
    return { ...p, porDia, comprar, dias };
  });
  // Sem estoque, sem mínimo e sem saída recente: não há base para calcular quanto comprar.
  const semBase = calculados.filter((p) => p.comprar === 0 && p.disponivel <= 0).map((p) => p.nome);
  const avisoSemBase = semBase.length
    ? `\nSem estoque e sem saída nos últimos ${DIAS_DE_SAIDA} dias (defina a quantidade): ${semBase.slice(0, LISTA).join(", ")}${semBase.length > LISTA ? ` e mais ${semBase.length - LISTA}` : ""}.`
    : "";
  const itens = calculados
    .filter((p) => p.comprar > 0)
    .sort(
      (a, b) =>
        Number(b.abaixo) - Number(a.abaixo) ||
        (a.dias ?? Infinity) - (b.dias ?? Infinity) ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
  const filtros = [
    c.produto ? `Produto: contém “${c.produto}”` : "Todos os produtos ativos",
    `Saída média dos últimos ${DIAS_DE_SAIDA} dias`,
    `Repor para ${DIAS_DE_COBERTURA} dias de saída (no mínimo, até o estoque mínimo)`,
  ];
  const origem =
    "saldos de agora, vendas e saídas dos últimos 30 dias e custo da última compra (sugestão calculada; nada é comprado pelo chat)";
  if (itens.length === 0) {
    return {
      texto: semBase.length
        ? `Pela saída dos últimos ${DIAS_DE_SAIDA} dias, não há quantidade a sugerir.${avisoSemBase}`
        : `Nada precisa ser reposto agora: ${c.produto ? "o produto está" : "todos os produtos estão"} no mínimo ou acima dele e com estoque para pelo menos ${DIAS_DE_COBERTURA} dias, pela saída dos últimos ${DIAS_DE_SAIDA} dias.`,
      filtros,
      origem,
    };
  }
  const comCusto = itens.filter((p) => p.custoCentavos !== null);
  const total = comCusto.reduce((soma, p) => soma + p.comprar * p.custoCentavos!, 0);
  const semCusto = itens.length - comCusto.length;
  const linhas = itens.slice(0, LISTA).map((p, i) => {
    const caixas =
      p.unidadesPorCaixa && p.unidadesPorCaixa > 1
        ? ` (${plural(p.comprar / p.unidadesPorCaixa, "caixa", "caixas")})`
        : "";
    const situacao = [
      `disponível ${p.disponivel}`,
      ...(p.minimo !== null ? [`mínimo ${p.minimo}`] : []),
      p.porDia > 0
        ? `sai ${umaCasa(p.porDia)} por dia${p.dias !== null ? `, dá para ${umaCasa(Math.floor(p.dias))} ${Math.floor(p.dias) === 1 ? "dia" : "dias"}` : ""}`
        : "sem saída nos últimos 30 dias",
    ].join(", ");
    const custo =
      p.custoCentavos !== null
        ? ` ≈ ${formatarCentavos(p.comprar * p.custoCentavos)}`
        : " (sem custo registrado)";
    return `${i + 1}. ${p.nome}: comprar ${p.comprar}${caixas}${custo}. Hoje: ${situacao}${p.abaixo ? " (abaixo do mínimo)" : ""}.`;
  });
  const abaixo = itens.filter((p) => p.abaixo).length;
  return {
    texto:
      `Sugestão de compra: ${plural(itens.length, "item", "itens")}` +
      (abaixo ? `, ${abaixo} abaixo do mínimo` : "") +
      (comCusto.length === 0
        ? ". Valor total: não dá para estimar, porque nenhum desses itens tem custo registrado"
        : semCusto
          ? `. Valor estimado dos ${plural(comCusto.length, "item", "itens")} com custo: ${formatarCentavos(total)} (${plural(semCusto, "item sem custo registrado ficou", "itens sem custo registrado ficaram")} fora da soma)`
          : `. Valor total estimado: ${formatarCentavos(total)}`) +
      ".\nEm ordem de prioridade:\n" +
      linhas.join("\n") +
      (itens.length > LISTA
        ? `\n(Mostrando os ${LISTA} mais urgentes de ${itens.length}; o valor acima considera todos.)`
        : "") +
      avisoSemBase,
    filtros,
    origem,
  };
}

/** Financeiro: pendentes, vencidas, próximos vencimentos e o que entrou e saiu no período. */
export async function financeiro(
  ctx: RequestContext,
  op: Operacao,
  c: Consulta,
): Promise<Resposta> {
  if (!tem(op.config, "financeiro")) return semModulo("financeiro");
  const agora = ctx.clock.now();
  const hoje = hojeLocal(agora);
  const per = periodoOuMes(c, agora);
  if (!per) return periodoInvalido;
  const db = ctx.env.DB;
  const [r, proximos] = await db.batch([
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN kind = 'receber' AND status = 'pendente' THEN amount_cents END), 0) AS rt,
           COALESCE(SUM(CASE WHEN kind = 'pagar' AND status = 'pendente' THEN amount_cents END), 0) AS pt,
           SUM(status = 'pendente' AND due_date < ?2) AS vn,
           COALESCE(SUM(CASE WHEN status = 'pendente' AND due_date < ?2 THEN amount_cents END), 0) AS vt,
           COALESCE(SUM(CASE WHEN kind = 'receber' AND status = 'pago' AND paid_at >= ?3 AND paid_at < ?4 THEN COALESCE(paid_amount_cents, amount_cents) END), 0) AS recebido,
           COALESCE(SUM(CASE WHEN kind = 'pagar' AND status = 'pago' AND paid_at >= ?3 AND paid_at < ?4 THEN COALESCE(paid_amount_cents, amount_cents) END), 0) AS pago
         FROM financial_entries WHERE system_id = ?1`,
      )
      .bind(op.systemId, hoje, per.de, per.ate),
    db
      .prepare(
        `SELECT kind, description, amount_cents, due_date FROM financial_entries
         WHERE system_id = ? AND status = 'pendente' ORDER BY due_date LIMIT 5`,
      )
      .bind(op.systemId),
  ]);
  const t = (r?.results[0] ?? {}) as Record<string, number | null>;
  const n = (k: string) => Number(t[k] ?? 0);
  const lista = (proximos?.results ?? []) as {
    kind: string;
    description: string;
    amount_cents: number;
    due_date: string;
  }[];
  return {
    texto:
      `A receber (pendente): ${formatarCentavos(n("rt"))}. A pagar (pendente): ${formatarCentavos(n("pt"))}.\n` +
      `Vencidas: ${n("vn")} (${formatarCentavos(n("vt"))}).\n` +
      `No período: recebido ${formatarCentavos(n("recebido"))}, pago ${formatarCentavos(n("pago"))}.` +
      (lista.length
        ? `\nPróximos vencimentos:\n${lista
            .map(
              (l) =>
                `${dataBr(l.due_date)} · ${l.kind === "receber" ? "a receber" : "a pagar"} · ${l.description} · ${formatarCentavos(l.amount_cents)}${l.due_date < hoje ? " (vencida)" : ""}`,
            )
            .join("\n")}`
        : ""),
    filtros: [per.texto, `Vencidas: antes de ${dataBr(hoje)}`],
    origem: "lançamentos do financeiro (pendentes, pagos no período pela data da baixa)",
  };
}

/** Atendimentos por profissional no período. */
export async function profissionais(
  ctx: RequestContext,
  op: Operacao,
  c: Consulta,
): Promise<Resposta> {
  if (!tem(op.config, "profissionais")) return semModulo("profissionais");
  const per = periodoOuMes(c, ctx.clock.now());
  if (!per) return periodoInvalido;
  const { results } = await ctx.env.DB.prepare(
    `SELECT p.name, p.status,
       SUM(a.status = 'done') AS feitos, SUM(a.status IN ('scheduled', 'in_progress')) AS marcados
     FROM professionals p LEFT JOIN appointments a ON a.professional_id = p.id
       AND a.start_at >= ?2 AND a.start_at < ?3 AND a.status <> 'cancelled'
     WHERE p.system_id = ?1 AND (?4 IS NULL OR instr(${semAcentoSql("p.name")}, ?4) > 0)
     GROUP BY p.id ORDER BY p.name COLLATE NOCASE LIMIT ${LISTA}`,
  )
    .bind(op.systemId, per.de, per.ate, termoBusca(c.profissional))
    .all<{ name: string; status: string; feitos: number | null; marcados: number | null }>();
  return {
    texto: results.length
      ? results
          .map(
            (r) =>
              `${r.name}${r.status === "inactive" ? " (inativo)" : ""}: ${r.feitos ?? 0} concluídos, ${r.marcados ?? 0} agendados`,
          )
          .join("\n")
      : "Nenhum profissional encontrado.",
    filtros: [per.texto, ...(c.profissional ? [`Profissional: contém “${c.profissional}”`] : [])],
    origem: "cadastro de profissionais e agenda (sem cancelados)",
  };
}

/** Como usar cada tela: guia fixo por módulo (sem IA escrevendo, sem números). */
const GUIA: Record<ModuleId, string> = {
  clientes:
    "Em Clientes: “Novo” cadastra; a tabela mostra compras, total e última compra; dá para buscar, filtrar e inativar sem perder o histórico.",
  produtos:
    "Em Produtos: “Novo” cadastra com preço de varejo (e atacado, se houver); “Entrada” soma ao estoque; a correção de saldo é do administrador.",
  vendas:
    "Em Vendas: “Nova venda” escolhe o cliente e os itens; “Salvar e reservar” segura o estoque; “Concluir venda” baixa o estoque. Cancelar uma venda concluída devolve o estoque.",
  estoque:
    "Em Estoque: o histórico de movimentos (entradas, vendas, correções e estornos) com saldo depois de cada um; entradas e correções ficam em Produtos.",
  profissionais:
    "Em Profissionais: cadastre a equipe; quem tem atendimento pendente não pode ser inativado.",
  agenda:
    "Na Agenda: “Novo atendimento” escolhe cliente, profissional, tipo e horário; o sistema não deixa o mesmo profissional em dois horários ao mesmo tempo. Dá para iniciar, concluir, remarcar e cancelar.",
  pagamentos:
    "Formas de pagamento: ao concluir uma venda, escolha como foi paga; venda a prazo vira conta a receber se o Financeiro estiver ligado.",
  fornecedores:
    "Em Fornecedores, cadastre quem vende para você; em Compras, “Nova compra” dá entrada no estoque, grava o custo e, com o Financeiro, gera a conta a pagar.",
  financeiro:
    "No Financeiro: “Nova conta” lança contas a pagar ou a receber; “Pagar” ou “Receber” dá baixa; as vencidas aparecem em destaque e no painel.",
};

export function comoUsar(config: ConfigDraft, modulo: ModuleId | null | undefined): Resposta {
  const modulos = modulo && config.modulos.includes(modulo) ? [modulo] : config.modulos;
  if (modulo && !config.modulos.includes(modulo)) return semModulo(MODULE_INFO[modulo].label);
  return {
    texto:
      modulos.map((m) => GUIA[m]).join("\n") +
      (modulo
        ? ""
        : "\nPergunte também sobre vendas, estoque, clientes, agenda e o que mais o sistema tiver."),
    filtros: modulo ? [`Módulo: ${MODULE_INFO[modulo].label}`] : ["Módulos deste sistema"],
    origem: "guia de uso do Nexus",
  };
}
