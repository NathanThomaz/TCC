import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ConsultaApiBody, OperacaoApiBody, SystemsApiBody } from "../../src/shared/api";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import type { PedidoIa, ProvedorIa } from "../../src/worker/ia/gemini";
import { DISTRIBUIDORA } from "../fixtures/distribuidora";
import { limparBanco } from "../limpar-banco";

// Chat de consulta somente leitura (seção 15): T28 (sistema e período certos, total do backend,
// sem escrita) e T29 (histórico privado por usuário e sistema).

const NOW = Date.UTC(2026, 10, 5, 15, 0, 0); // 12:00 em São Paulo
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
    return Promise.resolve({ texto: roteiro.shift() ?? "{}", tokensEntrada: 500, tokensSaida: 60 });
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

type Body = ConsultaApiBody & SystemsApiBody & OperacaoApiBody;

async function call(method: string, path: string, token: string, body?: unknown) {
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

const consulta = (dados: Record<string, unknown>) =>
  JSON.stringify({ periodo: null, produto: null, profissional: null, ...dados });

async function ativar(nome: string) {
  const id = (await call("POST", "/systems", ADMIN, { nome })).body.sistema!.id;
  const v = (
    await call("POST", `/systems/${id}/versions`, ADMIN, {
      origem: "formulario",
      rascunho: DISTRIBUIDORA,
    })
  ).body.versao!;
  await call("POST", `/systems/${id}/versions/${v.id}/approve`, ADMIN, { hash: v.hash });
  await call("POST", `/systems/${id}/activate`, ADMIN, { versao: v.id });
  return id;
}

let S = "";
const p = (path: string) => `/systems/${S}${path}`;

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
  S = await ativar("Distribuidora");
  await env.DB.prepare(
    "INSERT INTO system_access (user_id, system_id, granted_by, created_at, updated_at) VALUES ('s', ?, 'a', ?, ?)",
  )
    .bind(S, NOW, NOW)
    .run();
  // Dados: cerveja com 100 unidades; uma venda concluída (R$ 50,00) e uma cancelada (R$ 25,00).
  const cliente = (await call("POST", p("/clientes"), ADMIN, { nome: "Bar do Zé" })).body.cliente!
    .id;
  const cerveja = (
    await call("POST", p("/produtos"), ADMIN, {
      nome: "Cerveja lata",
      varejoCentavos: 500,
      atacadoCentavos: 400,
      unidadesPorCaixa: 12,
    })
  ).body.produto!.id;
  await call("POST", p("/estoque/entradas"), ADMIN, {
    produto: cerveja,
    unidades: 100,
    motivo: "Compra",
  });
  for (const [unidades, cancelar] of [
    [10, false],
    [5, true],
  ] as const) {
    const v = (
      await call("POST", p("/vendas"), ADMIN, { cliente, itens: [{ produto: cerveja, unidades }] })
    ).body.venda!;
    await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    if (cancelar) await call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, { motivo: "Desistiu" });
  }
});

async function perguntar(texto: string, token = ADMIN) {
  return call("POST", p("/consulta/mensagens"), token, { texto });
}

