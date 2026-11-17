import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { OperacaoApiBody, PainelDto } from "../../src/shared/api";
import type { ConfigDraft, Rule } from "../../src/shared/contract/schema";
import { validateDraft } from "../../src/shared/contract/validate";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { limparBanco } from "../limpar-banco";

// Regras de estoque, clientes e vendas (ADR-015, etapa 2b): validade dos produtos, saída com
// motivo, limite de crédito na venda a prazo e aviso de cliente sem comprar.

const NOW = Date.UTC(2026, 10, 17, 15, 0, 0); // 17/11/2026, meio-dia em Brasília
const DIA = 86_400_000;
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
const BASE: Rule[] = [
  { tipo: "prazo_reserva", minutos: 60, ...REQ },
  { tipo: "formas_pagamento", formas: ["dinheiro", "a_prazo"], prazo_dias: 30, ...REQ },
];

function rascunho(regras: Rule[]): ConfigDraft {
  return {
    modelo: "comercio",
    modulos: ["clientes", "produtos", "vendas", "estoque", "pagamentos", "financeiro"],
    aparencia: { nome: "Loja", titulo: "Loja", cor_primaria: "#1f4e79", cor_destaque: "#f2a900" },
    requisitos: [{ id: "REQ-01", texto: "Mercadinho com fiado", status: "confirmado" }],
    campos: [],
    tipos_atendimento: [],
    regras: [...BASE, ...regras],
    fora_do_catalogo: [],
  };
}

async function ativar(regras: Rule[]) {
  const s = (
    (await call("POST", "/systems", { nome: `Loja ${crypto.randomUUID().slice(0, 6)}` }))
      .body as unknown as { sistema: { id: string } }
  ).sistema.id;
  const v = (
    await call("POST", `/systems/${s}/versions`, {
      origem: "formulario",
      rascunho: rascunho(regras),
    })
  ).body as unknown as { versao: { id: string; hash: string; status: string }; issues: unknown };
  expect(v.versao?.status, JSON.stringify(v.issues)).toBe("valid");
  await call("POST", `/systems/${s}/versions/${v.versao.id}/approve`, { hash: v.versao.hash });
  expect((await call("POST", `/systems/${s}/activate`, { versao: v.versao.id })).status).toBe(200);
  return (x: string) => `/systems/${s}${x}`;
}

