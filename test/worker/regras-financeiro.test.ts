import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { LancamentoDto, OperacaoApiBody, PainelDto } from "../../src/shared/api";
import type { ConfigDraft, Rule } from "../../src/shared/contract/schema";
import { validateDraft } from "../../src/shared/contract/validate";
import { diasDeAtraso, valorComEncargos } from "../../src/shared/dominio/financeiro";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { limparBanco } from "../limpar-banco";

// Regras do financeiro (ADR-015, etapa 2a): categorias, aviso de vencimento, orçamento mensal e
// multa e juros por atraso, aplicadas pela operação.

// 17/11/2026, meio-dia em Brasília.
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
    body: await response.json<Body & { error?: { code: string } }>(),
  };
}

const REQ = { requisitos: ["REQ-01"] };
const CATEGORIAS: Rule = {
  tipo: "categorias_financeiras",
  despesas: ["Moradia", "Alimentação"],
  receitas: ["Salário", "Serviços"],
  ...REQ,
};

function rascunho(regras: Rule[]): ConfigDraft {
  return {
    modelo: "controle_financeiro",
    modulos: ["financeiro"],
    aparencia: {
      nome: "Contas",
      titulo: "Contas",
      cor_primaria: "#1f4e79",
      cor_destaque: "#f2a900",
    },
    requisitos: [{ id: "REQ-01", texto: "Controlar as contas da casa", status: "confirmado" }],
    campos: [],
    tipos_atendimento: [],
    regras,
    fora_do_catalogo: [],
  };
}

async function ativar(regras: Rule[]) {
  const id = (await call("POST", "/systems", { nome: `Contas ${crypto.randomUUID().slice(0, 6)}` }))
    .body as unknown as { sistema: { id: string } };
  const s = id.sistema.id;
  const v = (
    await call("POST", `/systems/${s}/versions`, {
      origem: "formulario",
      rascunho: rascunho(regras),
    })
  ).body as unknown as { versao: { id: string; hash: string; status: string } };
  expect(v.versao.status).toBe("valid");
  await call("POST", `/systems/${s}/versions/${v.versao.id}/approve`, { hash: v.versao.hash });
  expect((await call("POST", `/systems/${s}/activate`, { versao: v.versao.id })).status).toBe(200);
  return (x: string) => `/systems/${s}${x}`;
}

const conta = (p: (x: string) => string, dados: Record<string, unknown>) =>
  call("POST", p("/financeiro"), { valorCentavos: 10_000, vencimento: "2026-11-20", ...dados });

