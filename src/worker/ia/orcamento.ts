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
 * Limite superior dos tokens de entrada: o tokenizador cobre qualquer texto por bytes, então um
 * token tem pelo menos um byte UTF-8 e o número de bytes nunca fica abaixo do de tokens (inclusive
 * com acentos e emoji). Exagera o custo de propósito: a reserva é o pior caso.
 */
export function estimarTokens(pedido: PedidoIa): number {
  const bytes = (texto: string) => new TextEncoder().encode(texto).byteLength;
  return (
    bytes(pedido.instrucoes) +
    bytes(JSON.stringify(pedido.schema)) +
    pedido.mensagens.reduce((soma, m) => soma + bytes(m.texto), 0)
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
 * Solta a chave de uma chamada concluída cujo resultado NÃO foi gravado (resposta inválida, estado
 * alterado): a repetição com a mesma chave pode tentar de novo. Sem isso, a chave fica travada até
 * o resultado ser gravado, para uma repetição em paralelo não pagar a IA de novo.
 */
export async function liberarChave(ctx: Pick<RequestContext, "env">, usoId: string) {
  await ctx.env.DB.prepare("UPDATE ai_usage SET idempotency_key = NULL WHERE id = ?")
    .bind(usoId)
    .run();
}

/** Roda o que vem depois da IA; se falhar, solta a chave antes de propagar o erro. */
export async function aposIa<T>(
  ctx: Pick<RequestContext, "env">,
  usoId: string,
  passo: () => Promise<T>,
): Promise<T> {
  try {
    return await passo();
  } catch (error) {
    await liberarChave(ctx, usoId);
    throw error;
  }
}

/**
 * Executa uma chamada dentro do orçamento: reserva o pior caso → chama → registra o consumo.
 * Lança `limite_ia` sem chamar o provedor quando a reserva não cabe no teto, e
 * `ia_em_andamento` se a mesma chave já tem uma chamada aberta ou concluída sem resultado gravado.
 */
export async function chamarComOrcamento(
  ctx: Pick<RequestContext, "env" | "clock" | "log">,
  provedor: ProvedorIa,
  chamada: ChamadaIa,
  pedido: PedidoIa,
): Promise<RespostaIa & { usoId: string }> {
  const db = ctx.env.DB;
  const agora = ctx.clock.now();
  const reserva = custoMicroBrl(estimarTokens(pedido), MAX_TOKENS_SAIDA);
  const id = crypto.randomUUID();
  let inserida: D1Result;
  try {
    const [, , resultado] = await db.batch([
      // Reserva parada (Worker interrompido): continua contando pelo valor reservado, mas solta a chave.
      db
        .prepare(
          "UPDATE ai_usage SET state = 'incerto', error = 'reserva_parada' WHERE state = 'reservado' AND created_at < ?",
        )
        .bind(agora - RESERVA_PARADA_MS),
      // Chamada concluída há tempo: o resultado já foi gravado (e a repetição vira replay) ou se perdeu.
      db
        .prepare(
          "UPDATE ai_usage SET idempotency_key = NULL WHERE state = 'concluido' AND idempotency_key IS NOT NULL AND finished_at < ?",
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
  return { ...resposta, usoId: id };
}
