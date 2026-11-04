import type {
  AtendimentoDto,
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

export type TipoPessoa = "clientes" | "profissionais";

export async function listarPessoas(
  sistema: string,
  tipo: TipoPessoa,
): Promise<(ClienteDto | ProfissionalDto)[]> {
  const r = await chamar<OperacaoApiBody>(`${base(sistema)}/${tipo}`);
  return exigir(tipo === "clientes" ? r.clientes : r.profissionais, tipo);
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
  return exigir(tipo === "clientes" ? r.cliente : r.profissional, "cadastro");
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
  return exigir(tipo === "clientes" ? r.cliente : r.profissional, "cadastro");
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
export const concluirVenda = (sistema: string, id: string, revisao: number) =>
  acaoVenda(sistema, id, "concluir", { revisao });
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
) {
  const r = await chamar<OperacaoApiBody>(
    `${base(sistema)}/agenda/${encodeURIComponent(id)}/${acao}`,
    { method: "POST", body, chave: novaChave() },
  );
  return exigir(r.atendimentos, "atendimentos");
}
