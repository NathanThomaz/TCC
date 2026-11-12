import { describe, expect, it } from "vitest";
import { geminiDoAmbiente, IaIndisponivel, MODELO_GEMINI } from "../../src/worker/ia/gemini";
import type { Env } from "../../src/worker/env";

// Cliente do Gemini com fetch simulado: formato do pedido, leitura de tokens e falhas (seção 21).

const pedido = {
  instrucoes: "Instruções",
  mensagens: [
    { papel: "usuario" as const, texto: "Olá" },
    { papel: "modelo" as const, texto: "Oi" },
    { papel: "usuario" as const, texto: "Tudo bem?" },
  ],
  schema: { type: "object" },
};

function comResposta(status: number, corpo: unknown) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const fetcher = ((url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(corpo), { status }));
  }) as unknown as typeof fetch;
  return { chamadas, fetcher };
}

const env = { GEMINI_API_KEY: "chave-ficticia" } as Env;

describe("cliente do Gemini", () => {
  it("sem chave não há provedor (chat indisponível)", () => {
    expect(geminiDoAmbiente({} as Env)).toBeUndefined();
  });

  it("monta o pedido com o modelo congelado, schema e temperatura zero; soma raciocínio à saída", async () => {
    const { chamadas, fetcher } = comResposta(200, {
      candidates: [{ content: { parts: [{ text: '{"ok":' }, { text: "true}" }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 5 },
    });
    const r = await geminiDoAmbiente(env, fetcher)!.gerar(pedido);
    expect(r).toEqual({ texto: '{"ok":true}', tokensEntrada: 100, tokensSaida: 25 });
    expect(chamadas[0]!.url).toContain(`models/${MODELO_GEMINI}:generateContent`);
    const enviado = JSON.parse(chamadas[0]!.init.body as string) as {
      contents: { role: string }[];
      generationConfig: { temperature: number; responseJsonSchema: unknown };
    };
    expect(enviado.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(enviado.generationConfig).toMatchObject({
      temperature: 0,
      responseJsonSchema: { type: "object" },
    });
    expect((chamadas[0]!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "chave-ficticia",
    );
  });

  it("erro HTTP e resposta vazia viram IaIndisponivel, sem detalhes do provedor", async () => {
    await expect(
      geminiDoAmbiente(env, comResposta(429, {}).fetcher)!.gerar(pedido),
    ).rejects.toThrow(IaIndisponivel);
    await expect(
      geminiDoAmbiente(
        env,
        comResposta(200, { candidates: [{ finishReason: "SAFETY" }] }).fetcher,
      )!.gerar(pedido),
    ).rejects.toMatchObject({ motivo: "vazia_SAFETY" });
  });
});
