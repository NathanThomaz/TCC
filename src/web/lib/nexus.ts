import type { Campo, ConfigDraft, Modelo, Modulo, Regra } from "@/types/nexus";
import { RULE_MODULES } from "../../shared/contract/catalog";

export const MODULOS_POR_MODELO: Record<Modelo, Modulo[]> = {
  comercio: ["clientes", "produtos", "vendas", "estoque"],
  servicos: ["clientes", "profissionais", "agenda"],
  comercio_com_servicos: ["clientes", "produtos", "vendas", "estoque", "profissionais", "agenda"],
};

export const ROTULO_MODULO: Record<Modulo, string> = {
  clientes: "Clientes",
  produtos: "Produtos",
  vendas: "Vendas",
  estoque: "Estoque",
  profissionais: "Profissionais",
  agenda: "Agenda",
};

export type Entidade = Campo["entidade"];
export const ROTULO_ENTIDADE: Record<Entidade, string> = {
  clientes: "Clientes",
  produtos: "Produtos",
  profissionais: "Profissionais",
  vendas: "Vendas",
  agendamentos: "Agendamentos",
};

export function entidadesDosModulos(modulos: Modulo[]): Entidade[] {
  const out: Entidade[] = [];
  if (modulos.includes("clientes")) out.push("clientes");
  if (modulos.includes("produtos")) out.push("produtos");
  if (modulos.includes("profissionais")) out.push("profissionais");
  if (modulos.includes("vendas")) out.push("vendas");
  if (modulos.includes("agenda")) out.push("agendamentos");
  return out;
}

/** Modo avançado (ADR-004): modelo, ajustes dos módulos com padrões, revisão. */
export const PASSOS = ["Modelo", "Ajustes", "Revisão"] as const;

