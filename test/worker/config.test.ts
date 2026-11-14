import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { PublicConfig } from "../../src/shared/api";
import { createApp } from "../../src/worker/app";
import { systemClock } from "../../src/worker/lib/clock";

const app = createApp({ clock: systemClock });
const get = async (e: typeof env) =>
  (await app(new Request("https://app.test/api/v1/config"), e)).json<PublicConfig>();

describe("GET /api/v1/config", () => {
  it("sem Firebase configurado, informa login indisponível", async () => {
    expect(await get(env)).toEqual({
      environment: "development",
      firebase: null,
      cadastroAberto: false,
    });
  });

  it("com as quatro variáveis, devolve só a configuração pública do SDK web", async () => {
    const body = await get({
      ...env,
      FIREBASE_WEB_API_KEY: "chave-web-ficticia",
      FIREBASE_AUTH_DOMAIN: "projeto-ficticio.firebaseapp.com",
      FIREBASE_PROJECT_ID: "projeto-ficticio",
      FIREBASE_APP_ID: "1:0:web:ficticio",
      FIREBASE_SERVICE_ACCOUNT: '{"client_email":"x","private_key":"segredo"}',
    });

    expect(body.firebase).toEqual({
      apiKey: "chave-web-ficticia",
      authDomain: "projeto-ficticio.firebaseapp.com",
      projectId: "projeto-ficticio",
      appId: "1:0:web:ficticio",
    });
    expect(JSON.stringify(body)).not.toContain("segredo");
    expect(body.cadastroAberto).toBe(true);
  });

  it("cadastro fechado pela variável (ADR-009)", async () => {
    const body = await get({
      ...env,
      CADASTRO_ABERTO: "false",
      FIREBASE_WEB_API_KEY: "chave-web-ficticia",
      FIREBASE_AUTH_DOMAIN: "projeto-ficticio.firebaseapp.com",
      FIREBASE_PROJECT_ID: "projeto-ficticio",
      FIREBASE_APP_ID: "1:0:web:ficticio",
    });
    expect(body.cadastroAberto).toBe(false);
  });
});