describe("chat de consulta", () => {
  it("T28: total vendido do período vem do backend, sem as canceladas, com filtros e origem", async () => {
    roteiro.push(
      consulta({ intencao: "vendas", periodo: { de: "2026-11-05", ate: "2026-11-05" } }),
    );
    const r = await perguntar("Quanto vendi hoje?");
    const resposta = r.body.mensagens!.at(-1)!;
    expect(resposta.texto).toContain("1 venda concluída");
    expect(resposta.texto).toContain("R$ 50,00");
    expect(resposta.texto).toContain("Cancelamentos no período: 1");
    expect(resposta.filtros).toEqual(["Período: 05/11/2026 a 05/11/2026 (horário de Brasília)"]);
    expect(resposta.origem).toContain("sem as canceladas");
    // A IA recebeu só a pergunta e a data de hoje no fuso do Nexus; nenhum dado do banco.
    expect(pedidos[0]!.mensagens).toEqual([{ papel: "usuario", texto: "Quanto vendi hoje?" }]);
    expect(pedidos[0]!.instrucoes).toContain("Hoje é 2026-11-05");
  });

  it("vendas sem período: pergunta antes, sem número calculado", async () => {
    roteiro.push(consulta({ intencao: "vendas" }));
    const r = await perguntar("Quanto vendi?");
    expect(r.body.mensagens!.at(-1)!.texto).toContain("De qual período?");
  });

  it("período sem vendas: diz que não há, sem inventar", async () => {
    roteiro.push(
      consulta({ intencao: "vendas", periodo: { de: "2026-10-01", ate: "2026-10-31" } }),
    );
    const r = await perguntar("E em outubro?");
    expect(r.body.mensagens!.at(-1)!.texto).toBe(
      "Não há vendas concluídas de 01/10/2026 a 31/10/2026.",
    );
  });

  it("estoque do produto citado: físico, reservado e disponível", async () => {
    roteiro.push(consulta({ intencao: "estoque", produto: "cerveja" }));
    const r = await perguntar("Quanta cerveja tenho?");
    expect(r.body.mensagens!.at(-1)!.texto).toBe(
      "Cerveja lata: físico 90, reservado 0, disponível 90",
    );
  });

  it("pedido de alteração é recusado e nada muda (somente leitura)", async () => {
    const antes = await env.DB.prepare("SELECT COUNT(*) AS n FROM sales").first<{ n: number }>();
    roteiro.push(consulta({ intencao: "fora_do_escopo" }));
    const r = await perguntar("Cancele a venda do Bar do Zé");
    expect(r.body.mensagens!.at(-1)!.texto).toContain("use as telas");
    const depois = await env.DB.prepare("SELECT COUNT(*) AS n FROM sales").first<{ n: number }>();
    expect(depois).toEqual(antes);
  });

  it("T29: cada usuário tem o próprio histórico; revogado, o histórico fica bloqueado", async () => {
    roteiro.push(consulta({ intencao: "regras" }), consulta({ intencao: "regras" }));
    await perguntar("Quais as regras?", ADMIN);
    await perguntar("E as regras pra mim?", SEC);
    const doAdmin = (await call("GET", p("/consulta"), ADMIN)).body.mensagens!;
    const doSec = (await call("GET", p("/consulta"), SEC)).body.mensagens!;
    expect(doAdmin.map((m) => m.texto)).toContain("Quais as regras?");
    expect(doAdmin.map((m) => m.texto)).not.toContain("E as regras pra mim?");
    expect(doSec.map((m) => m.texto)).not.toContain("Quais as regras?");
    await env.DB.prepare("UPDATE system_access SET status = 'revoked' WHERE user_id = 's'").run();
    expect((await call("GET", p("/consulta"), SEC)).status).toBe(404);
  });

  it("resposta fora do formato não grava nada", async () => {
    roteiro.push("não é json");
    const r = await perguntar("Oi");
    expect(r.status).toBe(502);
    expect((await call("GET", p("/consulta"), ADMIN)).body.mensagens).toHaveLength(0);
  });
});

