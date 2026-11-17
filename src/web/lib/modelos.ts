import {
  Briefcase,
  CalendarClock,
  Scissors,
  Store,
  UsersRound,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import {
  TEMPLATE_DESCRIPTIONS,
  TEMPLATE_LABELS,
  TEMPLATES,
  TEMPLATES_OFERECIDOS,
} from "../../shared/contract/catalog";
import type { Modelo } from "@/types/nexus";

// Os seis modelos oferecidos como aparecem nas telas (tela inicial e modo avançado), a partir do
// catálogo. A agenda simples só aparece em sistema que já a usa (ver TEMPLATES_OFERECIDOS).

const ICONE: Record<Modelo, LucideIcon> = {
  comercio: Store,
  servicos: Scissors,
  comercio_com_servicos: Briefcase,
  controle_financeiro: Wallet,
  agenda_simples: CalendarClock,
  clientes_cobrancas: UsersRound,
  controle_estoque: Warehouse,
};

export interface InfoModelo {
  id: Modelo;
  nome: string;
  desc: string;
  exemplos: string;
  Icone: LucideIcon;
}

const info = (id: Modelo): InfoModelo => ({
  id,
  nome: TEMPLATE_LABELS[id],
  desc: TEMPLATE_DESCRIPTIONS[id].para,
  exemplos: TEMPLATE_DESCRIPTIONS[id].exemplos,
  Icone: ICONE[id],
});

export const MODELOS: InfoModelo[] = TEMPLATES_OFERECIDOS.map(info);

/** Modelos do modo avançado: os oferecidos e, se for o caso, o que o sistema já usa. */
export function modelosParaEscolher(atual: Modelo): InfoModelo[] {
  return MODELOS.some((m) => m.id === atual) ? MODELOS : [...MODELOS, info(atual)];
}

export const ehModelo = (valor: unknown): valor is Modelo =>
  typeof valor === "string" && (TEMPLATES as readonly string[]).includes(valor);

/**
 * Começo da primeira resposta na conversa com a IA quando o modelo veio da tela inicial: a pessoa
 * completa com o próprio negócio (nada é enviado sozinho, para não gastar IA).
 */
export const INICIO_DA_CONVERSA: Record<Modelo, string> = {
  comercio: "Vendo produtos e controlo estoque. Meu negócio é ",
  servicos: "Atendo clientes com hora marcada. Meu negócio é ",
  comercio_com_servicos: "Vendo produtos e também faço atendimentos agendados. Meu negócio é ",
  controle_financeiro: "Quero só controlar contas a pagar e a receber, ",
  agenda_simples: "Quero uma agenda para reservar horários de ",
  clientes_cobrancas: "Quero cadastrar clientes e controlar as cobranças de ",
  controle_estoque: "Quero controlar o que entra e sai do estoque de ",
};
