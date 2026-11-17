import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigDraft } from "../../src/shared/contract/schema";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { limparBanco } from "../limpar-banco";

// Modelos novos (ADR-015): um sistema só com o que o modelo tem funciona de ponta a ponta.

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
const ADMIN = "token-admin-000000000000";
const IDENTITIES: Record<string, VerifiedToken> = {
  [ADMIN]: { uid: "uid-a", email: "a@example.com", emailVerified: true, authTime: NOW },
};

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

async function call<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T & { error?: { code: string } } }> {
  const response = await app(
    new Request(`https://app.test/api/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${ADMIN}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(method === "POST" ? { "idempotency-key": crypto.randomUUID() } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
  );
  return { status: response.status, body: await response.json() };
}

function rascunho(modelo: ConfigDraft["modelo"], modulos: ConfigDraft["modulos"]): ConfigDraft {
  return {
    modelo,
    modulos,
    aparencia: {
      nome: "Minhas contas",
      titulo: "Minhas contas",
      cor_primaria: "#1f4e79",
      cor_destaque: "#f2a900",
    },
    requisitos: [
      { id: "REQ-01", texto: "Controlar contas a pagar e a receber", status: "confirmado" },
    ],
    campos: [],
    tipos_atendimento: [],
    regras: [],
    fora_do_catalogo: [],
  };
}

async function ativar(draft: ConfigDraft) {
  const id = (
    await call<{ sistema: { id: string } }>("POST", "/systems", { nome: draft.aparencia.nome })
  ).body.sistema.id;
  const versao = (
    await call<{ versao: { id: string; hash: string; status: string } }>(
      "POST",
      `/systems/${id}/versions`,
      { origem: "formulario", rascunho: draft },
    )
  ).body.versao;
  expect(versao.status).toBe("valid");
  await call("POST", `/systems/${id}/versions/${versao.id}/approve`, { hash: versao.hash });
  expect((await call("POST", `/systems/${id}/activate`, { versao: versao.id })).status).toBe(200);
  return id;
}

beforeEach(async () => {
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at)
     VALUES ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T})`,
  ).run();
});

describe("controle financeiro (só o módulo financeiro)", () => {
  it("ativa, lança contas sem cliente, mostra o painel e recusa o que o modelo não tem", async () => {
    const id = await ativar(rascunho("controle_financeiro", ["financeiro"]));
    const p = (x: string) => `/systems/${id}${x}`;

    const conta = await call("POST", p("/financeiro"), {
      tipo: "pagar",
      descricao: "Aluguel",
      valorCentavos: 150000,
      vencimento: "2026-11-20",
    });
    expect(conta.status).toBe(201);
    const receber = await call("POST", p("/financeiro"), {
      tipo: "receber",
      descricao: "Salário",
      valorCentavos: 500000,
      vencimento: "2026-11-30",
    });
    expect(receber.status).toBe(201);
    // Sem o cadastro de clientes, a conta a receber não aceita cliente.
    const comCliente = await call("POST", p("/financeiro"), {
      tipo: "receber",
      descricao: "Serviço",
      valorCentavos: 1000,
      vencimento: "2026-11-30",
      cliente: "qualquer",
    });
    expect(comCliente.status).toBe(422);

    expect((await call("GET", p("/painel"))).status).toBe(200);
    expect((await call("GET", p("/clientes"))).status).toBe(404);
    expect((await call("GET", p("/produtos"))).status).toBe(404);
  });
});

describe("clientes e cobranças", () => {
  it("cobra um cliente cadastrado, sem estoque nem agenda", async () => {
    const id = await ativar(rascunho("clientes_cobrancas", ["clientes", "financeiro"]));
    const p = (x: string) => `/systems/${id}${x}`;
    const cliente = (
      await call<{ cliente: { id: string } }>("POST", p("/clientes"), { nome: "Aluno Ana" })
    ).body.cliente.id;
    const cobranca = await call("POST", p("/financeiro"), {
      tipo: "receber",
      descricao: "Mensalidade de novembro",
      valorCentavos: 25000,
      vencimento: "2026-11-10",
      cliente,
    });
    expect(cobranca.status).toBe(201);
    expect((await call("GET", p("/agenda"))).status).toBe(404);
  });
});
