import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { SystemsApiBody } from "../../src/shared/api";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { LOGO_MAX_BYTES, tipoDoLogotipo } from "../../src/worker/modules/logotipo";
import { limparBanco } from "../limpar-banco";

// Logotipo (seções 5 e 29): PNG/JPEG até 200 KB, tipo pelo conteúdo, SVG proibido, servido com o
// tipo conferido e nosniff; só o administrador envia, quem tem acesso ao sistema vê.

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const IDENTITIES: Record<string, VerifiedToken> = {
  "token-admin-000000000000": {
    uid: "uid-a",
    email: "a@example.com",
    emailVerified: true,
    authTime: NOW,
  },
  "token-sec-00000000000000": {
    uid: "uid-s",
    email: "s@example.com",
    emailVerified: true,
    authTime: NOW,
  },
};
const ADMIN = "token-admin-000000000000";
const SEC = "token-sec-00000000000000";

const app = createApp({
  clock: { now: () => NOW },
  auth: () => ({
    verify: (token) => {
      const identity = IDENTITIES[token];
      return identity ? Promise.resolve(identity) : Promise.reject(new InvalidTokenError("x"));
    },
    lookup: () => Promise.resolve({ validSince: null, disabled: false }),
  }),
});

// Cabeçalhos mínimos reais: PNG com o bloco IHDR; JPEG com início (FFD8) e fim (FFD9).
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1,
]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0xff, 0xd9]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

async function enviar(sistema: string, corpo: Uint8Array, token = ADMIN, tipo = "image/png") {
  const r = await app(
    new Request(`https://app.test/api/v1/systems/${sistema}/logotipo`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": tipo },
      body: corpo,
    }),
    env,
  );
  return { status: r.status, body: await r.json<{ error?: { code: string } }>() };
}

async function obter(sistema: string, token = ADMIN) {
  return app(
    new Request(`https://app.test/api/v1/systems/${sistema}/logotipo`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    env,
  );
}

let S = "";
beforeEach(async () => {
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at) VALUES
     ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T}),
     ('s', 'uid-s', 's@example.com', 'secondary', 'active', 'a', ${T}, ${T})`,
  ).run();
  const r = await app(
    new Request("https://app.test/api/v1/systems", {
      method: "POST",
      headers: {
        authorization: `Bearer ${ADMIN}`,
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({ nome: "Loja" }),
    }),
    env,
  );
  S = (await r.json<SystemsApiBody>()).sistema!.id;
});

describe("logotipo", () => {
  it("tipo vem do conteúdo: PNG e JPEG sim; SVG, GIF e texto não", () => {
    expect(tipoDoLogotipo(PNG)).toBe("image/png");
    expect(tipoDoLogotipo(JPEG)).toBe("image/jpeg");
    expect(tipoDoLogotipo(SVG)).toBeNull();
    expect(tipoDoLogotipo(new TextEncoder().encode("GIF89a......"))).toBeNull();
    expect(tipoDoLogotipo(new Uint8Array([0x89, 0x50]))).toBeNull();
    // Assinatura colada na frente de outro conteúdo não passa.
    const disfarce = new Uint8Array([...PNG.slice(0, 8), ...SVG]);
    expect(tipoDoLogotipo(disfarce)).toBeNull();
    expect(tipoDoLogotipo(new Uint8Array([0xff, 0xd8, 0xff, ...SVG]))).toBeNull();
  });

  it("PNG enviado é servido com o tipo conferido e nosniff", async () => {
    // O Content-Type declarado não vale: o arquivo é PNG mesmo dito JPEG.
    expect((await enviar(S, PNG, ADMIN, "image/jpeg")).status).toBe(200);
    const r = await obter(S);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(PNG);
  });

  it("SVG é recusado mesmo declarado como PNG, e nada é gravado", async () => {
    const r = await enviar(S, SVG, ADMIN, "image/png");
    expect(r.status).toBe(415);
    expect(r.body.error!.code).toBe("logotipo_tipo_invalido");
    expect((await obter(S)).status).toBe(404);
  });

  it("corpo sem Content-Length acima de 200 KB é cortado durante a leitura", async () => {
    let enviados = 0;
    const fluxo = new ReadableStream<Uint8Array>({
      pull(c) {
        if (enviados > 3 * LOGO_MAX_BYTES) return c.close();
        enviados += 64 * 1024;
        c.enqueue(new Uint8Array(64 * 1024));
      },
    });
    const r = await app(
      new Request(`https://app.test/api/v1/systems/${S}/logotipo`, {
        method: "PUT",
        headers: { authorization: `Bearer ${ADMIN}` },
        body: fluxo,
        // @ts-expect-error duplex é exigido para corpo em fluxo
        duplex: "half",
      }),
      env,
    );
    expect(r.status).toBe(413);
    expect(enviados).toBeLessThan(3 * LOGO_MAX_BYTES);
  });

  it("sistema arquivado não muda de logotipo", async () => {
    await env.DB.prepare("UPDATE systems SET status = 'archived' WHERE id = ?").bind(S).run();
    expect((await enviar(S, PNG)).status).toBe(409);
  });

  it("acima de 200 KB é recusado", async () => {
    const grande = new Uint8Array(LOGO_MAX_BYTES + 1);
    grande.set(PNG);
    const r = await enviar(S, grande);
    expect(r.status).toBe(413);
    expect(r.body.error!.code).toBe("logotipo_grande_demais");
  });

  it("exatamente 200 KB é aceito; trocar por JPEG substitui; remover volta às iniciais", async () => {
    const limite = new Uint8Array(LOGO_MAX_BYTES);
    limite.set(PNG);
    limite.set([0xff, 0xd9], LOGO_MAX_BYTES - 2);
    expect((await enviar(S, limite)).status).toBe(200);
    expect((await enviar(S, JPEG, ADMIN, "image/jpeg")).status).toBe(200);
    expect((await obter(S)).headers.get("content-type")).toBe("image/jpeg");
    const del = await app(
      new Request(`https://app.test/api/v1/systems/${S}/logotipo`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${ADMIN}` },
      }),
      env,
    );
    expect(del.status).toBe(200);
    expect((await obter(S)).status).toBe(404);
  });

  it("conta secundária com acesso vê, mas não envia; sem acesso, não vê", async () => {
    await enviar(S, PNG);
    expect((await obter(S, SEC)).status).toBe(404);
    await env.DB.prepare(
      "INSERT INTO system_access (user_id, system_id, granted_by, created_at, updated_at) VALUES ('s', ?, 'a', ?, ?)",
    )
      .bind(S, NOW, NOW)
      .run();
    expect((await obter(S, SEC)).status).toBe(200);
    expect((await enviar(S, PNG, SEC)).status).toBe(403);
  });
});
