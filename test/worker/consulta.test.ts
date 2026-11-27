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

  describe("o que está acabando e o que comprar (pedido do dono, 2026-11-27)", () => {
    /** Arroz abaixo do mínimo, sem saída; água vendendo bem, em caixas de 12; açúcar sobrando. */
    async function estoqueVariado() {
      const cliente = (await call("POST", p("/clientes"), ADMIN, { nome: "Mercado" })).body.cliente!
        .id;
      const produto = async (corpo: Record<string, unknown>) =>
        (await call("POST", p("/produtos"), ADMIN, corpo)).body.produto!.id;
      await produto({
        nome: "Arroz 5 kg",
        varejoCentavos: 2500,
        atacadoCentavos: 2300,
        custoCentavos: 1800,
        estoqueMinimo: 5,
        estoqueInicial: 2,
      });
      await produto({
        nome: "Açúcar",
        varejoCentavos: 500,
        atacadoCentavos: 450,
        custoCentavos: 300,
        estoqueInicial: 50,
      });
      const agua = await produto({
        nome: "Água",
        varejoCentavos: 300,
        atacadoCentavos: 250,
        unidadesPorCaixa: 12,
        custoCentavos: 100,
        estoqueInicial: 30,
      });
      const v = (
        await call("POST", p("/vendas"), ADMIN, {
          cliente,
          itens: [{ produto: agua, unidades: 25 }],
        })
      ).body.venda!;
      expect(
        (await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao })).status,
      ).toBe(200);
    }

    it("o que está acabando: abaixo do mínimo primeiro, depois o menor disponível", async () => {
      await estoqueVariado();
      roteiro.push(consulta({ intencao: "estoque" }));
      const r = (await perguntar("O que está acabando no estoque?")).body.mensagens!.at(-1)!;
      expect(r.texto.split("\n")).toEqual([
        "1 produto abaixo do estoque mínimo:",
        "Arroz 5 kg: físico 2, reservado 0, disponível 2, mínimo 5 (abaixo do mínimo)",
        "Água: físico 5, reservado 0, disponível 5",
        "Açúcar: físico 50, reservado 0, disponível 50",
        "Cerveja lata: físico 90, reservado 0, disponível 90",
      ]);
      expect(r.filtros[0]).toContain("do que está acabando");
    });

    it("sugestão de compra: prioridade, quantidade em caixas e valor total", async () => {
      await estoqueVariado();
      roteiro.push(consulta({ intencao: "reposicao" }));
      const r = (await perguntar("O que devo comprar com prioridade?")).body.mensagens!.at(-1)!;
      const linhas = r.texto.split("\n");
      // Arroz: até o mínimo (5 − 2 = 3) × R$ 18,00. Água: saiu 25 em 30 dias (0,8 por dia), 14
      // dias pedem 12, tem 5, faltam 7, arredonda para 1 caixa de 12 × R$ 1,00. Açúcar e cerveja
      // têm estoque para mais de 14 dias e ficam fora.
      expect(linhas[0]).toBe(
        "Sugestão de compra: 2 itens, 1 abaixo do mínimo. Valor total estimado: R$ 66,00.",
      );
      expect(linhas[2]).toBe(
        "1. Arroz 5 kg: comprar 3 ≈ R$ 54,00. Hoje: disponível 2, mínimo 5, sem saída nos últimos 30 dias (abaixo do mínimo).",
      );
      expect(linhas[3]).toBe(
        "2. Água: comprar 12 (1 caixa) ≈ R$ 12,00. Hoje: disponível 5, sai 0,8 por dia, dá para 6 dias.",
      );
      expect(linhas).toHaveLength(4);
      expect(r.origem).toContain("nada é comprado pelo chat");
      // Somente leitura: nenhuma compra nem movimento novo.
      const compras = await env.DB.prepare("SELECT COUNT(*) AS n FROM purchases").first<{
        n: number;
      }>();
      expect(compras?.n).toBe(0);
    });

    it("sem nada para repor, diz isso sem inventar números", async () => {
      roteiro.push(consulta({ intencao: "reposicao", produto: "cerveja" }));
      const r = (await perguntar("Preciso comprar cerveja?")).body.mensagens!.at(-1)!;
      expect(r.texto).toContain("Nada precisa ser reposto agora: o produto está");
    });

    it("produto inexistente e item sem custo: não inventa valor", async () => {
      roteiro.push(consulta({ intencao: "reposicao", produto: "xyz" }));
      expect((await perguntar("Preciso comprar xyz?")).body.mensagens!.at(-1)!.texto).toBe(
        "Nenhum produto ativo com “xyz” no nome.",
      );
      await call("POST", p("/produtos"), ADMIN, {
        nome: "Gelo",
        varejoCentavos: 800,
        atacadoCentavos: 700,
        estoqueMinimo: 10,
        estoqueInicial: 2,
      });
      roteiro.push(consulta({ intencao: "reposicao", produto: "gelo" }));
      const r = (await perguntar("Preciso comprar gelo?")).body.mensagens!.at(-1)!;
      expect(r.texto).toContain(
        "Valor total: não dá para estimar, porque nenhum desses itens tem custo registrado",
      );
      expect(r.texto).toContain("1. Gelo: comprar 8 (sem custo registrado).");
    });

    it("correção de inventário para cima não apaga as vendas (revisão do Codex)", async () => {
      const cliente = (await call("POST", p("/clientes"), ADMIN, { nome: "Bar" })).body.cliente!.id;
      const carvao = (
        await call("POST", p("/produtos"), ADMIN, {
          nome: "Carvão",
          varejoCentavos: 2000,
          atacadoCentavos: 1800,
          custoCentavos: 1000,
          estoqueInicial: 5,
        })
      ).body.produto!.id;
      expect(
        (
          await call("POST", p("/estoque/correcoes"), ADMIN, {
            produto: carvao,
            fisicoEsperado: 5,
            novoFisico: 35,
            motivo: "Contagem achou mais sacos",
          })
        ).status,
      ).toBe(201);
      const v = (
        await call("POST", p("/vendas"), ADMIN, {
          cliente,
          itens: [{ produto: carvao, unidades: 30 }],
        })
      ).body.venda!;
      await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
      // Saíram 30 em 30 dias (1 por dia): 14 dias pedem 14, tem 5, comprar 9. Somando a correção
      // de +30 com as vendas, a saída daria zero e nada seria sugerido.
      roteiro.push(consulta({ intencao: "reposicao", produto: "carv" }));
      const r = (await perguntar("Preciso comprar carvão?")).body.mensagens!.at(-1)!;
      expect(r.texto).toContain("1. Carvão: comprar 9 ≈ R$ 90,00.");
    });

    it("a IA recebe a pergunta anterior só como contexto da atual", async () => {
      roteiro.push(consulta({ intencao: "reposicao" }), consulta({ intencao: "reposicao" }));
      await perguntar("Qual você me recomenda comprar com prioridade?");
      await perguntar("Qual o valor total dessa compra?");
      expect(pedidos[0]!.mensagens).toEqual([
        { papel: "usuario", texto: "Qual você me recomenda comprar com prioridade?" },
      ]);
      expect(pedidos[1]!.mensagens).toEqual([
        {
          papel: "usuario",
          texto:
            "Pergunta anterior (só contexto): Qual você me recomenda comprar com prioridade?\nPergunta atual: Qual o valor total dessa compra?",
        },
      ]);
      expect(pedidos[1]!.instrucoes).toContain("Classifique só a ATUAL");
    });
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
      "reposicao",
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

  it("sugestão de compra: compra cancelada não vira consumo (revisão do Codex)", async () => {
    await comModulos();
    const feijao = (
      await call("POST", p("/produtos"), ADMIN, {
        nome: "Feijão",
        varejoCentavos: 900,
        atacadoCentavos: 800,
      })
    ).body.produto!.id;
    const f = (await call("POST", p("/fornecedores"), ADMIN, { nome: "Leste" })).body.fornecedor!
      .id;
    const compra = (
      await call("POST", p("/compras"), ADMIN, {
        fornecedor: f,
        itens: [{ produto: feijao, unidades: 40, custoUnitarioCentavos: 500 }],
        vencimento: "2026-11-01",
      })
    ).body.compra!;
    expect(
      (await call("POST", p(`/compras/${compra.id}/cancelar`), ADMIN, { motivo: "Pedido errado" }))
        .status,
    ).toBe(200);
    // Sem o filtro do purchase_id, as 40 unidades da correção virariam saída e a sugestão pediria
    // 19 sacos de feijão que ninguém vendeu.
    const r = await ultima({ intencao: "reposicao", produto: "feij" });
    expect(r.texto).toBe(
      "Pela saída dos últimos 30 dias, não há quantidade a sugerir.\nSem estoque e sem saída nos últimos 30 dias (defina a quantidade): Feijão.",
    );
  });

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
    expect(fin.texto).toContain(
      "Vencidas: 2 (R$ 40,00); pergunte “quem está devendo?” para ver a lista.",
    );
    const prod = await ultima({ intencao: "produtos", produto: "água" });
    expect(prod.texto).toContain("custo R$ 1,00 (margem de 67% no varejo)");
    // Isolamento: no sistema original (sem os módulos), nada disso aparece.
    S = original;
    expect((await ultima({ intencao: "compras" })).texto).toContain("não tem o módulo");
  });

  it("financeiro com foco: vencidas com atraso, a receber e a pagar no período (pedido do dono, 2026-11-27)", async () => {
    await comModulos();
    // As duas compras venceram em 01/11 (hoje é 05/11); a venda a prazo vence em 30 dias.
    const vencidas = await ultima({ intencao: "financeiro", foco: "vencidas" });
    const linhas = vencidas.texto.split("\n");
    expect(linhas[0]).toBe("2 contas vencidas, total de R$ 40,00:");
    expect(linhas.slice(1)).toHaveLength(2);
    for (const l of linhas.slice(1)) {
      expect(l).toMatch(/^01\/11\/2026 · a pagar · .+ · R\$ 20,00 \(vencida há 4 dias\)$/);
    }
    const receber = await ultima({ intencao: "financeiro", foco: "receber" });
    expect(receber.texto).toMatch(
      /^1 conta a receber, total de R\$ 12,00:\n05\/12\/2026 · a receber · .*Ana.* · R\$ 12,00$/,
    );
    const pagarDez = await ultima({
      intencao: "financeiro",
      foco: "pagar",
      periodo: { de: "2026-12-01", ate: "2026-12-31" },
    });
    expect(pagarDez.texto).toBe("Não há contas pendentes a pagar nesse período.");
    expect(pagarDez.filtros).toEqual([
      "Pendentes a pagar, com vencimento de 01/12/2026 a 31/12/2026",
    ]);
    // Sem foco, os próximos vencimentos são de hoje em diante (as vencidas têm o próprio recorte).
    const geral = await ultima({ intencao: "financeiro" });
    expect(geral.texto).toMatch(/Próximos vencimentos:\n05\/12\/2026 · a receber/);
    expect(geral.texto).not.toContain("vencida há");
    // "Quem está me devendo?" = só a receber vencidas; "o que estou devendo?" = a pagar vencidas.
    const devendo = await ultima({
      intencao: "financeiro",
      foco: "receber",
      apenas_vencidas: true,
    });
    expect(devendo.texto).toBe("Não há contas a receber vencidas.");
    const devo = await ultima({ intencao: "financeiro", foco: "pagar", apenas_vencidas: true });
    expect(devo.texto.split("\n")[0]).toBe("2 contas a pagar vencidas, total de R$ 40,00:");
    expect(devo.texto).toMatch(/(Sul|Norte)/);
    expect(devo.filtros).toEqual(["A pagar vencidas: antes de 05/11/2026"]);
    // As vencidas também respeitam o período citado (pelo vencimento).
    const semana = await ultima({
      intencao: "financeiro",
      foco: "vencidas",
      periodo: { de: "2026-11-02", ate: "2026-11-04" },
    });
    expect(semana.texto).toBe("Não há contas vencidas nesse período.");
    const invertido = await ultima({
      intencao: "financeiro",
      foco: "vencidas",
      periodo: { de: "2026-11-04", ate: "2026-11-02" },
    });
    expect(invertido.texto).toBe("Não entendi o período. Pode repetir as datas?");
  });

  it("validade: vencidos e vencendo dentro do aviso; sem a regra, diz que não controla", async () => {
    expect((await ultima({ intencao: "validade" })).texto).toBe(
      "Este sistema não controla a validade dos produtos (a regra de validade não está ligada).",
    );
    const id = (await call("POST", "/systems", ADMIN, { nome: "Com validade" })).body.sistema!.id;
    const v = (
      await call("POST", `/systems/${id}/versions`, ADMIN, {
        origem: "formulario",
        rascunho: {
          ...DISTRIBUIDORA,
          regras: [
            ...DISTRIBUIDORA.regras,
            { tipo: "validade_produto", dias_aviso: 7, requisitos: ["REQ-01"] },
          ],
        },
      })
    ).body.versao!;
    await call("POST", `/systems/${id}/versions/${v.id}/approve`, ADMIN, { hash: v.hash });
    await call("POST", `/systems/${id}/activate`, ADMIN, { versao: v.id });
    S = id;
    for (const [nome, validade, estoqueInicial] of [
      ["Iogurte", "2026-11-03", 4],
      ["Leite", "2026-11-08", 10],
      ["Queijo", "2026-11-20", 3],
      ["Manteiga", "2026-11-06", undefined],
    ] as const) {
      expect(
        (
          await call("POST", p("/produtos"), ADMIN, {
            nome,
            varejoCentavos: 500,
            atacadoCentavos: 450,
            validade,
            ...(estoqueInicial ? { estoqueInicial } : {}),
          })
        ).status,
      ).toBe(201);
    }
    // Queijo vence depois do aviso; manteiga não tem estoque.
    expect((await ultima({ intencao: "validade" })).texto.split("\n")).toEqual([
      "Iogurte: venceu há 2 dias (03/11/2026), 4 unidades em estoque",
      "Leite: vence em 3 dias (08/11/2026), 10 unidades em estoque",
    ]);
    // Muitos vencidos não escondem o que vence logo (listas separadas, cada uma com limite).
    for (let k = 0; k < 11; k++) {
      await call("POST", p("/produtos"), ADMIN, {
        nome: `Vencido ${String(k).padStart(2, "0")}`,
        varejoCentavos: 500,
        atacadoCentavos: 450,
        validade: "2026-10-01",
        estoqueInicial: 1,
      });
    }
    const muitos = (await ultima({ intencao: "validade" })).texto;
    expect(muitos).toContain("Leite: vence em 3 dias");
    expect(muitos).toContain("(Mostrando 10 de 12 vencidos.)");
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