/** Mapeia o `path` de um diagnóstico para o passo (1–3) do modo avançado. */
export function passoDoPath(path: string): number {
  const raiz = path.split(/[.[]/)[0];
  switch (raiz) {
    case "modelo":
    case "modulos":
      return 1;
    case "requisitos":
    case "aparencia":
    case "campos":
    case "tipos_atendimento":
    case "regras":
    case "fora_do_catalogo":
      return 2;
    default:
      return 3;
  }
}

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** "Seg a Sáb", "Seg, Qua e Sex" ou "todos os dias". */
export function diasDaSemana(dias: number[]): string {
  const d = [...new Set(dias)].sort((a, b) => a - b);
  if (d.length === 7) return "todos os dias";
  const seguidos = d.length > 2 && d.every((x, i) => i === 0 || x === d[i - 1]! + 1);
  if (seguidos) return `${DIAS_SEMANA[d[0]!]} a ${DIAS_SEMANA[d.at(-1)!]}`;
  const nomes = d.map((x) => DIAS_SEMANA[x]);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : (nomes[0] ?? "");
}

const formatarMinutos = (m: number) =>
  m % 60 === 0 ? `${m / 60} ${m === 60 ? "hora" : "horas"}` : `${m} minutos`;

/** Frase de negócio de cada regra (é o texto do requisito gerado no modo avançado). */
export function textoDaRegra(r: Regra, d: ConfigDraft): string {
  const rotulo = (id: string) => d.tipos_atendimento.find((t) => t.id === id)?.rotulo || id;
  switch (r.tipo) {
    case "limite_atacado":
      return `Atacado a partir de R$ ${centavosParaReais(r.valor_centavos)} em produtos`;
    case "unidades_por_caixa":
      return `Caixa padrão com ${r.unidades} unidades`;
    case "prazo_reserva":
      return `Pedido aberto segura o estoque por ${formatarMinutos(r.minutos)}`;
    case "par_atendimento":
      return `${rotulo(r.primeiro)} seguido de ${rotulo(r.segundo)}, com o mesmo profissional`;
    case "estoque_minimo":
      return `Estoque mínimo de ${r.unidades} ${r.unidades === 1 ? "unidade" : "unidades"} por produto`;
    case "pedido_minimo":
      return `Pedido mínimo de R$ ${centavosParaReais(r.valor_centavos)}`;
    case "limite_unidades_por_item":
      return `No máximo ${r.unidades} unidades de um mesmo produto por venda`;
    case "prazo_cancelamento_venda":
      return `Venda concluída pode ser cancelada até ${r.dias} ${r.dias === 1 ? "dia" : "dias"} depois`;
    case "horario_funcionamento":
      return `Atendimentos de ${diasDaSemana(r.dias_semana)}, das ${r.abre} às ${r.fecha}`;
    case "antecedencia_minima":
      return `Agendar com pelo menos ${formatarMinutos(r.minutos)} de antecedência`;
    case "prazo_cancelamento_atendimento":
      return `Cancelar ou remarcar atendimento até ${r.horas} ${r.horas === 1 ? "hora" : "horas"} antes`;
  }
}

/**
 * No modo avançado o dono ajusta valores, não requisitos: cada regra ganha um requisito gerado
 * com a frase do ajuste, já confirmado (é o próprio dono quem define o valor), e a regra o cita.
 * O validador continua exigindo a ligação regra → requisito confirmado (seção 6).
 */
export function comRequisitosGerados(d: ConfigDraft): ConfigDraft {
  // REQ-01 registra o modelo e os módulos escolhidos (o contrato exige ao menos um requisito,
  // mesmo sem regras); as regras vêm a partir do REQ-02.
  const id = (i: number) => `REQ-${String(i + 2).padStart(2, "0")}`;
  const base = {
    id: "REQ-01",
    texto: `Sistema com ${d.modulos.map((m) => ROTULO_MODULO[m].toLowerCase()).join(", ")}`,
    status: "confirmado" as const,
  };
  return {
    ...d,
    requisitos: [
      base,
      ...d.regras.map((r, i) => ({
        id: id(i),
        texto: textoDaRegra(r, d),
        status: "confirmado" as const,
      })),
    ],
    regras: d.regras.map((r, i) => ({ ...r, requisitos: [id(i)] })),
    fora_do_catalogo: d.fora_do_catalogo.map((f) => ({ texto: f.texto })),
  };
}

/** Ao trocar o modelo, tira as regras e os atendimentos de módulos que deixaram de existir. */
export function reconciliarModelo(d: ConfigDraft): ConfigDraft {
  const agenda = d.modulos.includes("agenda");
  return {
    ...d,
    regras: d.regras.filter((r) => RULE_MODULES[r.tipo].every((m) => d.modulos.includes(m))),
    tipos_atendimento: agenda ? d.tipos_atendimento : [],
    campos: d.campos.filter((c) => entidadesDosModulos(d.modulos).includes(c.entidade)),
  };
}

export function validarNomeSistema(nome: string): string | null {
  const n = nome.trim();
  if (n.length < 1) return "Informe um nome.";
  if (n.length > 80) return "Use no máximo 80 caracteres.";
  return null;
}

export function rascunhoPadrao(nome: string): ConfigDraft {
  return {
    modelo: "comercio",
    modulos: [...MODULOS_POR_MODELO.comercio],
    aparencia: {
      nome,
      titulo: nome,
      // Cores da marca Nexus (Padrão visual do Nexus); o dono pode trocar na aparência.
      cor_primaria: "#1f4e79",
      cor_destaque: "#f2a900",
      texto_boas_vindas: "",
    },
    requisitos: [],
    campos: [],
    tipos_atendimento: [],
    regras: [],
    fora_do_catalogo: [],
  };
}

export function novoId(prefixo: string) {
  return `${prefixo}_${Math.random().toString(36).slice(2, 10)}`;
}

export const formatarData = (ms: number) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(ms);

/** "1.500,50" ou "1500.5" → 150050 centavos. Retorna null se inválido. */
export function reaisParaCentavos(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  return Math.round(Number(normal) * 100);
}

export function centavosParaReais(c: number): string {
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
