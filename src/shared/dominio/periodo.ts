// Mês de referência dos números "do mês" (tela inicial e painel do sistema): o filtro deixa ver os
// meses anteriores (pedido do dono, 2026-11-23, para a defesa em 02/12, quando dezembro mal começou).
// Só esses números mudam; "hoje" e o estado atual (estoque, contas em aberto) continuam de hoje.
import { deCampoLocal } from "./agenda";

/** Quantos meses o filtro oferece, contando o atual. */
export const MESES_NO_FILTRO = 12;

const NOMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-11" a partir de um dia "2026-11-23". */
export const mesDoDia = (dia: string) => dia.slice(0, 7);

/** Mês no formato AAAA-MM, existente e não posterior ao mês de `hoje`. */
export function mesValido(mes: string, hoje: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return false;
  const numero = Number(m[2]);
  return Number(m[1]) >= 2000 && numero >= 1 && numero <= 12 && mes <= mesDoDia(hoje);
}

function deslocar(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Do primeiro instante do mês ao primeiro do mês seguinte, no fuso do Nexus. */
export function limitesDoMes(mes: string): { inicio: number; fim: number } {
  return {
    inicio: deCampoLocal(`${mes}-01T00:00`)!,
    fim: deCampoLocal(`${deslocar(mes, 1)}-01T00:00`)!,
  };
}

/** Os meses do filtro, do atual para trás. */
export function mesesDoFiltro(hoje: string, quantos = MESES_NO_FILTRO): string[] {
  return Array.from({ length: quantos }, (_, k) => deslocar(mesDoDia(hoje), -k));
}

/** "2026-11" → "novembro de 2026". */
export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return `${NOMES[m - 1] ?? mes} de ${a}`;
}

/**
 * Como os números chamam o período: "no mês" para o mês de hoje; senão "em outubro" (com o ano
 * quando não é o de hoje: "em dezembro de 2025").
 */
export function rotuloDoMes(mes: string, hoje: string): string {
  if (!mes || mes === mesDoDia(hoje)) return "no mês";
  const nome = nomeDoMes(mes);
  return `em ${mes.slice(0, 4) === hoje.slice(0, 4) ? nome.split(" de ")[0] : nome}`;
}
