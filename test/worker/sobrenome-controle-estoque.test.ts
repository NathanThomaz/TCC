import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { OperacaoApiBody, PainelDto } from "../../src/shared/api";
import type { ConfigDraft, Rule } from "../../src/shared/contract/schema";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { limparBanco } from "../limpar-banco";

// Pedidos do dono de 2026-11-17: sobrenome do cliente em campo próprio (migration 0018), com o nome
// completo em vendas e no financeiro, e o modelo controle de estoque (só produtos e estoque).

const NOW = Date.UTC(2026, 10, 17, 15, 0, 0);
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

type Body = OperacaoApiBody & { painel?: PainelDto };
async function call(method: string, path: string, body?: unknown) {
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
  return {
    status: response.status,
    body: await response.json<Body & { error?: { code: string; message: string } }>(),
  };
}

const REQ = { requisitos: ["REQ-01"] };

async function ativar(d: Omit<ConfigDraft, "aparencia" | "requisitos" | "fora_do_catalogo">) {
  const s = (
    (await call("POST", "/systems", { nome: `Loja ${crypto.randomUUID().slice(0, 6)}` }))
      .body as unknown as { sistema: { id: string } }
  ).sistema.id;
  const rascunho: ConfigDraft = {
    ...d,
    aparencia: { nome: "Loja", titulo: "Loja", cor_primaria: "#1f4e79", cor_destaque: "#f2a900" },
    requisitos: [{ id: "REQ-01", texto: "Sistema do teste", status: "confirmado" }],
    fora_do_catalogo: [],
  };
  const v = (await call("POST", `/systems/${s}/versions`, { origem: "formulario", rascunho }))
    .body as unknown as { versao: { id: string; hash: string; status: string }; issues: unknown };
  expect(v.versao?.status, JSON.stringify(v.issues)).toBe("valid");
  await call("POST", `/systems/${s}/versions/${v.versao.id}/approve`, { hash: v.versao.hash });
  expect((await call("POST", `/systems/${s}/activate`, { versao: v.versao.id })).status).toBe(200);
  return (x: string) => `/systems/${s}${x}`;
}

const COMERCIO_A_PRAZO = {
  modelo: "comercio" as const,
  modulos: ["clientes", "produtos", "vendas", "estoque", "pagamentos", "financeiro"] as const,
  campos: [],
  tipos_atendimento: [],
  regras: [
    { tipo: "prazo_reserva", minutos: 60, ...REQ },
    { tipo: "formas_pagamento", formas: ["dinheiro", "a_prazo"], prazo_dias: 30, ...REQ },
  ] satisfies Rule[],
};

beforeEach(async () => {
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at)
     VALUES ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T})`,
  ).run();
});

describe("sobrenome do cliente", () => {
  it("grava nome e sobrenome separados e mostra o nome completo na venda e no financeiro", async () => {
    const p = await ativar({ ...COMERCIO_A_PRAZO, modulos: [...COMERCIO_A_PRAZO.modulos] });
    const criado = await call("POST", p("/clientes"), { nome: "Maria", sobrenome: " Silva " });
    expect(criado.status).toBe(201);
    expect(criado.body.cliente).toMatchObject({
      nome: "Maria",
      sobrenome: "Silva",
      nomeCompleto: "Maria Silva",
    });
    const id = criado.body.cliente!.id;

    const prod = (
      await call("POST", p("/produtos"), { nome: "Arroz", varejoCentavos: 1000, estoqueInicial: 5 })
    ).body.produto!;
    const venda = (
      await call("POST", p("/vendas"), {
        cliente: id,
        itens: [{ produto: prod.id, caixas: 0, unidades: 1 }],
      })
    ).body.venda!;
    expect(venda.nomeCliente).toBe("Maria Silva");
    const ok = await call("POST", p(`/vendas/${venda.id}/concluir`), {
      revisao: venda.revisao,
      formaPagamento: "a_prazo",
    });
    expect(ok.status).toBe(200);
    const contas = (await call("GET", p("/financeiro"))).body.lancamentos!;
    expect(contas.map((c) => c.contraparte)).toEqual(["Maria Silva"]);

    // Sobrenome apagado volta a null, e o nome completo fica só o nome.
    const editado = await call("PATCH", p(`/clientes/${id}`), {
      nome: "Maria",
      sobrenome: "",
      campos: {},
    });
    expect(editado.body.cliente).toMatchObject({ sobrenome: null, nomeCompleto: "Maria" });
  });

  it("cliente sem sobrenome continua como antes", async () => {
    const p = await ativar({ ...COMERCIO_A_PRAZO, modulos: [...COMERCIO_A_PRAZO.modulos] });
    const r = await call("POST", p("/clientes"), { nome: "Zé" });
    expect(r.body.cliente).toMatchObject({ nome: "Zé", sobrenome: null, nomeCompleto: "Zé" });
  });

  it("só clientes têm sobrenome", async () => {
    const p = await ativar({
      modelo: "servicos",
      modulos: ["clientes", "profissionais", "agenda"],
      campos: [],
      tipos_atendimento: [{ id: "corte", rotulo: "Corte", duracao_minutos: 30 }],
      regras: [],
    });
    const r = await call("POST", p("/profissionais"), { nome: "Ana", sobrenome: "Souza" });
    expect(r.status).toBe(422);
  });
});

describe("modelo controle de estoque", () => {
  it("ativa só com produtos e estoque, dá entrada e saída com motivo e mostra o painel", async () => {
    const p = await ativar({
      modelo: "controle_estoque",
      modulos: ["produtos", "estoque"],
      campos: [],
      tipos_atendimento: [],
      regras: [{ tipo: "saida_manual", motivos: ["Uso interno", "Perda"], ...REQ }],
    });
    const prod = (
      await call("POST", p("/produtos"), { nome: "Luva", varejoCentavos: 500, estoqueInicial: 10 })
    ).body.produto!;
    const saida = await call("POST", p("/estoque/saidas"), {
      produto: prod.id,
      caixas: 0,
      unidades: 4,
      motivo: "Uso interno",
    });
    expect(saida.status).toBe(201);
    expect(saida.body.movimento).toMatchObject({ delta: -4, saldoDepois: 6 });

    const painel = await call("GET", p("/painel"));
    expect(painel.status).toBe(200);
    expect(painel.body.painel!.estoque).toBeDefined();
    expect(painel.body.painel!.vendas).toBeUndefined();
    // Sem o módulo de clientes, a rota não existe para este sistema.
    expect((await call("GET", p("/clientes"))).status).toBeGreaterThanOrEqual(400);
  });
});
