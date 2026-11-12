import type { AssuntoDto, CriacaoApiBody, EstadoPedidoDto, RequisitoDto } from "../../shared/api";

// Criação guiada (ADR-004): como o estado da entrevista vira trilha de assuntos e resumo em
// linguagem de negócio. Cores e ícones seguem o Padrão visual do Nexus (Vault).

export const ORDEM_ASSUNTOS: AssuntoDto[] = [
  "negocio",
  "produtos_precos",
  "pedidos_estoque",
  "clientes",
  "atendimentos",
  "aparencia",
];

export const ROTULO_ASSUNTO: Record<AssuntoDto, string> = {
  negocio: "Seu negócio",
  produtos_precos: "Produtos e preços",
  pedidos_estoque: "Pedidos e estoque",
  clientes: "Clientes",
  atendimentos: "Atendimentos",
  aparencia: "Aparência",
};

export type EstadoAssunto = "feito" | "atual" | "pendente";
export type EstadoItem = "informado" | "sugestao";

/** Sugestão da IA ainda não aceita pelo usuário; o resto é o que o dono disse. */
export const estadoDoItem = (r: RequisitoDto): EstadoItem =>
  r.sugestao && r.status === "pendente" ? "sugestao" : "informado";

/** Atendimentos só entram na trilha quando o negócio tem serviços (a IA chegou a tratar disso). */
export function assuntosDaEntrevista(e: Pick<CriacaoApiBody, "requisitos" | "assuntoAtual">) {
  const requisitos = e.requisitos ?? [];
  const usaAtendimentos =
    e.assuntoAtual === "atendimentos" || requisitos.some((r) => r.assunto === "atendimentos");
  return ORDEM_ASSUNTOS.filter((a) => a !== "atendimentos" || usaAtendimentos).map((id) => {
    const estado: EstadoAssunto =
      id === e.assuntoAtual
        ? "atual"
        : requisitos.some((r) => r.assunto === id)
          ? "feito"
          : "pendente";
    return { id, rotulo: ROTULO_ASSUNTO[id], estado };
  });
}

export function pendenciasDaEntrevista(
  e: Pick<CriacaoApiBody, "requisitos" | "prontoParaRevisar">,
) {
  const requisitos = e.requisitos ?? [];
  const sugestoes = requisitos.filter((r) => estadoDoItem(r) === "sugestao").length;
  const pronto = (e.prontoParaRevisar ?? false) && requisitos.length > 0;
  const motivo = sugestoes
    ? `Confirme ${sugestoes === 1 ? "1 sugestão" : `${sugestoes} sugestões`} do assistente para continuar.`
    : pronto
      ? ""
      : "O assistente ainda tem perguntas para montar o seu sistema.";
  return { sugestoes, podeRevisar: pronto && sugestoes === 0, motivo };
}

export const ROTULO_ESTADO_PEDIDO: Record<EstadoPedidoDto, string> = {
  aberto: "Aberto",
  em_analise: "Em análise",
  implementado: "Implementado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

export const dataBr = (em: number) =>
  new Date(em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
