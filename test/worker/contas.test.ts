import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ContasApiBody, OperacaoApiBody, SystemsApiBody } from "../../src/shared/api";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { DISTRIBUIDORA } from "../fixtures/distribuidora";
import { limparBanco } from "../limpar-banco";

// Contas secundárias mínimas (seção 7, P0): convite, vínculo por sistema, revogação e
// desativação (T01, T02, T03, T04).

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
let agora = NOW;
const IDENTITIES: Record<string, VerifiedToken> = {
  "token-admin-000000000000": {
    uid: "uid-a",
    email: "a@example.com",
    emailVerified: true,
    authTime: NOW,
  },
  "token-admin2-00000000000": {
    uid: "uid-b",
    email: "b@example.com",
    emailVerified: true,
    authTime: NOW,
  },
  "token-novo-0000000000000": {
    uid: "uid-n",
    email: "novo@example.com",
    emailVerified: true,
    authTime: NOW,
  },
};
const ADMIN = "token-admin-000000000000";
const ADMIN2 = "token-admin2-00000000000";
const NOVO = "token-novo-0000000000000";

/** Firebase simulado: registra convites, desativações e reativações. */
let chamadas: string[] = [];
let falharConvite = false;
let firebaseDesativado = new Set<string>();

const app = createApp({
  clock: { now: () => agora },
  auth: () => ({
    verify: (token) => {
      const identity = IDENTITIES[token];
      return identity ? Promise.resolve(identity) : Promise.reject(new InvalidTokenError("x"));
    },
    lookup: (uid) => Promise.resolve({ validSince: null, disabled: firebaseDesativado.has(uid) }),
    contas: {
      invite: (email) => {
        chamadas.push(`convite:${email}`);
        return falharConvite ? Promise.reject(new Error("rede")) : Promise.resolve();
      },
      disable: (uid) => {
        chamadas.push(`desativar:${uid}`);
        firebaseDesativado.add(uid);
        return Promise.resolve();
      },
      enable: (uid) => {
        chamadas.push(`reativar:${uid}`);
        firebaseDesativado.delete(uid);
        return Promise.resolve();
      },
    },
  }),
});

type Body = ContasApiBody & SystemsApiBody & OperacaoApiBody;

async function call(method: string, path: string, token: string, body?: unknown, key?: string) {
  const response = await app(
    new Request(`https://app.test/api/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(method === "POST" ? { "idempotency-key": key ?? crypto.randomUUID() } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
  );
  return { status: response.status, body: await response.json<Body>() };
}

async function ativar(token: string, nome: string): Promise<string> {
  const id = (await call("POST", "/systems", token, { nome })).body.sistema!.id;
  const v = (
    await call("POST", `/systems/${id}/versions`, token, {
      origem: "formulario",
      rascunho: DISTRIBUIDORA,
    })
  ).body.versao!;
  await call("POST", `/systems/${id}/versions/${v.id}/approve`, token, { hash: v.hash });
  await call("POST", `/systems/${id}/activate`, token, { versao: v.id });
  return id;
}

let S1 = "";
let S2 = "";

beforeEach(async () => {
  agora = NOW;
  chamadas = [];
  falharConvite = false;
  firebaseDesativado = new Set();
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at) VALUES
     ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T}),
     ('b', 'uid-b', 'b@example.com', 'admin', 'active', NULL, ${T}, ${T})`,
  ).run();
  S1 = await ativar(ADMIN, "Distribuidora");
  S2 = await ativar(ADMIN, "Filial");
});

async function convidar(sistemas: string[], email = "novo@example.com") {
  return call("POST", "/contas", ADMIN, { email, nome: "Bruno", sistemas });
}

