import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ApiErrorBody, HealthResponse } from "../../src/shared/api";

describe("GET /api/v1/health", () => {
  it("responde ok com D1 acessível", async () => {
    const response = await SELF.fetch("https://app.test/api/v1/health");
    const body = await response.json<HealthResponse>();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      environment: "development",
      checks: { database: "ok" },
    });
    expect(Date.parse(body.time)).not.toBeNaN();
  });

  it("envia cabeçalhos de segurança e não permite cache", async () => {
    const response = await SELF.fetch("https://app.test/api/v1/health");

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("recusa outros métodos com 405 e cabeçalho Allow", async () => {
    const response = await SELF.fetch("https://app.test/api/v1/health", { method: "POST" });
    const body = await response.json<ApiErrorBody>();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(body.error.code).toBe("method_not_allowed");
  });
});

describe("rotas desconhecidas da API", () => {
  it("retornam 404 JSON padronizado, nunca o index.html da SPA", async () => {
    for (const path of ["/api/inexistente", "/api/v1/systems/abc/nada"]) {
      const response = await SELF.fetch(`https://app.test${path}`);
      const body = await response.json<ApiErrorBody>();

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(body.error).toEqual({
        code: "not_found",
        message: expect.any(String) as string,
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      });
    }
  });
});
