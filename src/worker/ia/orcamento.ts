import type { Env } from "../env";
import { AppError } from "../http/errors";
import type { RequestContext } from "../http/router";
import {
  IaIndisponivel,
  MAX_TOKENS_SAIDA,
  type PedidoIa,
  type ProvedorIa,
  type RespostaIa,
} from "./gemini";

// Orçamento da IA (seção 21): teto do Nexus de R$ 20/mês, compartilhado por todos os usuários e
// sistemas. Antes de cada chamada, reserva o pior caso (entrada estimada + saída máxima); a
// reserva entra no lote de forma condicional, então duas chamadas simultâneas não estouram o teto.
// Depois da chamada, grava o consumo real. Estimativa ≠ custo faturado: câmbio e IOF conservadores.

/** Preço oficial consultado em 2026-11-03 (provas/gemini-schema), US$ por 1M de tokens. */
const PRECO_USD_POR_MILHAO = { entrada: 0.25, saida: 1.5 };
const USD_BRL = 6.0;
const IOF = 0.0438;
const MICRO = 1_000_000;
export const TETO_PADRAO_CENTAVOS = 2000;

export function custoMicroBrl(tokensEntrada: number, tokensSaida: number): number {
  const usd =
    (tokensEntrada * PRECO_USD_POR_MILHAO.entrada + tokensSaida * PRECO_USD_POR_MILHAO.saida) /
    MICRO;
  return Math.ceil(usd * USD_BRL * (1 + IOF) * MICRO);
}

/** Tokens de entrada estimados pelo tamanho do texto: 3 caracteres por token, do lado conservador. */
export function estimarTokens(pedido: PedidoIa): number {
  const caracteres =
    pedido.instrucoes.length +
    JSON.stringify(pedido.schema).length +
    pedido.mensagens.reduce((soma, m) => soma + m.texto.length, 0);
  return Math.ceil(caracteres / 3);
}

function tetoMicroBrl(env: Env): number {
  const centavos = Number(env.IA_TETO_MENSAL_CENTAVOS ?? TETO_PADRAO_CENTAVOS);
  return (Number.isFinite(centavos) && centavos >= 0 ? centavos : TETO_PADRAO_CENTAVOS) * 10_000;
}

/** Início do mês corrente em UTC (o teto é mensal). */
function inicioDoMes(agora: number): number {
  const d = new Date(agora);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export const limiteAtingido = () =>
  new AppError(
    503,
    "limite_ia",
    "O limite mensal de uso da IA foi atingido. A conversa está pausada; o progresso foi salvo e as telas continuam disponíveis.",
  );

export const iaIndisponivel = () =>
  new AppError(
    503,
    "ia_indisponivel",
    "A IA não respondeu agora. Nada se perdeu: tente de novo em instantes.",
  );

export const iaNaoConfigurada = () =>
  new AppError(503, "ia_nao_configurada", "A IA não está configurada neste ambiente.");

export interface ChamadaIa {
  sistema: string;
  usuario: string;
  finalidade: "levantamento" | "modelagem" | "correcao" | "consulta";
}

/**
 * Executa uma chamada dentro do orçamento: reserva → chama → registra o consumo (ou a falha).
 * Lança `limite_ia` sem chamar o provedor quando a reserva não cabe no teto.
 */
export async function chamarComOrcamento(
  ctx: Pick<RequestContext, "env" | "clock" | "log">,
  provedor: ProvedorIa,
  chamada: ChamadaIa,
  pedido: PedidoIa,
): Promise<RespostaIa> {
  const db = ctx.env.DB;
  const agora = ctx.clock.now();
  const reserva = custoMicroBrl(estimarTokens(pedido), MAX_TOKENS_SAIDA);
  const id = crypto.randomUUID();
  const inserida = await db
    .prepare(
      `INSERT INTO ai_usage (id, system_id, user_id, purpose, model, reserved_micro_brl, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
       WHERE (SELECT COALESCE(SUM(CASE state WHEN 'concluido' THEN cost_micro_brl
                                             WHEN 'reservado' THEN reserved_micro_brl ELSE 0 END), 0)
              FROM ai_usage WHERE created_at >= ?8) + ?6 <= ?9`,
    )
    .bind(
      id,
      chamada.sistema,
      chamada.usuario,
      chamada.finalidade,
      provedor.modelo,
      reserva,
      agora,
      inicioDoMes(agora),
      tetoMicroBrl(ctx.env),
    )
    .run();
  if (inserida.meta.changes !== 1) throw limiteAtingido();

  try {
    const resposta = await provedor.gerar(pedido);
    await db
      .prepare(
        `UPDATE ai_usage SET state = 'concluido', input_tokens = ?, output_tokens = ?, cost_micro_brl = ?,
           finished_at = ? WHERE id = ?`,
      )
      .bind(
        resposta.tokensEntrada,
        resposta.tokensSaida,
        custoMicroBrl(resposta.tokensEntrada, resposta.tokensSaida),
        ctx.clock.now(),
        id,
      )
      .run();
    return resposta;
  } catch (error) {
    const motivo = error instanceof IaIndisponivel ? error.motivo : "erro_inesperado";
    // Falha não cobrada é liberada; o provedor pode ter cobrado a entrada, mas sem os tokens
    // informados não há como estimar melhor (reconciliar com o painel do provedor, seção 21).
    await db
      .prepare("UPDATE ai_usage SET state = 'falhou', error = ?, finished_at = ? WHERE id = ?")
      .bind(motivo, ctx.clock.now(), id)
      .run();
    ctx.log.warn("ia.falhou", { motivo, finalidade: chamada.finalidade });
    if (error instanceof IaIndisponivel) throw iaIndisponivel();
    throw error;
  }
}
