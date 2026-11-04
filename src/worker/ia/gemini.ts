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
  constructor(readonly motivo: string) {
    super(motivo);
    this.name = "IaIndisponivel";
  }
}

export function geminiDoAmbiente(env: Env, fetcher: typeof fetch = fetch): ProvedorIa | undefined {
  const chave = env.GEMINI_API_KEY;
  if (!chave) return undefined;
  return {
    modelo: MODELO_GEMINI,
    async gerar(pedido) {
      const controle = new AbortController();
      const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
      let resposta: Response;
      try {
        resposta = await fetcher(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent`,
          {
            method: "POST",
            signal: controle.signal,
            headers: { "content-type": "application/json", "x-goog-api-key": chave },
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
      } catch {
        throw new IaIndisponivel(controle.signal.aborted ? "tempo_esgotado" : "rede");
      } finally {
        clearTimeout(timer);
      }
      if (!resposta.ok) throw new IaIndisponivel(`http_${resposta.status}`);
      const corpo = (await resposta.json().catch(() => null)) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          thoughtsTokenCount?: number;
        };
      } | null;
      const candidato = corpo?.candidates?.[0];
      const texto = candidato?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!texto) throw new IaIndisponivel(`vazia_${candidato?.finishReason ?? "sem_motivo"}`);
      const uso = corpo?.usageMetadata ?? {};
      return {
        texto,
        tokensEntrada: uso.promptTokenCount ?? 0,
        // Raciocínio é cobrado como saída.
        tokensSaida: (uso.candidatesTokenCount ?? 0) + (uso.thoughtsTokenCount ?? 0),
      };
    },
  };
}
