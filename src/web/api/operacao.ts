import type {
  AtendimentoDto,
  CompraDto,
  LancamentoDto,
  PainelDto,
  ResumoFinanceiroDto,
  TipoLancamento,
  CamposInformativos,
  ClienteDto,
  MovimentoDto,
  OperacaoApiBody,
  ProdutoDto,
  ProfissionalDto,
  StatusCadastro,
  SystemDto,
  VendaDto,
} from "../../shared/api";
import type { FIELD_TYPES, FieldEntity, PaymentMethod } from "../../shared/contract/catalog";
import type { ConfigDraft } from "../../shared/contract/schema";
import { ApiError, chamar, novaChave } from "./cliente";

// Operação do sistema ativo (/api/v1/systems/:id/...). Cálculos e regras ficam no backend: as
// telas mostram o que a API devolveu.

function base(sistema: string) {
  return `/systems/${encodeURIComponent(sistema)}`;
}

function exigir<T>(valor: T | undefined | null, campo: string): T {
  if (valor === undefined || valor === null) {
    throw new ApiError("resposta_inesperada", `Resposta sem ${campo}.`);
  }
  return valor;
}

export interface App {
  sistema: SystemDto;
  config: ConfigDraft;
  papel: "admin" | "secondary";
}

export async function obterApp(sistema: string): Promise<App> {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/app`);
  return {
    sistema: exigir(r.sistema, "sistema"),
    config: exigir(r.config, "configuração"),
    papel: exigir(r.papel, "papel"),
  };
}

// ---- Cadastros ----

export type TipoPessoa = "clientes" | "profissionais" | "fornecedores";

const UMA_PESSOA = {
  clientes: "cliente",
  profissionais: "profissional",
  fornecedores: "fornecedor",
} as const;

export async function listarPessoas(
  sistema: string,
  tipo: TipoPessoa,
): Promise<(ClienteDto | ProfissionalDto)[]> {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/${tipo}`);
  return exigir(r[tipo], tipo);
}

export async function criarPessoa(
  sistema: string,
  tipo: TipoPessoa,
  dados: { nome: string; campos: CamposInformativos },
  chave = novaChave(),
) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/${tipo}`, {
    method: "POST",
    body: dados,
    chave,
  });
  return exigir(r[UMA_PESSOA[tipo]], "cadastro");
}

export async function editarPessoa(
  sistema: string,
  tipo: TipoPessoa,
  id: string,
  dados: { nome: string; campos: CamposInformativos },
) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/${tipo}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: dados,
  });
  return exigir(r[UMA_PESSOA[tipo]], "cadastro");
}

export async function mudarStatus(
  sistema: string,
  tipo: TipoPessoa | "produtos",
  id: string,
  status: StatusCadastro,
) {
  await chamar<OperacaoApiBody>(`${base(sistema)}/${tipo}/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: { status },
    chave: novaChave(),
  });
}

export interface DadosProduto {
  nome: string;
  varejoCentavos: number;
  atacadoCentavos: number | null;
  unidadesPorCaixa: number | null;
  campos: CamposInformativos;
  /** Aviso de estoque deste produto (unidades); null sem aviso próprio. */
  estoqueMinimo: number | null;
  /** Só no cadastro: o que já tem em estoque (vira a primeira entrada). */
  estoqueInicial?: number;
}

/** Ajuste de coluna num sistema ativo: renomear (só visual) ou incluir. */
export type AjusteColuna =
  | { acao: "renomear"; chave: string; rotulo: string }
  | {
      acao: "incluir";
      entidade: FieldEntity;
      rotulo: string;
      tipo: (typeof FIELD_TYPES)[number];
      opcoes?: string[];
    };

export async function ajustarColuna(sistema: string, ajuste: AjusteColuna): Promise<void> {
  await chamar(`${base(sistema)}/colunas`, { method: "POST", body: ajuste, chave: novaChave() });
}

export async function listarProdutos(sistema: string): Promise<ProdutoDto[]> {
  return exigir((await chamar<OperacaoApiBody>(`${base(sistema)}/produtos`)).produtos, "produtos");
}

