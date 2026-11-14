import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ImportacaoDto,
  ProdutoDto,
  SystemsApiBody,
  VendaInterpretadaDto,
} from "../../src/shared/api";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import type { PedidoIa, ProvedorIa } from "../../src/worker/ia/gemini";
import { montarProposta } from "../../src/worker/modules/operacao/automacao";
import { DISTRIBUIDORA } from "../fixtures/distribuidora";
import { limparBanco } from "../limpar-banco";

// Menos digitação nas vendas (pedido do dono, 2026-11-14): venda ditada, última compra,
// código de barras e importação de planilha.

const NOW = Date.UTC(2026, 10, 14, 12, 0, 0);
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

let roteiro: string[] = [];
let pedidos: PedidoIa[] = [];
const provedor: ProvedorIa = {
  modelo: "simulado",
  gerar(pedido) {
    pedidos.push(pedido);
    const texto = roteiro.shift();
    return texto === undefined
      ? Promise.reject(new Error("roteiro vazio"))
      : Promise.resolve({ texto, tokensEntrada: 800, tokensSaida: 100 });
  },
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
  ia: () => provedor,
});

type Body = SystemsApiBody & {
  venda?: VendaInterpretadaDto;
  importacao?: ImportacaoDto;
  produto?: ProdutoDto;
  produtos?: ProdutoDto[];
  ultima?: {
    concluidaEm: number;
    itens: { produto: string; caixas: number; unidades: number }[];
  } | null;
  error?: { code: string; message: string };
  [k: string]: unknown;
};

async function call(method: string, path: string, body?: unknown, token = ADMIN) {
  const response = await app(
    new Request(`https://app.test/api/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(method === "POST" ? { "idempotency-key": crypto.randomUUID() } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
  );
  return { status: response.status, body: await response.json<Body>() };
}

let S = "";
const p = (path: string) => `/systems/${S}${path}`;

async function produto(nome: string, extra: Record<string, unknown> = {}) {
  const r = await call("POST", p("/produtos"), {
    nome,
    varejoCentavos: 500,
    atacadoCentavos: 400,
    unidadesPorCaixa: null,
    ...extra,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.produto!;
}
async function cliente(nome: string) {
  return (await call("POST", p("/clientes"), { nome })).body.cliente as { id: string };
}

beforeEach(async () => {
  roteiro = [];
  pedidos = [];
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at) VALUES
     ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T}),
     ('s', 'uid-s', 's@example.com', 'secondary', 'active', 'a', ${T}, ${T})`,
  ).run();
  const criado = await call("POST", "/systems", { nome: "Distribuidora" });
  S = criado.body.sistema!.id;
  const v = (await call("POST", p("/versions"), { origem: "formulario", rascunho: DISTRIBUIDORA }))
    .body.versao!;
  await call("POST", p(`/versions/${v.id}/approve`), { hash: v.hash });
  await call("POST", p("/activate"), { versao: v.id });
  await env.DB.prepare(
    "INSERT INTO system_access (user_id, system_id, granted_by, created_at, updated_at) VALUES ('s', ?, 'a', ?, ?)",
  )
    .bind(S, NOW, NOW)
    .run();
});

describe("venda ditada", () => {
  it("liga o texto aos cadastros e devolve a venda para conferir (nada é criado)", async () => {
    const cerveja = await produto("Cerveja lata", { unidadesPorCaixa: 12 });
    await produto("Água");
    const bar = await cliente("Bar do Zé");
    roteiro.push(
      JSON.stringify({
        cliente: 1,
        itens: [
          { produto: 1, texto: "2 caixas de cerva", caixas: 2, unidades: 0 },
          { produto: 1, texto: "mais 3 latas", caixas: 0, unidades: 3 },
          { produto: null, texto: "gelo", caixas: 0, unidades: 5 },
        ],
        forma_pagamento: null,
        cliente_nao_encontrado: null,
      }),
    );
    const r = await call(
      "POST",
      p("/vendas/interpretar"),
      {
        texto: "2 caixas de cerva e mais 3 latas pro Bar do Zé, e 5 gelo",
      },
      SEC,
    );
    expect(r.status).toBe(200);
    expect(r.body.venda).toEqual({
      cliente: { id: bar.id, nome: "Bar do Zé" },
      itens: [{ produto: cerveja.id, nome: "Cerveja lata", caixas: 2, unidades: 3 }],
      formaPagamento: null,
      naoEncontrados: ["gelo"],
    });
    // A lista numerada foi para a IA; a venda não foi criada.
    expect(pedidos[0]!.instrucoes).toContain("P1: Cerveja lata (caixa com 12)");
    expect(pedidos[0]!.instrucoes).toContain("C1: Bar do Zé");
    expect((await call("GET", p("/vendas"))).body.vendas).toEqual([]);
    // Uso de IA registrado na conta do administrador (paga a secundária).
    const uso = await env.DB.prepare(
      "SELECT user_id, purpose, idempotency_key FROM ai_usage",
    ).first();
    expect(uso).toMatchObject({ user_id: "s", purpose: "consulta", idempotency_key: null });
  });

  it("resposta fora do formato vira 502 sem efeito", async () => {
    roteiro.push("isto não é json");
    const r = await call("POST", p("/vendas/interpretar"), { texto: "3 cervejas" });
    expect(r.status).toBe(502);
  });
});