describe("contas secundárias", () => {
  it("convite: conta pendente com os sistemas escolhidos e link pedido ao Firebase", async () => {
    const r = await convidar([S1]);
    expect(r.status).toBe(201);
    expect(r.body.conviteEnviado).toBe(true);
    expect(r.body.conta).toMatchObject({
      email: "novo@example.com",
      nome: "Bruno",
      status: "pending",
    });
    expect(r.body.conta!.sistemas.map((s) => [s.nome, s.ativo])).toEqual([
      ["Distribuidora", true],
      ["Filial", false],
    ]);
    expect(chamadas).toEqual(["convite:novo@example.com"]);
    expect((await convidar([S1])).body.error!.code).toBe("email_em_uso");
  });

  it("primeiro acesso ativa a conta; ela opera só o sistema autorizado (T04)", async () => {
    await convidar([S1]);
    expect((await call("GET", `/systems/${S1}/produtos`, NOVO)).status).toBe(200);
    expect((await call("GET", `/systems/${S2}/produtos`, NOVO)).status).toBe(404);
    expect((await call("GET", "/contas", ADMIN)).body.contas![0]!.status).toBe("active");
  });

  it("T02: secundário não gerencia contas nem cria sistemas", async () => {
    await convidar([S1]);
    expect((await call("GET", "/contas", NOVO)).status).toBe(403);
    expect(
      (await call("POST", "/contas", NOVO, { email: "x@example.com", sistemas: [] })).status,
    ).toBe(403);
    expect((await call("POST", "/systems", NOVO, { nome: "Meu" })).status).toBe(403);
  });

  it("sistema de outro administrador não entra no convite, e nada é gravado", async () => {
    const alheio = await ativar(ADMIN2, "Alheio");
    const r = await convidar([S1, alheio]);
    expect(r.status).toBe(409);
    const n = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM users WHERE email = 'novo@example.com'",
    ).first<{
      n: number;
    }>();
    expect(n!.n).toBe(0);
    expect(chamadas).toEqual([]);
  });

  it("T03: revogar bloqueia a API do sistema; conceder de novo libera", async () => {
    const id = (await convidar([S1])).body.conta!.id;
    await call("GET", "/session", NOVO); // primeiro acesso
    const revogado = await call("POST", `/contas/${id}/acessos`, ADMIN, {
      sistema: S1,
      ativo: false,
    });
    expect(revogado.body.conta!.sistemas[0]!.ativo).toBe(false);
    expect((await call("GET", `/systems/${S1}/vendas`, NOVO)).status).toBe(404);
    await call("POST", `/contas/${id}/acessos`, ADMIN, { sistema: S2, ativo: true });
    expect((await call("GET", `/systems/${S2}/vendas`, NOVO)).status).toBe(200);
  });

  it("T01: desativar bloqueia na hora, revoga acessos e o Firebase; reativar exige revisar acessos", async () => {
    const id = (await convidar([S1, S2])).body.conta!.id;
    await call("GET", "/session", NOVO);
    agora = NOW + 1000;
    const d = await call("POST", `/contas/${id}/status`, ADMIN, { status: "disabled" });
    expect(d.body.conta).toMatchObject({ status: "disabled" });
    expect(d.body.conta!.sistemas.every((s) => !s.ativo)).toBe(true);
    expect((await call("GET", "/session", NOVO)).status).toBe(403);
    expect(chamadas).toContain("desativar:uid-n");
    // Sem reativar, conceder acesso é recusado.
    expect(
      (await call("POST", `/contas/${id}/acessos`, ADMIN, { sistema: S1, ativo: true })).status,
    ).toBe(409);

    const r = await call("POST", `/contas/${id}/status`, ADMIN, { status: "active" });
    expect(r.body.conta).toMatchObject({ status: "active" });
    expect(r.body.conta!.sistemas.every((s) => !s.ativo)).toBe(true);
    expect(chamadas).toContain("reativar:uid-n");
    // A sessão anterior à desativação continua inválida: é preciso entrar de novo.
    expect((await call("GET", "/session", NOVO)).status).toBe(401);
  });

  it("convite que falha no Firebase: a conta fica pendente e o convite é reenviado", async () => {
    falharConvite = true;
    const r = await convidar([S1]);
    expect(r.status).toBe(201);
    expect(r.body.conviteEnviado).toBe(false);
    falharConvite = false;
    const de_novo = await call("POST", `/contas/${r.body.conta!.id}/convite`, ADMIN, {});
    expect(de_novo.body.conviteEnviado).toBe(true);
    expect(chamadas).toEqual(["convite:novo@example.com", "convite:novo@example.com"]);
  });

  it("convite repetido com a mesma chave não duplica conta nem convite", async () => {
    const corpo = { email: "novo@example.com", sistemas: [S1] };
    const a = await call("POST", "/contas", ADMIN, corpo, "chave-convite-1");
    const b = await call("POST", "/contas", ADMIN, corpo, "chave-convite-1");
    expect(b.body.conta!.id).toBe(a.body.conta!.id);
    expect(chamadas).toHaveLength(1);
  });

  it("outro administrador não vê nem altera a conta", async () => {
    const id = (await convidar([S1])).body.conta!.id;
    expect((await call("GET", "/contas", ADMIN2)).body.contas).toEqual([]);
    expect(
      (await call("POST", `/contas/${id}/status`, ADMIN2, { status: "disabled" })).status,
    ).toBe(404);
  });
});
