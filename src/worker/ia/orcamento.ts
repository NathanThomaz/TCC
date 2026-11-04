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

/**
 * Limite superior dos tokens de entrada: um token tem pelo menos um caractere, então o número de
 * caracteres nunca fica abaixo do de tokens. Exagera o custo de propósito (a reserva é o pior caso).
 */
export function estimarTokens(pedido: PedidoIa): number {
  return (
    pedido.instrucoes.length +
    JSON.stringify(pedido.schema).length +
    pedido.mensagens.reduce((soma, m) => soma + m.texto.length, 0)
  );
}

/** Reserva sem resposta depois disto (Worker interrompido) deixa de travar a chave e fica incerta. */
const RESERVA_PARADA_MS = 5 * 60_000;
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

export const chamadaEmAndamento = () =>
  new AppError(
    409,
    "ia_em_andamento",
    "Este pedido já está sendo respondido pela IA. Aguarde e recarregue.",
  );

export interface ChamadaIa {
  sistema: string;
  usuario: string;
  finalidade: "levantamento" | "modelagem" | "correcao" | "consulta";
  /** Idempotency-Key do pedido: trava a chave enquanto a chamada está em andamento. */
  chave: string;
}

/** Soma do mês que conta para o teto (ver migration 0004). */
const CONSUMO_DO_MES = `(SELECT COALESCE(SUM(CASE state
    WHEN 'concluido' THEN cost_micro_brl
    WHEN 'falhou' THEN COALESCE(cost_micro_brl, 0)
    ELSE reserved_micro_brl END), 0) FROM ai_usage WHERE created_at >= ?8)`;

/**
 * Executa uma chamada dentro do orçamento: reserva o pior caso → chama → registra o consumo.
 * Lança `limite_ia` sem chamar o provedor quando a reserva não cabe no teto, e
 * `ia_em_andamento` se a mesma chave já tem uma chamada aberta.
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
  let inserida: D1Result;
  try {
    const [, resultado] = await db.batch([
      // Reserva parada (Worker interrompido): continua contando pelo valor reservado, mas solta a chave.
      db
        .prepare(
          "UPDATE ai_usage SET state = 'incerto', error = 'reserva_parada' WHERE state = 'reservado' AND created_at < ?",
        )
        .bind(agora - RESERVA_PARADA_MS),
      db
        .prepare(
          `INSERT INTO ai_usage (id, system_id, user_id, purpose, model, idempotency_key, reserved_micro_brl, created_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?10, ?6, ?7 WHERE ${CONSUMO_DO_MES} + ?6 <= ?9`,
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
          chamada.chave,
        ),
    ]);
    inserida = resultado!;
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) throw chamadaEmAndamento();
    throw error;
  }
  if (inserida.meta.changes !== 1) throw limiteAtingido();

  let resposta: RespostaIa;
  try {
    resposta = await provedor.gerar(pedido);
  } catch (error) {
    const motivo = error instanceof IaIndisponivel ? error.motivo : "erro_inesperado";
    const tokens = error instanceof IaIndisponivel ? error.tokens : undefined;
    // Com tokens informados, conta o custo real; sem eles, a chamada pode ter sido cobrada: fica
    // incerta e continua contando pelo valor reservado até a conciliação (seção 21).
    await db
      .prepare(
        `UPDATE ai_usage SET state = ?, error = ?, input_tokens = ?, output_tokens = ?, cost_micro_brl = ?,
           finished_at = ? WHERE id = ?`,
      )
      .bind(
        tokens ? "falhou" : "incerto",
        motivo,
        tokens?.entrada ?? null,
        tokens?.saida ?? null,
        tokens ? custoMicroBrl(tokens.entrada, tokens.saida) : null,
        ctx.clock.now(),
        id,
      )
      .run();
    ctx.log.warn("ia.falhou", { motivo, finalidade: chamada.finalidade });
    if (error instanceof IaIndisponivel) throw iaIndisponivel();
    throw error;
  }
  // Se esta gravação falhar, a reserva fica parada e vira incerta (contada pelo pior caso).
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
}
