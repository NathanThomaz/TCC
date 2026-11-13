import type { Env } from "../env";

// Cliente do Gemini no Worker (seção 21). A IA só interpreta e propõe: toda resposta passa pelo
// schema Zod e pelo validador do backend. Sem retries automáticos nem troca de modelo: falha
// pausa o chat e preserva o progresso (T30). Modelo congelado para o experimento (seção 25).

export const MODELO_GEMINI = "gemini-3.1-flash-lite";
/** Limite de resposta por chamada; calibrar no piloto (seção 21). */
export const MAX_TOKENS_SAIDA = 4096;
const TIMEOUT_MS = 30_000;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface PedidoIa {
  instrucoes: string;
  /** Histórico em ordem; o último item é o pedido atual. */
  mensagens: { papel: "usuario" | "modelo"; texto: string }[];
  /** JSON Schema já adaptado (adaptForGemini). */
  schema: Json;
}

export interface RespostaIa {
  /** Texto JSON devolvido pelo modelo (ainda não validado). */
  texto: string;
  tokensEntrada: number;
  tokensSaida: number;
}

export interface ProvedorIa {
  modelo: string;
  gerar(pedido: PedidoIa): Promise<RespostaIa>;
}

/** Falha da chamada (rede, cota, resposta vazia): mensagem segura, sem detalhes do provedor. */
export class IaIndisponivel extends Error {
  constructor(
    readonly motivo: string,
    /** Tokens informados pelo provedor mesmo na falha (ex.: resposta vazia): o custo é real. */
    readonly tokens?: { entrada: number; saida: number },
  ) {
    super(motivo);
    this.name = "IaIndisponivel";
  }
}

export function geminiDoAmbiente(env: Env, fetcher: typeof fetch = fetch): ProvedorIa | undefined {
  const chave = env.GEMINI_API_KEY;
  if (!chave) return undefined;

  async function chamar(pedido: PedidoIa, signal: AbortSignal): Promise<RespostaIa> {
    const resposta = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent`,
      {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-goog-api-key": chave ?? "" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: pedido.instrucoes }] },
          contents: pedido.mensagens.map((m) => ({
            role: m.papel === "usuario" ? "user" : "model",
            parts: [{ text: m.texto }],
          })),
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: pedido.schema,
            temperature: 0,
            maxOutputTokens: MAX_TOKENS_SAIDA,
          },
        }),
      },
    );
    if (!resposta.ok) {
      // Guarda o código e a explicação do provedor (sem a chave, que vai só no cabeçalho), para o
      // consumo de IA dizer por que falhou; ao usuário continua indo a mensagem genérica.
      const erro = await resposta
        .json<{ error?: { status?: string; message?: string } } | null>()
        .catch(() => null);
      const status = erro?.error?.status ? `_${erro.error.status}` : "";
      const detalhe = (erro?.error?.message ?? "").replace(/\s+/g, " ").slice(0, 200);
      const motivo = `http_${resposta.status}${status}${detalhe ? `: ${detalhe}` : ""}`;
      // 4xx: o provedor recusou o pedido sem gerar nada, então não houve cobrança (zero tokens) e
      // a reserva não fica presa como incerta. 5xx e falha de rede continuam incertos.
      throw new IaIndisponivel(
        motivo,
        resposta.status < 500 ? { entrada: 0, saida: 0 } : undefined,
      );
    }
    const corpo = await resposta.json<{
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        thoughtsTokenCount?: number;
      };
    } | null>();
    const uso = corpo?.usageMetadata;
    // Raciocínio é cobrado como saída.
    const tokens = uso
      ? {
          entrada: uso.promptTokenCount ?? 0,
          saida: (uso.candidatesTokenCount ?? 0) + (uso.thoughtsTokenCount ?? 0),
        }
      : undefined;
    const candidato = corpo?.candidates?.[0];
    const texto = candidato?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!texto) {
      throw new IaIndisponivel(`vazia_${candidato?.finishReason ?? "sem_motivo"}`, tokens);
    }
    return { texto, tokensEntrada: tokens?.entrada ?? 0, tokensSaida: tokens?.saida ?? 0 };
  }

  return {
    modelo: MODELO_GEMINI,
    async gerar(pedido) {
      const controle = new AbortController();
      // O prazo vale até ler o corpo inteiro: cabeçalhos rápidos com corpo lento também expiram.
      const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
      try {
        return await chamar(pedido, controle.signal);
      } catch (error) {
        if (error instanceof IaIndisponivel) throw error;
        throw new IaIndisponivel(controle.signal.aborted ? "tempo_esgotado" : "rede");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
