import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { caminho } from "@/lib/rotas";

vi.mock("@/lib/firebase", () => ({
  obterAuth: () =>
    Promise.resolve({ currentUser: { getIdToken: () => Promise.resolve("token-ficticio") } }),
}));

const { ApiError, chamar, quandoSessaoExpirar } = await import("./cliente");
const { salvarVersao } = await import("./sistemas");

interface Chamada {
  url: string;
  init: RequestInit;
}
let chamadas: Chamada[] = [];

function responder(status: number, corpo: unknown) {
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    return Promise.resolve(Response.json(corpo, { status }));
  });
}

beforeEach(() => {
  chamadas = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  quandoSessaoExpirar(undefined);
});

describe("chamar", () => {
  it("envia o ID token e a Idempotency-Key", async () => {
    responder(201, { sistema: { id: "s1" } });
    await chamar("/systems", { method: "POST", body: { nome: "X" }, chave: "chave-123" });
    const headers = chamadas[0]!.init.headers as Record<string, string>;

    expect(chamadas[0]!.url).toBe("/api/v1/systems");
    expect(headers.authorization).toBe("Bearer token-ficticio");
    expect(headers["idempotency-key"]).toBe("chave-123");
    expect(headers["content-type"]).toBe("application/json");
  });

  it("converte o erro padronizado da API em ApiError com código e status", async () => {
    responder(409, {
      error: { code: "versao_nao_aprovada", message: "Aprove antes.", requestId: "r" },
    });
    const erro = await chamar("/x").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({ code: "versao_nao_aprovada", status: 409 });
  });

  it("401 com sessão aberta avisa que a sessão expirou", async () => {
    const aviso = vi.fn();
    quandoSessaoExpirar(aviso);
    responder(401, { error: { code: "unauthenticated", message: "Faça login.", requestId: "r" } });
    await chamar("/x").catch(() => undefined);

    expect(aviso).toHaveBeenCalledOnce();
  });

  it("falha de rede vira serviço indisponível", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("rede")));

    await expect(chamar("/x")).rejects.toMatchObject({ code: "servico_indisponivel" });
  });
});

describe("salvarVersao", () => {
  it("estrutura inválida (422) devolve o diagnóstico sem versão", async () => {
    const issues = [
      { code: "estrutura_invalida", severity: "bloqueante", path: "modelo", message: "x" },
    ];
    responder(422, { versao: null, issues });

    await expect(salvarVersao("s1", {} as never, "chave-abc")).resolves.toEqual({
      versao: null,
      issues,
    });
    expect(JSON.parse(chamadas[0]!.init.body as string)).toMatchObject({ origem: "formulario" });
  });
});

describe("caminho (adaptador de rotas)", () => {
  it("troca parâmetros, monta a busca e mantém o caminho atual sem `to`", () => {
    expect(caminho({ to: "/sistemas/$id", params: { id: "a b" } }, "/")).toBe("/sistemas/a%20b");
    expect(caminho({ search: { passo: 3, vazio: undefined } }, "/sistemas/x/configurar")).toBe(
      "/sistemas/x/configurar?passo=3",
    );
  });
});
