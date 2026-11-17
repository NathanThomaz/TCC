import {
  Briefcase,
  CalendarClock,
  Scissors,
  Store,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { TEMPLATE_DESCRIPTIONS, TEMPLATE_LABELS, TEMPLATES } from "../../shared/contract/catalog";
import type { Modelo } from "@/types/nexus";

// Os seis modelos como aparecem nas telas (tela inicial e modo avançado), a partir do catálogo.

const ICONE: Record<Modelo, LucideIcon> = {
  comercio: Store,
  servicos: Scissors,
  comercio_com_servicos: Briefcase,
  controle_financeiro: Wallet,
  agenda_simples: CalendarClock,
  clientes_cobrancas: UsersRound,
};

export interface InfoModelo {
  id: Modelo;
  nome: string;
  desc: string;
  exemplos: string;
  Icone: LucideIcon;
}

export const MODELOS: InfoModelo[] = TEMPLATES.map((id) => ({
  id,
  nome: TEMPLATE_LABELS[id],
  desc: TEMPLATE_DESCRIPTIONS[id].para,
  exemplos: TEMPLATE_DESCRIPTIONS[id].exemplos,
  Icone: ICONE[id],
}));

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
};