describe("chat de consulta: todos os módulos (pedido do dono, 2026-11-13)", () => {
  const ultima = async (dados: Record<string, unknown>, texto = "pergunta") => {
    roteiro.push(consulta(dados));
    return (await perguntar(texto)).body.mensagens!.at(-1)!;
  };

  it("resumo geral traz os números do painel, sem a IA calcular nada", async () => {
    const r = await ultima({ intencao: "resumo_geral" }, "Como está meu negócio?");
    expect(r.texto).toContain("Vendas hoje: R$ 50,00 em 1 venda.");
    expect(r.texto).toContain("Clientes ativos: 1");
    expect(r.origem).toBe("mesmos números do painel do sistema");
  });

  it("mais vendidos e clientes que mais compram, no mês quando não há período", async () => {
    const mais = await ultima({ intencao: "mais_vendidos" });
    expect(mais.texto).toBe("1. Cerveja lata: 10 unidades, R$ 50,00");
    expect(mais.filtros[0]).toContain("este mês, 01/11/2026 a 30/11/2026");
    const top = await ultima({ intencao: "clientes" });
    expect(top.texto).toContain("Clientes ativos: 1; inativos: 0.");
    expect(top.texto).toContain("1. Bar do Zé: R$ 50,00 em 1 compra");
    const um = await ultima({ intencao: "clientes", cliente: "zé" });
    expect(um.texto).toContain("Bar do Zé (ativo): 1 compra no período, total R$ 50,00");
    expect(um.filtros[1]).toContain("este mês");
  });

  it("produtos com preços; regras completas; como usar", async () => {
    const prod = await ultima({ intencao: "produtos", produto: "cerveja" });
    expect(prod.texto).toBe("Cerveja lata: varejo R$ 5,00, atacado R$ 4,00, caixa com 12");
    const regras = await ultima({ intencao: "regras" });
    expect(regras.texto).toContain("Um pedido aberto segura o estoque por 30 minutos");
    const como = await ultima({ intencao: "como_usar", modulo: "vendas" }, "Como faço uma venda?");
    expect(como.texto).toContain("“Nova venda”");
    expect(como.filtros).toEqual(["Módulo: Vendas"]);
  });

  it("módulo que o sistema não tem: diz que não há, sem inventar", async () => {
    const r = await ultima({ intencao: "financeiro" }, "Tenho contas vencidas?");
    expect(r.texto).toBe(
      "Este sistema não tem o módulo de financeiro, então não há o que consultar sobre isso.",
    );
  });

  it("a IA recebe as intenções novas e os argumentos de cliente, fornecedor e módulo", async () => {
    await ultima({ intencao: "resumo_geral" });
    const instrucoes = pedidos.at(-1)!.instrucoes;
    for (const termo of [
      "resumo_geral",
      "financeiro",
      "compras",
      "como_usar",
      "cliente:",
      "fornecedor:",
    ]) {
      expect(instrucoes).toContain(termo);
    }
  });
});

