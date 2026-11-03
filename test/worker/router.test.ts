import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createRouter, matchPath } from "../../src/worker/http/router";
import { conflict } from "../../src/worker/http/errors";
import { json } from "../../src/worker/http/responses";
import { fixedClock } from "../../src/worker/lib/clock";
import type { ApiErrorBody } from "../../src/shared/api";

describe("matchPath", () => {
  it("extrai parâmetros decodificados", () => {
    expect(matchPath("/api/v1/systems/:systemId", "/api/v1/systems/a%20b")).toEqual({
      systemId: "a b",
    });
  });

  it("não casa com quantidade diferente de segmentos, segmento vazio ou codificação inválida", () => {
    expect(matchPath("/api/v1/systems/:systemId", "/api/v1/systems")).toBeNull();
    expect(matchPath("/api/v1/systems/:systemId", "/api/v1/systems/")).toBeNull();
    expect(matchPath("/api/v1/systems/:systemId", "/api/v1/systems/a/b")).toBeNull();
    expect(matchPath("/api/v1/systems/:systemId", "/api/v1/systems/%E0%A4%A")).toBeNull();
  });
});

describe("createRouter", () => {
  const clock = fixedClock(Date.UTC(2026, 10, 4, 12, 0, 0));
  const handle = createRouter(
    [
      {
        method: "GET",
        path: "/api/v1/systems/:systemId",
        handler: ({ params, clock: c }) => json({ id: params.systemId, now: c.now() }),
      },
      {
        method: "POST",
        path: "/api/v1/systems/:systemId",
        handler: () => {
          throw conflict("Já existe.", { detalheInterno: "não vai para a resposta" });
        },
      },
      {
        method: "GET",
        path: "/api/v1/falha",
        handler: () => {
          throw new Error("segredo interno");
        },
      },
    ],
    { clock },
  );

  it("entrega parâmetros e o relógio injetado ao handler", async () => {
    const response = await handle(new Request("https://app.test/api/v1/systems/s1"), env);

    expect(await response.json()).toEqual({ id: "s1", now: Date.UTC(2026, 10, 4, 12, 0, 0) });
  });

  it("converte AppError em resposta sem o contexto interno", async () => {
    const response = await handle(
      new Request("https://app.test/api/v1/systems/s1", { method: "POST" }),
      env,
    );
    const text = await response.text();

    expect(response.status).toBe(409);
    expect((JSON.parse(text) as ApiErrorBody).error.code).toBe("conflict");
    expect(text).not.toContain("detalheInterno");
  });

  it("esconde erros inesperados atrás de 500 genérico", async () => {
    const response = await handle(new Request("https://app.test/api/v1/falha"), env);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect((JSON.parse(text) as ApiErrorBody).error.code).toBe("internal_error");
    expect(text).not.toContain("segredo interno");
  });

  it("lista métodos permitidos no 405", async () => {
    const response = await handle(
      new Request("https://app.test/api/v1/systems/s1", { method: "DELETE" }),
      env,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });
});