async function produto(p: (x: string) => string, dados: Record<string, unknown> = {}) {
  const r = await call("POST", p("/produtos"), {
    nome: "Iogurte",
    varejoCentavos: 500,
    estoqueInicial: 20,
    ...dados,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.produto!;
}

async function vendaAPrazo(
  p: (x: string) => string,
  cliente: string,
  prod: string,
  unidades: number,
) {
  const v = await call("POST", p("/vendas"), {
    cliente,
    itens: [{ produto: prod, caixas: 0, unidades }],
  });
  expect(v.status).toBe(201);
  const venda = v.body.venda!;
  return call("POST", p(`/vendas/${venda.id}/concluir`), {
    revisao: venda.revisao,
    formaPagamento: "a_prazo",
  });
}

beforeEach(async () => {
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at)
     VALUES ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T})`,
  ).run();
});

describe("validador", () => {
  it("limite de crédito precisa de venda a prazo nas formas de pagamento", () => {
    const d = rascunho([{ tipo: "limite_credito", valor_centavos: 10_000, ...REQ }]);
    expect(validateDraft(d).issues).toEqual([]);
    d.regras = d.regras.map((r) =>
      r.tipo === "formas_pagamento" ? { ...r, formas: ["dinheiro"], prazo_dias: undefined } : r,
    );
    expect(validateDraft(d).issues.map((i) => i.code)).toContain("dependencia_ausente");
  });

  it("recusa motivo de saída repetido", () => {
    const d = rascunho([{ tipo: "saida_manual", motivos: ["Perda", "perda"], ...REQ }]);
    expect(validateDraft(d).issues.map((i) => i.code)).toContain("motivo_repetido");
  });
});

describe("validade dos produtos", () => {
  it("guarda a validade e o painel avisa dos vencidos e dos que vencem no prazo", async () => {
    const p = await ativar([{ tipo: "validade_produto", dias_aviso: 7, ...REQ }]);
    await produto(p, { nome: "Leite", validade: "2026-11-15" }); // vencido
    await produto(p, { nome: "Iogurte", validade: "2026-11-20" }); // vence em 3 dias
    await produto(p, { nome: "Arroz", validade: "2027-05-01" }); // longe
    const v = (await call("GET", p("/painel"))).body.painel!.estoque!.validade!;
    expect(v).toMatchObject({ dias: 7, vencidos: 1, vencendo: 1 });
    expect(v.lista.map((x) => x.nome)).toEqual(["Leite", "Iogurte"]);
  });

  it("sem a regra, o produto não aceita validade", async () => {
    const p = await ativar([]);
    const r = await call("POST", p("/produtos"), {
      nome: "Leite",
      varejoCentavos: 500,
      validade: "2026-12-01",
    });
    expect(r.status).toBe(422);
  });
});

describe("saída de estoque com motivo", () => {
  it("baixa o físico com um motivo da regra e guarda no histórico", async () => {
    const p = await ativar([
      { tipo: "saida_manual", motivos: ["Perda", "Consumo próprio"], ...REQ },
    ]);
    const prod = await produto(p);
    const fora = await call("POST", p("/estoque/saidas"), {
      produto: prod.id,
      caixas: 0,
      unidades: 2,
      motivo: "Roubo",
    });
    expect(fora.status).toBe(422);
    const ok = await call("POST", p("/estoque/saidas"), {
      produto: prod.id,
      caixas: 0,
      unidades: 3,
      motivo: "perda",
      observacao: "caixa amassada",
    });
    expect(ok.status).toBe(201);
    expect(ok.body.movimento).toMatchObject({ delta: -3, saldoDepois: 17 });
    // Mais do que há em estoque: recusa sem mexer.
    const demais = await call("POST", p("/estoque/saidas"), {
      produto: prod.id,
      caixas: 0,
      unidades: 50,
      motivo: "Perda",
    });
    expect(demais.status).toBe(409);
  });

  it("sem a regra, a saída avulsa não existe", async () => {
    const p = await ativar([]);
    const prod = await produto(p);
    const r = await call("POST", p("/estoque/saidas"), {
      produto: prod.id,
      caixas: 0,
      unidades: 1,
      motivo: "Perda",
    });
    expect(r.status).toBe(422);
  });
});

describe("limite de crédito na venda a prazo", () => {
  it("conclui até o limite e recusa a venda que passaria dele", async () => {
    const p = await ativar([{ tipo: "limite_credito", valor_centavos: 5_000, ...REQ }]);
    const prod = await produto(p);
    const cliente = (await call("POST", p("/clientes"), { nome: "Zé" })).body.cliente!.id;
    // R$ 40,00 a prazo: cabe no limite de R$ 50,00.
    expect((await vendaAPrazo(p, cliente, prod.id, 8)).status).toBe(200);
    // Mais R$ 15,00: passaria para R$ 55,00.
    const passa = await vendaAPrazo(p, cliente, prod.id, 3);
    expect(passa.status).toBe(409);
    expect(passa.body.error!.code).toBe("limite_credito");
    expect(passa.body.error!.message).toMatch(/já deve R\$ 40,00/);
  });
});

describe("cliente sem comprar", () => {
  it("o painel conta quem já comprou e está há mais de X dias sem comprar", async () => {
    const p = await ativar([{ tipo: "cliente_sem_comprar", dias: 30, ...REQ }]);
    const prod = await produto(p);
    const antigo = (await call("POST", p("/clientes"), { nome: "Antigo" })).body.cliente!.id;
    const recente = (await call("POST", p("/clientes"), { nome: "Recente" })).body.cliente!.id;
    await call("POST", p("/clientes"), { nome: "Nunca comprou" });
    expect((await vendaAPrazo(p, antigo, prod.id, 1)).status).toBe(200);
    expect((await vendaAPrazo(p, recente, prod.id, 1)).status).toBe(200);
    // A compra do "Antigo" foi há 45 dias.
    await env.DB.prepare(
      "UPDATE sales SET completed_at = ?, created_at = ?, updated_at = ? WHERE customer_id = ?",
    )
      .bind(NOW - 45 * DIA, NOW - 45 * DIA, NOW - 45 * DIA, antigo)
      .run();
    const c = (await call("GET", p("/painel"))).body.painel!.clientes!;
    expect(c.semComprar).toEqual({ dias: 30, quantidade: 1 });
  });
});