describe("montarProposta", () => {
  const produtos = [
    { id: "p1", name: "Água", units_per_box: null },
    { id: "p2", name: "Cerveja", units_per_box: 12 },
  ];
  const clientes = [{ id: "c1", name: "Bar" }];

  it("ignora números fora da lista, caixa em produto sem caixa e forma não aceita", () => {
    const r = montarProposta(
      {
        cliente: 9,
        itens: [
          { produto: 7, texto: "vinho", caixas: 0, unidades: 1 },
          { produto: 1, texto: "1 cx de água", caixas: 1, unidades: 0 },
          { produto: 2, texto: "cerveja", caixas: 0, unidades: 0 },
        ],
        forma_pagamento: "pix",
        cliente_nao_encontrado: "Maria",
      },
      produtos,
      clientes,
      ["dinheiro"],
    );
    expect(r).toEqual({
      cliente: null,
      itens: [{ produto: "p2", nome: "Cerveja", caixas: 0, unidades: 1 }],
      formaPagamento: null,
      naoEncontrados: [
        "cliente citado",
        'cliente "Maria"',
        "vinho",
        "1 cx de água (este produto não tem caixa)",
      ],
    });
  });
});

describe("última compra do cliente", () => {
  it("devolve os itens da última venda concluída, só com produtos ativos", async () => {
    const cerveja = await produto("Cerveja", { estoqueInicial: 50 });
    const agua = await produto("Água", { estoqueInicial: 50 });
    const bar = await cliente("Bar");
    expect((await call("GET", p(`/clientes/${bar.id}/ultima-compra`))).body.ultima).toBeNull();
    const v = (
      await call("POST", p("/vendas"), {
        cliente: bar.id,
        itens: [
          { produto: cerveja.id, caixas: 0, unidades: 6 },
          { produto: agua.id, caixas: 0, unidades: 2 },
        ],
      })
    ).body.venda as unknown as { id: string; revisao: number };
    await call("POST", p(`/vendas/${v.id}/concluir`), { revisao: v.revisao });
    await call("POST", p(`/produtos/${agua.id}/status`), { status: "inactive" });
    const r = await call("GET", p(`/clientes/${bar.id}/ultima-compra`));
    expect(r.body.ultima!.itens).toEqual([
      { produto: cerveja.id, nome: "Cerveja", caixas: 0, unidades: 6 },
    ]);
    expect((await call("GET", p("/clientes/nada/ultima-compra"))).status).toBe(404);
  });
});

describe("código de barras", () => {
  it("grava, mantém na edição sem o campo e recusa repetido no sistema", async () => {
    const a = await produto("Cerveja", { codigoBarras: "7891234567890" });
    expect(a.codigoBarras).toBe("7891234567890");
    const base = {
      nome: "Cerveja",
      varejoCentavos: 600,
      atacadoCentavos: 450,
      unidadesPorCaixa: null,
    };
    const editado = await call("PATCH", p(`/produtos/${a.id}`), base);
    expect(editado.body.produto!.codigoBarras).toBe("7891234567890");
    const repetido = await call("POST", p("/produtos"), {
      ...base,
      nome: "Outra",
      codigoBarras: "7891234567890",
    });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error!.code).toBe("codigo_em_uso");
    const b = await produto("Água");
    const editarRepetido = await call("PATCH", p(`/produtos/${b.id}`), {
      ...base,
      nome: "Água",
      codigoBarras: "7891234567890",
    });
    expect(editarRepetido.body.error!.code).toBe("codigo_em_uso");
    const invalido = await call("POST", p("/produtos"), {
      ...base,
      nome: "X",
      codigoBarras: "12 34",
    });
    expect(invalido.status).toBe(422);
  });
});

describe("importar planilha", () => {
  it("cria produtos com estoque inicial e ignora nomes que já existem", async () => {
    await produto("Água");
    const r = await call("POST", p("/produtos/importar"), {
      linhas: [
        {
          nome: "Cerveja",
          varejoCentavos: 500,
          atacadoCentavos: 400,
          unidadesPorCaixa: 12,
          estoque: 24,
          estoqueMinimo: 6,
          codigoBarras: "789",
        },
        { nome: "água", varejoCentavos: 300, atacadoCentavos: 250 },
        { nome: "Vinho", varejoCentavos: 4500, atacadoCentavos: 4000 },
        { nome: "Vinho", varejoCentavos: 4600, atacadoCentavos: 4100 },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.body.importacao).toEqual({ criados: 2, ignorados: ["água", "Vinho"] });
    const lista = (await call("GET", p("/produtos"))).body.produtos!;
    expect(lista.find((x) => x.nome === "Cerveja")).toMatchObject({
      fisico: 24,
      estoqueMinimo: 6,
      codigoBarras: "789",
      unidadesPorCaixa: 12,
    });
    const movs = await env.DB.prepare("SELECT reason, delta FROM stock_movements").all();
    expect(movs.results).toEqual([{ reason: "Estoque inicial (planilha)", delta: 24 }]);
  });

  it("uma linha inválida recusa tudo, dizendo qual", async () => {
    const r = await call("POST", p("/produtos/importar"), {
      linhas: [
        { nome: "Cerveja", varejoCentavos: 500, atacadoCentavos: 400 },
        { nome: "Sem atacado", varejoCentavos: 500 },
      ],
    });
    expect(r.status).toBe(422);
    expect(r.body.error!.message).toMatch(/Linha 2 \(Sem atacado\)/);
    expect((await call("GET", p("/produtos"))).body.produtos).toEqual([]);
  });

  it("importa clientes e ignora repetidos", async () => {
    await cliente("Bar do Zé");
    const r = await call("POST", p("/clientes/importar"), {
      linhas: [{ nome: "bar do zé" }, { nome: "Mercado Bom" }, { nome: "Padaria Sol" }],
    });
    expect(r.body.importacao).toEqual({ criados: 2, ignorados: ["bar do zé"] });
  });
});