beforeEach(async () => {
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at)
     VALUES ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T})`,
  ).run();
});

describe("multa e juros (mesma conta na tela e no servidor)", () => {
  it("multa única e juros ao mês proporcionais aos dias de atraso", () => {
    expect(diasDeAtraso("2026-11-01", "2026-11-16")).toBe(15);
    expect(diasDeAtraso("2026-11-20", "2026-11-16")).toBe(0);
    // R$ 100,00, 15 dias: multa 2% = R$ 2,00; juros 1% ao mês × 15/30 = R$ 0,50.
    expect(
      valorComEncargos(10_000, "2026-11-01", "2026-11-16", {
        multa_percentual: 2,
        juros_mes_percentual: 1,
      }),
    ).toEqual({ totalCentavos: 10_250, multaCentavos: 200, jurosCentavos: 50, dias: 15 });
    // Sem atraso ou sem regra: o próprio valor.
    expect(valorComEncargos(10_000, "2026-11-20", "2026-11-16", null).totalCentavos).toBe(10_000);
  });
});

describe("validador das regras do financeiro", () => {
  const codes = (regras: Rule[]) => validateDraft(rascunho(regras)).issues.map((i) => i.code);

  it("orçamento exige as categorias e cada limite numa despesa", () => {
    const orcamento: Rule = {
      tipo: "orcamento_mensal",
      limites: [{ categoria: "Lazer", valor_centavos: 50_000 }],
      ...REQ,
    };
    expect(codes([orcamento])).toContain("dependencia_ausente");
    expect(codes([CATEGORIAS, orcamento])).toContain("referencia_inexistente");
    expect(
      codes([CATEGORIAS, { ...orcamento, limites: [{ categoria: "moradia", valor_centavos: 1 }] }]),
    ).toEqual([]);
  });

  it("recusa categoria repetida e multa e juros zerados", () => {
    expect(codes([{ ...CATEGORIAS, despesas: ["Moradia", "moradia"] }])).toContain(
      "categoria_repetida",
    );
    expect(
      codes([{ tipo: "multa_juros_atraso", multa_percentual: 0, juros_mes_percentual: 0, ...REQ }]),
    ).toContain("parametro_invalido");
  });
});

describe("financeiro com as regras ligadas", () => {
  it("categorias: conta pede a categoria do seu tipo e o mês soma por categoria", async () => {
    const p = await ativar([CATEGORIAS]);
    expect((await conta(p, { tipo: "pagar", descricao: "Aluguel" })).status).toBe(422);
    expect(
      (await conta(p, { tipo: "pagar", descricao: "Aluguel", categoria: "Salário" })).status,
    ).toBe(422);
    const ok = await conta(p, { tipo: "pagar", descricao: "Aluguel", categoria: "moradia" });
    expect(ok.status).toBe(201);
    expect(ok.body.lancamento!.categoria).toBe("Moradia");
    await conta(p, {
      tipo: "receber",
      descricao: "Salário de novembro",
      categoria: "Salário",
      valorCentavos: 500_000,
    });
    const lista = await call("GET", p("/financeiro"));
    expect(lista.body.porCategoria).toEqual(
      expect.arrayContaining([
        { tipo: "pagar", categoria: "Moradia", totalCentavos: 10_000 },
        { tipo: "receber", categoria: "Salário", totalCentavos: 500_000 },
      ]),
    );
    const filtrada = await call("GET", p("/financeiro?categoria=Moradia"));
    expect(filtrada.body.lancamentos!.map((l: LancamentoDto) => l.descricao)).toEqual(["Aluguel"]);
  });

  it("sem a regra, a conta não aceita categoria", async () => {
    const p = await ativar([]);
    const r = await conta(p, { tipo: "pagar", descricao: "Aluguel", categoria: "Moradia" });
    expect(r.status).toBe(422);
  });

  it("aviso de vencimento e orçamento aparecem no painel", async () => {
    const p = await ativar([
      CATEGORIAS,
      { tipo: "aviso_vencimento", dias: 3, ...REQ },
      {
        tipo: "orcamento_mensal",
        limites: [{ categoria: "Alimentação", valor_centavos: 50_000 }],
        ...REQ,
      },
    ]);
    // Vence em 2 dias (entra no aviso) e em 10 dias (fora).
    await conta(p, {
      tipo: "pagar",
      descricao: "Mercado",
      categoria: "Alimentação",
      valorCentavos: 40_000,
      vencimento: "2026-11-19",
    });
    await conta(p, {
      tipo: "pagar",
      descricao: "Feira",
      categoria: "Alimentação",
      valorCentavos: 20_000,
      vencimento: "2026-11-27",
    });
    const painel = (await call("GET", p("/painel"))).body.painel!;
    expect(painel.financeiro!.vencendoEmBreve).toEqual({
      dias: 3,
      quantidade: 1,
      totalCentavos: 40_000,
    });
    expect(painel.financeiro!.orcamento).toEqual([
      { categoria: "Alimentação", limiteCentavos: 50_000, gastoCentavos: 60_000 },
    ]);
  });

  it("multa e juros: conta a receber vencida mostra o valor de hoje e é baixada com ele", async () => {
    const p = await ativar([
      { tipo: "multa_juros_atraso", multa_percentual: 2, juros_mes_percentual: 1, ...REQ },
    ]);
    const r = await conta(p, {
      tipo: "receber",
      descricao: "Mensalidade",
      vencimento: "2026-11-02",
    });
    // 15 dias de atraso: R$ 100,00 + 2,00 + 0,50.
    expect(r.body.lancamento!.encargosHoje).toEqual({
      totalCentavos: 10_250,
      multaCentavos: 200,
      jurosCentavos: 50,
      dias: 15,
    });
    const baixa = await call("POST", p(`/financeiro/${r.body.lancamento!.id}/baixar`), {});
    expect(baixa.body.lancamento!.valorPagoCentavos).toBe(10_250);
    expect((await call("GET", p("/painel"))).body.painel!.financeiro!.recebidoNoMesCentavos).toBe(
      10_250,
    );
    // Conta a pagar vencida não leva multa (a regra é para o que o negócio recebe).
    const pagar = await conta(p, { tipo: "pagar", descricao: "Luz", vencimento: "2026-11-02" });
    expect(pagar.body.lancamento!.encargosHoje).toBeNull();
  });
});
