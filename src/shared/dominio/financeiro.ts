// Multa e juros por atraso (regra multa_juros_atraso, ADR-015): mesma conta na tela e no
// servidor. Multa única sobre o valor; juros ao mês, proporcionais aos dias de atraso (mês de 30
// dias). Datas no formato AAAA-MM-DD (dia local do Nexus).

export interface MultaJuros {
  multa_percentual: number;
  juros_mes_percentual: number;
}

const DIA_MS = 86_400_000;

/** Dias inteiros entre o vencimento e o pagamento (0 se pago no dia ou antes). */
export function diasDeAtraso(vencimento: string, pagamento: string): number {
  const v = Date.parse(`${vencimento}T00:00:00Z`);
  const p = Date.parse(`${pagamento}T00:00:00Z`);
  return Math.max(0, Math.round((p - v) / DIA_MS));
}

/** Valor a cobrar (centavos) de uma conta a receber paga em `pagamento`. */
export function valorComEncargos(
  valorCentavos: number,
  vencimento: string,
  pagamento: string,
  regra: MultaJuros | null,
): { totalCentavos: number; multaCentavos: number; jurosCentavos: number; dias: number } {
  const dias = diasDeAtraso(vencimento, pagamento);
  if (!regra || dias === 0) {
    return { totalCentavos: valorCentavos, multaCentavos: 0, jurosCentavos: 0, dias };
  }
  // Percentuais em centésimos (2,5% = 250) para não acumular erro de ponto flutuante.
  const multaBp = Math.round(regra.multa_percentual * 100);
  const jurosBp = Math.round(regra.juros_mes_percentual * 100);
  const multaCentavos = Math.round((valorCentavos * multaBp) / 10_000);
  const jurosCentavos = Math.round((valorCentavos * jurosBp * dias) / (10_000 * 30));
  return {
    totalCentavos: valorCentavos + multaCentavos + jurosCentavos,
    multaCentavos,
    jurosCentavos,
    dias,
  };
}