export async function criarProduto(sistema: string, dados: DadosProduto, chave = novaChave()) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/produtos`, {
    method: "POST",
    body: dados,
    chave,
  });
  return exigir(r.produto, "produto");
}

export async function editarProduto(sistema: string, id: string, dados: DadosProduto) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/produtos/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: dados,
  });
  return exigir(r.produto, "produto");
}

// ---- Estoque ----

export async function listarMovimentos(sistema: string, produto?: string): Promise<MovimentoDto[]> {
  const q = produto ? `?produto=${encodeURIComponent(produto)}` : "";
  return exigir(
    (await chamar<OperacaoApiBody>(`${base(sistema)}/estoque/movimentos${q}`)).movimentos,
    "movimentos",
  );
}

export async function registrarEntrada(
  sistema: string,
  dados: { produto: string; caixas: number; unidades: number; motivo: string },
  chave = novaChave(),
) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/estoque/entradas`, {
    method: "POST",
    body: dados,
    chave,
  });
  return exigir(r.movimento, "movimento");
}

export async function corrigirSaldo(
  sistema: string,
  dados: { produto: string; fisicoEsperado: number; novoFisico: number; motivo: string },
  chave = novaChave(),
) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/estoque/correcoes`, {
    method: "POST",
    body: dados,
    chave,
  });
  return exigir(r.movimento, "movimento");
}

// ---- Vendas ----

export interface ItemPedido {
  produto: string;
  caixas: number;
  unidades: number;
}

export async function listarVendas(sistema: string): Promise<VendaDto[]> {
  return exigir((await chamar<OperacaoApiBody>(`${base(sistema)}/vendas`)).vendas, "vendas");
}

export async function obterVenda(
  sistema: string,
  id: string,
): Promise<{ venda: VendaDto; servicos: AtendimentoDto[] }> {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/vendas/${encodeURIComponent(id)}`);
  return { venda: exigir(r.venda, "venda"), servicos: r.servicos ?? [] };
}

export async function criarVenda(
  sistema: string,
  dados: { cliente: string; itens: ItemPedido[]; campos: CamposInformativos },
  chave: string,
) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/vendas`, {
    method: "POST",
    body: dados,
    chave,
  });
  return exigir(r.venda, "venda");
}

export async function salvarItens(
  sistema: string,
  id: string,
  dados: { revisao: number; itens: ItemPedido[] },
  chave: string,
) {
  const r = await chamar<OperacaoApiBody>(
    `${base(sistema)}/vendas/${encodeURIComponent(id)}/itens`,
    { method: "POST", body: dados, chave },
  );
  return exigir(r.venda, "venda");
}

async function acaoVenda(sistema: string, id: string, acao: string, body: unknown) {
  const r = await chamar<OperacaoApiBody>(
    `${base(sistema)}/vendas/${encodeURIComponent(id)}/${acao}`,
    { method: "POST", body, chave: novaChave() },
  );
  return { venda: exigir(r.venda, "venda"), jaCancelada: r.jaCancelada === true };
}

export const descartarVenda = (sistema: string, id: string) =>
  acaoVenda(sistema, id, "descartar", {});
export const concluirVenda = (
  sistema: string,
  id: string,
  revisao: number,
  formaPagamento?: PaymentMethod,
) => acaoVenda(sistema, id, "concluir", { revisao, ...(formaPagamento ? { formaPagamento } : {}) });

// ---- Compras (ADR-006) ----

export interface NovaCompra {
  fornecedor: string;
  itens: { produto: string; caixas: number; unidades: number; custoUnitarioCentavos: number }[];
  observacao?: string;
  vencimento?: string;
}

export async function listarCompras(
  sistema: string,
  periodo: { de?: string; ate?: string } = {},
): Promise<CompraDto[]> {
  const q = new URLSearchParams(
    Object.entries(periodo).filter((e): e is [string, string] => !!e[1]),
  ).toString();
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/compras${q ? `?${q}` : ""}`);
  return exigir(r.compras, "compras");
}