describe("chat de consulta: módulos opcionais e bordas (revisão do Codex)", () => {
  const ultima = async (dados: Record<string, unknown>) => {
    roteiro.push(consulta(dados));
    return (await perguntar("pergunta")).body.mensagens!.at(-1)!;
  };

  /** Liga pagamentos, fornecedores e financeiro num sistema novo e põe dados nele. */
  async function comModulos() {
    const id = (await call("POST", "/systems", ADMIN, { nome: "Completo" })).body.sistema!.id;
    const v = (
      await call("POST", `/systems/${id}/versions`, ADMIN, {
        origem: "formulario",
        rascunho: {
          ...DISTRIBUIDORA,
          modulos: [...DISTRIBUIDORA.modulos, "pagamentos", "fornecedores", "financeiro"],
          regras: [
            ...DISTRIBUIDORA.regras,
            {
              tipo: "formas_pagamento",
              formas: ["pix", "a_prazo"],
              prazo_dias: 30,
              requisitos: ["REQ-01"],
            },
          ],
        },
      })
    ).body.versao!;
    await call("POST", `/systems/${id}/versions/${v.id}/approve`, ADMIN, { hash: v.hash });
    await call("POST", `/systems/${id}/activate`, ADMIN, { versao: v.id });
    S = id;
    const cliente = (await call("POST", p("/clientes"), ADMIN, { nome: "Ana" })).body.cliente!.id;
    const prod = (
      await call("POST", p("/produtos"), ADMIN, {
        nome: "Água",
        varejoCentavos: 300,
        atacadoCentavos: 250,
        unidadesPorCaixa: 12,
      })
    ).body.produto!.id;
    for (const nome of ["Sul", "Norte"]) {
      const f = (await call("POST", p("/fornecedores"), ADMIN, { nome })).body.fornecedor!.id;
      await call("POST", p("/compras"), ADMIN, {
        fornecedor: f,
        itens: [{ produto: prod, unidades: 20, custoUnitarioCentavos: 100 }],
        vencimento: "2026-11-01",
      });
    }
    const venda = (
      await call("POST", p("/vendas"), ADMIN, { cliente, itens: [{ produto: prod, unidades: 4 }] })
    ).body.venda!;
    await call("POST", p(`/vendas/${venda.id}/concluir`), ADMIN, {
      revisao: venda.revisao,
      formaPagamento: "a_prazo",
    });
  }

  it("compras somam todos os fornecedores; pagamentos e financeiro com os números reais", async () => {
    const original = S;
    await comModulos();
    const compras = await ultima({ intencao: "compras" });
    expect(compras.texto).toContain("Total comprado: R$ 40,00.");
    expect(compras.texto).toContain("Sul: 1 compra, R$ 20,00");
    const so = await ultima({ intencao: "compras", fornecedor: "nor" });
    expect(so.texto).toContain("Total comprado: R$ 20,00.");
    const pag = await ultima({ intencao: "pagamentos" });
    expect(pag.texto).toBe("A prazo: 1 venda, R$ 12,00");
    const fin = await ultima({ intencao: "financeiro" });
    expect(fin.texto).toContain("A receber (pendente): R$ 12,00. A pagar (pendente): R$ 40,00.");
    expect(fin.texto).toContain("Vencidas: 2 (R$ 40,00).");
    const prod = await ultima({ intencao: "produtos", produto: "água" });
    expect(prod.texto).toContain("custo R$ 1,00 (margem de 67% no varejo)");
    // Isolamento: no sistema original (sem os módulos), nada disso aparece.
    S = original;
    expect((await ultima({ intencao: "compras" })).texto).toContain("não tem o módulo");
  });

  it("mais de 15 fornecedores: o total soma todos; cliente com compra fora do período", async () => {
    await comModulos();
    const prod = (await call("GET", p("/produtos"), ADMIN)).body.produtos![0]!.id;
    for (let i = 0; i < 16; i++) {
      const f = (await call("POST", p("/fornecedores"), ADMIN, { nome: `F${i}` })).body.fornecedor!
        .id;
      await call("POST", p("/compras"), ADMIN, {
        fornecedor: f,
        itens: [{ produto: prod, unidades: 1, custoUnitarioCentavos: 1000 }],
        vencimento: "2026-11-30",
      });
    }
    const compras = await ultima({ intencao: "compras" });
    // 2 compras de R$ 20,00 do comModulos + 16 de R$ 10,00.
    expect(compras.texto).toContain("Total comprado: R$ 200,00.");
    expect(compras.texto).toContain("(Mostrando os 15 maiores fornecedores.)");
    const outubro = await ultima({
      intencao: "clientes",
      cliente: "ana",
      periodo: { de: "2026-10-01", ate: "2026-10-31" },
    });
    expect(outubro.texto).toContain("Ana (ativo): 0 compras no período, total R$ 0,00");
    expect(outubro.texto).toContain("última compra (em qualquer data)");
  });

  it("busca sem acento acha nome gravado com acento separado (forma decomposta)", async () => {
    await call("POST", p("/produtos"), ADMIN, {
      nome: "Água tônica",
      varejoCentavos: 500,
      atacadoCentavos: 400,
      unidadesPorCaixa: 12,
    });
    const r = await ultima({ intencao: "produtos", produto: "agua" });
    expect(r.texto).toContain("tônica");
  });

  it("profissionais, ticket médio e data inexistente", async () => {
    const prof = await ultima({ intencao: "profissionais" });
    expect(prof.texto).toBe("Nenhum profissional encontrado.");
    const vendas = await ultima({
      intencao: "vendas",
      periodo: { de: "2026-11-05", ate: "2026-11-05" },
    });
    expect(vendas.texto).toContain("ticket médio de R$ 50,00");
    for (const intencao of ["vendas", "mais_vendidos", "clientes"]) {
      const r = await ultima({ intencao, periodo: { de: "2026-02-31", ate: "2026-02-31" } });
      expect(r.texto).toBe("Não entendi o período. Pode repetir as datas?");
    }
  });
});
