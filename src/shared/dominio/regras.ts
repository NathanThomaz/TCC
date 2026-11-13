import { PAYMENT_LABELS, type PaymentMethod } from "../contract/catalog";
import type { ConfigDraft, Rule } from "../contract/schema";
import { deCampoLocal, paraCampoLocal } from "./agenda";

// Regras do catálogo ampliado (ADR-005) aplicadas pela operação. Cada função devolve o erro em
// linguagem de negócio (ou null) e é a mesma usada pelo backend e pelas telas.

export interface ErroRegra {
  code: string;
  message: string;
}

export function regraDo<T extends Rule["tipo"]>(
  config: ConfigDraft,
  tipo: T,
): Extract<Rule, { tipo: T }> | undefined {
  return config.regras.find((r): r is Extract<Rule, { tipo: T }> => r.tipo === tipo);
}

const reais = (c: number) =>
  `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Pedido mínimo: a venda só é concluída com total a partir do valor, inclusive. */
export function conferirPedidoMinimo(config: ConfigDraft, totalCentavos: number): ErroRegra | null {
  const r = regraDo(config, "pedido_minimo");
  if (!r || totalCentavos >= r.valor_centavos) return null;
  return {
    code: "pedido_minimo",
    message: `O pedido mínimo é de ${reais(r.valor_centavos)}; esta venda está em ${reais(totalCentavos)}.`,
  };
}

/** Limite de unidades de um mesmo produto numa venda. */
export function conferirLimitePorItem(
  config: ConfigDraft,
  nome: string,
  unidades: number,
): ErroRegra | null {
  const r = regraDo(config, "limite_unidades_por_item");
  if (!r || unidades <= r.unidades) return null;
  return {
    code: "limite_unidades_por_item",
    message: `${nome}: no máximo ${r.unidades} unidades por venda (pedido de ${unidades}).`,
  };
}

/** Venda concluída só é cancelada até N dias depois da conclusão. */
export function conferirPrazoCancelamentoVenda(
  config: ConfigDraft,
  concluidaEm: number,
  agora: number,
): ErroRegra | null {
  const r = regraDo(config, "prazo_cancelamento_venda");
  if (!r || agora - concluidaEm <= r.dias * 86_400_000) return null;
  return {
    code: "prazo_cancelamento_venda",
    message: `Vendas só podem ser canceladas até ${r.dias} ${r.dias === 1 ? "dia" : "dias"} depois de concluídas.`,
  };
}

/** Dia da semana (0 = domingo) de uma data AAAA-MM-DD. */
function diaDaSemana(data: string): number {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/**
 * Antecedência mínima e horário de funcionamento para atendimentos novos ou remarcados. O horário
 * vale no fuso do Nexus: começa e termina no mesmo dia, dentro de [abre, fecha], num dia permitido.
 */
export function conferirHorarios(
  config: ConfigDraft,
  intervalos: { inicio: number; fim: number }[],
  agora: number,
): ErroRegra | null {
  const antecedencia = regraDo(config, "antecedencia_minima");
  if (antecedencia) {
    const limite = agora + antecedencia.minutos * 60_000;
    if (intervalos.some((i) => i.inicio < limite)) {
      const h = antecedencia.minutos;
      const texto = h % 60 === 0 ? `${h / 60} ${h === 60 ? "hora" : "horas"}` : `${h} minutos`;
      return {
        code: "antecedencia_minima",
        message: `Os atendimentos precisam ser marcados com pelo menos ${texto} de antecedência.`,
      };
    }
  }
  const horario = regraDo(config, "horario_funcionamento");
  if (horario) {
    for (const i of intervalos) {
      const dataIni = paraCampoLocal(i.inicio).slice(0, 10);
      const abre = deCampoLocal(`${dataIni}T${horario.abre}`) ?? 0;
      // "23:59" é o fim do dia: o atendimento pode terminar à meia-noite.
      const fecha =
        (deCampoLocal(`${dataIni}T${horario.fecha}`) ?? 0) +
        (horario.fecha === "23:59" ? 60_000 : 0);
      if (!horario.dias_semana.includes(diaDaSemana(dataIni))) {
        const abertos = [...horario.dias_semana]
          .sort()
          .map((d) => DIAS[d])
          .join(", ");
        return {
          code: "fora_do_horario",
          message: `Não há atendimento em ${DIAS[diaDaSemana(dataIni)]}. Dias de funcionamento: ${abertos}.`,
        };
      }
      if (i.inicio < abre || i.fim > fecha) {
        return {
          code: "fora_do_horario",
          message: `O atendimento precisa começar e terminar entre ${horario.abre} e ${horario.fecha}.`,
        };
      }
    }
  }
  return null;
}

/** Cancelar ou remarcar só até N horas antes do início do atendimento. */
export function conferirPrazoCancelamentoAtendimento(
  config: ConfigDraft,
  inicio: number,
  agora: number,
): ErroRegra | null {
  const r = regraDo(config, "prazo_cancelamento_atendimento");
  if (!r || inicio - agora >= r.horas * 3_600_000) return null;
  return {
    code: "prazo_cancelamento_atendimento",
    message: `Cancelamentos e remarcações só até ${r.horas} ${r.horas === 1 ? "hora" : "horas"} antes do início.`,
  };
}

/**
 * Forma de pagamento na conclusão da venda (ADR-006). Sem o módulo, a forma não é registrada
 * (null). Com ele, precisa ser uma das formas aceitas pela regra `formas_pagamento`.
 */
export function conferirFormaPagamento(
  config: ConfigDraft,
  forma: PaymentMethod | undefined,
): { forma: PaymentMethod | null; prazoDias: number } | ErroRegra {
  if (!config.modulos.includes("pagamentos")) return { forma: null, prazoDias: 0 };
  const r = regraDo(config, "formas_pagamento");
  const aceitas = r?.formas ?? [];
  if (!forma) {
    return {
      code: "forma_pagamento_obrigatoria",
      message: "Escolha a forma de pagamento para concluir a venda.",
    };
  }
  if (!aceitas.includes(forma)) {
    return {
      code: "forma_pagamento_nao_aceita",
      message: `${PAYMENT_LABELS[forma]} não é aceito. Formas aceitas: ${aceitas.map((f) => PAYMENT_LABELS[f]).join(", ")}.`,
    };
  }
  return { forma, prazoDias: r?.prazo_dias ?? 0 };
}

/** Data local (AAAA-MM-DD, fuso do Nexus) N dias depois do instante. */
export function vencimentoEmDias(instante: number, dias: number): string {
  const hoje = paraCampoLocal(instante).slice(0, 10);
  const [a, m, d] = hoje.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}