export async function criarCompra(sistema: string, dados: NovaCompra, chave = novaChave()) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/compras`, {
    method: "POST",
    body: dados,
    chave,
  });
  return exigir(r.compra, "compra");
}

export async function cancelarCompra(sistema: string, id: string, motivo: string) {
  const r = await chamar<OperacaoApiBody>(
    `${base(sistema)}/compras/${encodeURIComponent(id)}/cancelar`,
    { method: "POST", body: { motivo }, chave: novaChave() },
  );
  return exigir(r.compra, "compra");
}

// ---- Financeiro (ADR-006) ----

export interface FiltroFinanceiro {
  tipo?: TipoLancamento;
  status?: "pendente" | "pago" | "cancelado" | "vencido";
  /** Período do vencimento (AAAA-MM-DD), inclusive. */
  de?: string;
  ate?: string;
}

export async function listarLancamentos(
  sistema: string,
  filtro: FiltroFinanceiro = {},
): Promise<{ lancamentos: LancamentoDto[]; resumo: ResumoFinanceiroDto }> {
  const q = new URLSearchParams(
    Object.entries(filtro).filter((e): e is [string, string] => typeof e[1] === "string"),
  ).toString();
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/financeiro${q ? `?${q}` : ""}`);
  return {
    lancamentos: exigir(r.lancamentos, "lançamentos"),
    resumo: exigir(r.resumoFinanceiro, "resumo"),
  };
}

export interface NovoLancamento {
  tipo: TipoLancamento;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  cliente?: string;
  fornecedor?: string;
}

export async function criarLancamento(sistema: string, dados: NovoLancamento, chave = novaChave()) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/financeiro`, {
    method: "POST",
    body: dados,
    chave,
  });
  return exigir(r.lancamento, "lançamento");
}

export async function acaoLancamento(
  sistema: string,
  id: string,
  acao: "baixar" | "cancelar",
  motivo?: string,
) {
  const r = await chamar<OperacaoApiBody>(
    `${base(sistema)}/financeiro/${encodeURIComponent(id)}/${acao}`,
    { method: "POST", body: motivo ? { motivo } : {}, chave: novaChave() },
  );
  return exigir(r.lancamento, "lançamento");
}
export const cancelarVenda = (
  sistema: string,
  id: string,
  motivo: string,
  cancelarServicos: boolean,
) => acaoVenda(sistema, id, "cancelar", { motivo, cancelarServicos });

// ---- Agenda ----

export async function listarAgenda(
  sistema: string,
  filtro: { de: number; ate: number; profissional?: string | undefined },
): Promise<AtendimentoDto[]> {
  const q = new URLSearchParams({ de: String(filtro.de), ate: String(filtro.ate) });
  if (filtro.profissional) q.set("profissional", filtro.profissional);
  return exigir(
    (await chamar<OperacaoApiBody>(`${base(sistema)}/agenda?${q.toString()}`)).atendimentos,
    "atendimentos",
  );
}

export async function agendar(
  sistema: string,
  dados: {
    cliente: string;
    profissional: string;
    tipo: string;
    inicio: number;
    inicioSegundo?: number | undefined;
    venda?: string | undefined;
    campos: CamposInformativos;
  },
  chave: string,
) {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/agenda`, {
    method: "POST",
    body: dados,
    chave,
  });
  return exigir(r.atendimentos, "atendimentos");
}

export async function acaoAtendimento(
  sistema: string,
  id: string,
  acao: "iniciar" | "concluir" | "cancelar" | "remarcar",
  body: unknown = {},
  chave = novaChave(),
) {
  const r = await chamar<OperacaoApiBody>(
    `${base(sistema)}/agenda/${encodeURIComponent(id)}/${acao}`,
    { method: "POST", body, chave },
  );
  return exigir(r.atendimentos, "atendimentos");
}

/** Painel do sistema ativo: números calculados no backend, só dos módulos ativos. */
export async function obterPainel(sistema: string): Promise<PainelDto> {
  const r = await chamar<{ painel?: PainelDto }>(`${base(sistema)}/painel`);
  return exigir(r.painel, "painel");
}
