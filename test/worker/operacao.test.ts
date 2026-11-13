import type { PainelDto } from "../../src/shared/api";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import c1 from "../../experiments/cenarios/c1-gabarito.json";
import type { OperacaoApiBody, SystemsApiBody } from "../../src/shared/api";
import { calcularTotais } from "../../src/shared/dominio/precos";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { remarcacoes } from "../../src/worker/modules/operacao/agenda";
import { DISTRIBUIDORA } from "../fixtures/distribuidora";
import { limparBanco } from "../limpar-banco";

// Operação da distribuidora pela API, sobre o D1 local com as migrations reais (T04, T13–T26, T31).

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
const MIN = 60_000;
const H = 60 * MIN;
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
  "token-sec-00000000000000": {
    uid: "uid-s",
    email: "s@example.com",
    emailVerified: true,
    authTime: NOW,
  },
};
const ADMIN = "token-admin-000000000000";
const ADMIN2 = "token-admin2-00000000000";
const SEC = "token-sec-00000000000000";

const app = createApp({
  clock: { now: () => agora },
  auth: () => ({
    verify: (token) => {
      const identity = IDENTITIES[token];
      return identity ? Promise.resolve(identity) : Promise.reject(new InvalidTokenError("x"));
    },
    lookup: () => Promise.resolve({ validSince: null, disabled: false }),
  }),
});

type Body = OperacaoApiBody & SystemsApiBody;

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

async function ativar(token: string, rascunho: unknown): Promise<string> {
  const criado = await call("POST", "/systems", token, { nome: "Sistema de teste" });
  const id = criado.body.sistema!.id;
  const versao = (
    await call("POST", `/systems/${id}/versions`, token, { origem: "formulario", rascunho })
  ).body.versao!;
  expect(versao.status).toBe("valid");
  await call("POST", `/systems/${id}/versions/${versao.id}/approve`, token, { hash: versao.hash });
  const ativo = await call("POST", `/systems/${id}/activate`, token, { versao: versao.id });
  expect(ativo.status).toBe(200);
  return id;
}

let S = "";
const p = (path: string) => `/systems/${S}${path}`;

async function cliente(nome = "Bar do Zé") {
  return (await call("POST", p("/clientes"), ADMIN, { nome })).body.cliente!.id;
}
async function produto(dados: Record<string, unknown> = {}) {
  const r = await call("POST", p("/produtos"), ADMIN, {
    nome: "Cerveja lata",
    varejoCentavos: 500,
    atacadoCentavos: 400,
    unidadesPorCaixa: 12,
    ...dados,
  });
  expect(r.status).toBe(201);
  return r.body.produto!.id;
}
async function entrada(produtoId: string, unidades: number, caixas = 0) {
  const r = await call("POST", p("/estoque/entradas"), ADMIN, {
    produto: produtoId,
    caixas,
    unidades,
    motivo: "Compra do fornecedor",
  });
  expect(r.status).toBe(201);
  return r.body.movimento!;
}
async function estoqueDe(produtoId: string) {
  const r = await call("GET", p("/estoque"), ADMIN);
  return r.body.produtos!.find((x) => x.id === produtoId)!;
}
async function venda(clienteId: string, itens: unknown[], token = ADMIN) {
  return call("POST", p("/vendas"), token, { cliente: clienteId, itens });
}

beforeEach(async () => {
  agora = NOW;
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at) VALUES
     ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T}),
     ('b', 'uid-b', 'b@example.com', 'admin', 'active', NULL, ${T}, ${T}),
     ('s', 'uid-s', 's@example.com', 'secondary', 'active', 'a', ${T}, ${T})`,
  ).run();
  S = await ativar(ADMIN, DISTRIBUIDORA);
  await env.DB.prepare(
    "INSERT INTO system_access (user_id, system_id, granted_by, created_at, updated_at) VALUES ('s', ?, 'a', ?, ?)",
  )
    .bind(S, NOW, NOW)
    .run();
});

describe("abertura e isolamento", () => {
  it("T09: a aplicação recém-ativada começa vazia (nada da prévia vira dado real)", async () => {
    for (const recurso of ["/clientes", "/produtos", "/profissionais", "/vendas", "/agenda"]) {
      const r = await call("GET", p(recurso), ADMIN);
      expect(r.status, recurso).toBe(200);
      const lista = Object.values(r.body).find(Array.isArray) as unknown[] | undefined;
      expect(lista ?? [], recurso).toEqual([]);
    }
    const linhas = await env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM customers) + (SELECT COUNT(*) FROM products)
            + (SELECT COUNT(*) FROM professionals) + (SELECT COUNT(*) FROM sales)
            + (SELECT COUNT(*) FROM appointments) AS n`,
    ).first<{ n: number }>();
    expect(linhas!.n).toBe(0);
  });

  it("abre a aplicação ativa com a configuração aprovada, também para o secundário", async () => {
    const r = await call("GET", p("/app"), SEC);
    expect(r.status).toBe(200);
    expect(r.body.config!.aparencia.nome).toBe("Distribuidora Exemplo");
    expect(r.body.papel).toBe("secondary");
    expect((await call("GET", p("/painel"), SEC)).status).toBe(200);
  });

  it("T04: outro administrador não enxerga o sistema nem usa os cadastros dele", async () => {
    const c = await cliente();
    expect((await call("GET", p("/clientes"), ADMIN2)).status).toBe(404);
    const outro = await ativar(ADMIN2, DISTRIBUIDORA);
    const prodOutro = (
      await call("POST", `/systems/${outro}/produtos`, ADMIN2, {
        nome: "X",
        varejoCentavos: 100,
        atacadoCentavos: 90,
      })
    ).body.produto!.id;
    // Cliente do sistema S com produto do outro sistema: recusado, sem revelar nada.
    const r = await venda(c, [{ produto: prodOutro, unidades: 1 }]);
    expect(r.status).toBe(422);
  });

  it("módulo fora da configuração responde 404 (comércio não tem agenda)", async () => {
    const loja = await ativar(ADMIN, c1);
    const r = await call("GET", `/systems/${loja}/agenda`, ADMIN);
    expect(r.status).toBe(404);
    expect(r.body.error!.code).toBe("modulo_indisponivel");
  });

  it("sistema em rascunho não opera", async () => {
    const rascunho = (await call("POST", "/systems", ADMIN, { nome: "Rascunho" })).body.sistema!.id;
    expect((await call("GET", `/systems/${rascunho}/clientes`, ADMIN)).status).toBe(409);
  });
});

describe("cadastros", () => {
  it("PRE-01: preço de atacado obrigatório quando o sistema tem atacado", async () => {
    const r = await call("POST", p("/produtos"), ADMIN, { nome: "Água", varejoCentavos: 300 });
    expect(r.status).toBe(422);
  });

  it("EST-01: produto novo começa com físico zero", async () => {
    const id = await produto();
    expect(await estoqueDe(id)).toMatchObject({ fisico: 0, reservado: 0, disponivel: 0 });
  });

  it("campos informativos: desconhecido e obrigatório ausente são recusados", async () => {
    const ok = await call("POST", p("/clientes"), ADMIN, {
      nome: "Ana",
      campos: { telefone: "5199" },
    });
    expect(ok.body.cliente!.campos).toEqual({ telefone: "5199" });
    const ruim = await call("POST", p("/clientes"), ADMIN, { nome: "Ana", campos: { cpf: "1" } });
    expect(ruim.status).toBe(422);
  });

  it("criação repetida com a mesma chave não duplica", async () => {
    const a = await call("POST", p("/clientes"), ADMIN, { nome: "Bia" }, "chave-cliente-1");
    const b = await call("POST", p("/clientes"), ADMIN, { nome: "Bia" }, "chave-cliente-1");
    expect(b.body.cliente!.id).toBe(a.body.cliente!.id);
    expect((await call("GET", p("/clientes"), ADMIN)).body.clientes).toHaveLength(1);
  });

  it("T27: inativo não entra em venda nova; reativar devolve", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 10);
    await call("POST", p(`/clientes/${c}/status`), ADMIN, { status: "inactive" });
    expect((await venda(c, [{ produto: prod, unidades: 1 }])).status).toBe(409);
    await call("POST", p(`/clientes/${c}/status`), ADMIN, { status: "active" });
    expect((await venda(c, [{ produto: prod, unidades: 1 }])).status).toBe(201);
  });
});

describe("preços (seção 10)", () => {
  it("T13: limiar inclusivo em 999,99 / 1.000,00 / 1.000,01", () => {
    const item = (varejo: number) => [{ unidades: 1, varejoCentavos: varejo, atacadoCentavos: 1 }];
    expect(calcularTotais(item(99_999), 100_000).faixa).toBe("varejo");
    expect(calcularTotais(item(100_000), 100_000).faixa).toBe("atacado");
    expect(calcularTotais(item(100_001), 100_000).faixa).toBe("atacado");
  });

  it("T13/T14: atacado a partir de R$ 1.000 a preço de varejo; caixa usa o preço por unidade", async () => {
    const c = await cliente();
    const prod = await produto(); // varejo 5,00, atacado 4,00, caixa 12
    await entrada(prod, 0, 40); // 480 unidades: cobre as duas reservas abaixo
    // 199 unidades a varejo = 995,00 → varejo.
    const abaixo = await venda(c, [{ produto: prod, unidades: 199 }]);
    expect(abaixo.body.venda).toMatchObject({ faixa: "varejo", totalCentavos: 99_500 });
    // 16 caixas + 8 = 200 unidades = 1.000,00 a varejo → atacado: 200 × 4,00.
    const limite = await venda(c, [{ produto: prod, caixas: 16, unidades: 8 }]);
    expect(limite.body.venda).toMatchObject({
      faixa: "atacado",
      subtotalVarejoCentavos: 100_000,
      totalCentavos: 80_000,
    });
  });

  it("PRE-06: preço do momento por item; limite da criação e itens antigos preservados", async () => {
    const c = await cliente();
    const cerveja = await produto();
    const agua = await produto({ nome: "Água", varejoCentavos: 200, atacadoCentavos: 150 });
    await entrada(cerveja, 100);
    await entrada(agua, 100);
    const v = (await venda(c, [{ produto: cerveja, unidades: 2 }])).body.venda!;
    // Os dois preços sobem depois de a cerveja entrar no rascunho.
    for (const [id, nome, varejo] of [
      [cerveja, "Cerveja lata", 900],
      [agua, "Água", 300],
    ] as const) {
      await app(
        new Request(`https://app.test/api/v1${p(`/produtos/${id}`)}`, {
          method: "PATCH",
          headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
          body: JSON.stringify({ nome, varejoCentavos: varejo, atacadoCentavos: varejo - 50 }),
        }),
        env,
      );
    }
    const salvo = await call("POST", p(`/vendas/${v.id}/itens`), ADMIN, {
      revisao: v.revisao,
      itens: [
        { produto: cerveja, unidades: 3 },
        { produto: agua, unidades: 1 },
      ],
    });
    const itens = salvo.body.venda!.itens;
    expect(itens.find((i) => i.produto === cerveja)!.varejoCentavos).toBe(500); // da entrada no rascunho
    expect(itens.find((i) => i.produto === agua)!.varejoCentavos).toBe(300); // do momento
    expect(salvo.body.venda!.totalCentavos).toBe(3 * 500 + 300);
  });
});

describe("estoque e reservas (seção 11)", () => {
  it("T15: duas caixas de 12 + três unidades movimentam 27", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 0, 5); // 60
    const v = (await venda(c, [{ produto: prod, caixas: 2, unidades: 3 }])).body.venda!;
    expect(v.itens[0]!.unidades).toBe(27);
    expect(await estoqueDe(prod)).toMatchObject({ fisico: 60, reservado: 27, disponivel: 33 });
    await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    expect(await estoqueDe(prod)).toMatchObject({ fisico: 33, reservado: 0 });
    const movs = (await call("GET", p(`/estoque/movimentos?produto=${prod}`), ADMIN)).body
      .movimentos!;
    expect(movs[0]).toMatchObject({ tipo: "venda", delta: -27, saldoDepois: 33, venda: v.id });
  });

  it("T16: entrada auditada; correção abaixo do reservado recusada; secundário não corrige", async () => {
    const c = await cliente();
    const prod = await produto();
    const mov = await entrada(prod, 30);
    expect(mov).toMatchObject({
      tipo: "entrada",
      delta: 30,
      motivo: "Compra do fornecedor",
      autor: "a",
    });
    await venda(c, [{ produto: prod, unidades: 20 }]);
    const abaixo = await call("POST", p("/estoque/correcoes"), ADMIN, {
      produto: prod,
      fisicoEsperado: 30,
      novoFisico: 19,
      motivo: "Contagem",
    });
    expect(abaixo.status).toBe(409);
    expect(abaixo.body.error!.code).toBe("abaixo_do_reservado");
    const sec = await call("POST", p("/estoque/correcoes"), SEC, {
      produto: prod,
      fisicoEsperado: 30,
      novoFisico: 25,
      motivo: "Contagem",
    });
    expect(sec.status).toBe(403);
    const ok = await call("POST", p("/estoque/correcoes"), ADMIN, {
      produto: prod,
      fisicoEsperado: 30,
      novoFisico: 25,
      motivo: "Contagem física",
    });
    expect(ok.body.movimento).toMatchObject({ tipo: "correcao", delta: -5, saldoDepois: 25 });
    // Saldo esperado desatualizado: recusado sem efeito e sem gravar a chave como sucesso.
    const velho = await call("POST", p("/estoque/correcoes"), ADMIN, {
      produto: prod,
      fisicoEsperado: 30,
      novoFisico: 28,
      motivo: "Contagem",
    });
    expect(velho.status).toBe(409);
    expect((await estoqueDe(prod)).fisico).toBe(25);
  });

  it("secundário autorizado opera: entrada e venda", async () => {
    const c = await cliente();
    const prod = await produto();
    const e = await call("POST", p("/estoque/entradas"), SEC, {
      produto: prod,
      unidades: 5,
      motivo: "Chegada",
    });
    expect(e.body.movimento!.autor).toBe("s");
    expect((await venda(c, [{ produto: prod, unidades: 2 }], SEC)).status).toBe(201);
  });

  it("T17: físico 30 com reserva de 20 deixa 10; reserva de 11 falha e informa a falta", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 30);
    await venda(c, [{ produto: prod, unidades: 20 }]);
    expect((await estoqueDe(prod)).disponivel).toBe(10);
    const r = await venda(c, [{ produto: prod, unidades: 11 }]);
    expect(r.status).toBe(409);
    expect(r.body.error!.code).toBe("estoque_insuficiente");
    expect(r.body.faltas).toEqual([
      { produto: prod, nomeProduto: "Cerveja lata", pedido: 11, disponivel: 10 },
    ]);
  });

  it("T18: falta em um item não deixa reserva nem venda parcial", async () => {
    const c = await cliente();
    const a = await produto();
    const b = await produto({ nome: "Chope", varejoCentavos: 1500, atacadoCentavos: 1200 });
    await entrada(a, 10);
    await entrada(b, 1);
    const r = await venda(c, [
      { produto: a, unidades: 5 },
      { produto: b, unidades: 2 },
    ]);
    expect(r.status).toBe(409);
    const conta = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM sales) AS vendas, (SELECT COUNT(*) FROM reservations) AS reservas",
    ).first<{ vendas: number; reservas: number }>();
    expect(conta).toEqual({ vendas: 0, reservas: 0 });
  });

  it("T19: editar renova o prazo, consultar não; vence sem nenhuma requisição (aba fechada)", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades: 4 }])).body.venda!;
    expect(v.expiraEm).toBe(NOW + 30 * MIN);
    agora = NOW + 20 * MIN;
    const lida = (await call("GET", p(`/vendas/${v.id}`), ADMIN)).body.venda!;
    expect(lida.expiraEm).toBe(NOW + 30 * MIN); // RES-04
    const editada = (
      await call("POST", p(`/vendas/${v.id}/itens`), ADMIN, {
        revisao: v.revisao,
        itens: [{ produto: prod, unidades: 5 }],
      })
    ).body.venda!;
    expect(editada.expiraEm).toBe(agora + 30 * MIN); // RES-03
    expect(await estoqueDe(prod)).toMatchObject({ reservado: 5, disponivel: 5 });
    agora += 30 * MIN; // ninguém consultou nem editou
    expect(await estoqueDe(prod)).toMatchObject({ reservado: 0, disponivel: 10 }); // RES-05
    const vencida = (await call("GET", p(`/vendas/${v.id}`), ADMIN)).body.venda!;
    expect(vencida).toMatchObject({ status: "draft", expirada: true });
  });

  it("T20: retomar vencido reserva de novo ou informa a falta; concluir vencido é recusado", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades: 8 }])).body.venda!;
    agora += 31 * MIN;
    const concluir = await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, {
      revisao: v.revisao,
    });
    expect(concluir.body.error!.code).toBe("reserva_expirada");
    await venda(c, [{ produto: prod, unidades: 5 }]); // outro pedido levou parte do estoque
    const falta = await call("POST", p(`/vendas/${v.id}/itens`), ADMIN, {
      revisao: v.revisao,
      itens: [{ produto: prod, unidades: 8 }],
    });
    expect(falta.status).toBe(409);
    expect(falta.body.faltas![0]).toMatchObject({ pedido: 8, disponivel: 5 });
    const retomada = await call("POST", p(`/vendas/${v.id}/itens`), ADMIN, {
      revisao: v.revisao,
      itens: [{ produto: prod, unidades: 5 }],
    });
    expect(retomada.body.venda).toMatchObject({ expirada: false, revisao: v.revisao + 1 });
  });

  it("revisão desatualizada é recusada (edição concorrente)", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades: 1 }])).body.venda!;
    await call("POST", p(`/vendas/${v.id}/itens`), ADMIN, {
      revisao: 1,
      itens: [{ produto: prod, unidades: 2 }],
    });
    const velha = await call("POST", p(`/vendas/${v.id}/itens`), ADMIN, {
      revisao: 1,
      itens: [{ produto: prod, unidades: 3 }],
    });
    expect(velha.status).toBe(409);
    expect((await estoqueDe(prod)).reservado).toBe(2);
  });

  it("RES-07: descartar libera na hora e não mexe no físico", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades: 6 }])).body.venda!;
    const d = await call("POST", p(`/vendas/${v.id}/descartar`), ADMIN, {});
    expect(d.body.venda!.status).toBe("discarded");
    expect(await estoqueDe(prod)).toMatchObject({ fisico: 10, reservado: 0 });
  });

  it("T27: produto com reserva ativa não é inativado", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 10);
    await venda(c, [{ produto: prod, unidades: 1 }]);
    const r = await call("POST", p(`/produtos/${prod}/status`), ADMIN, { status: "inactive" });
    expect(r.body.error!.code).toBe("produto_com_reserva");
  });
});

describe("conclusão e cancelamento (seções 11 e 12)", () => {
  async function vendaConcluida(unidades = 6) {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades }])).body.venda!;
    const r = await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    expect(r.body.venda!.status).toBe("completed");
    return { c, prod, v: r.body.venda! };
  }

  it("T21: concluir repetidamente baixa uma única vez", async () => {
    const { prod, v } = await vendaConcluida();
    const de_novo = await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: 1 });
    expect(de_novo.status).toBe(200);
    expect(await estoqueDe(prod)).toMatchObject({ fisico: 4, reservado: 0 });
    const itens = await call("POST", p(`/vendas/${v.id}/itens`), ADMIN, {
      revisao: v.revisao,
      itens: [{ produto: prod, unidades: 1 }],
    });
    expect(itens.status).toBe(409); // PRE-07
  });

  it("T22: cancelar repetidamente estorna uma vez e guarda motivo e autoria", async () => {
    const { prod, v } = await vendaConcluida();
    const r = await call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, {
      motivo: "Cliente desistiu",
    });
    expect(r.body.venda).toMatchObject({
      status: "cancelled",
      motivoCancelamento: "Cliente desistiu",
    });
    const de_novo = await call("POST", p(`/vendas/${v.id}/cancelar`), SEC, { motivo: "De novo" });
    expect(de_novo.body).toMatchObject({
      jaCancelada: true,
      venda: { motivoCancelamento: "Cliente desistiu" },
    });
    expect((await estoqueDe(prod)).fisico).toBe(10);
    const linha = await env.DB.prepare("SELECT cancelled_by FROM sales WHERE id = ?")
      .bind(v.id)
      .first<{ cancelled_by: string }>();
    expect(linha!.cancelled_by).toBe("a");
    const estornos = (
      await call("GET", p(`/estoque/movimentos?produto=${prod}`), ADMIN)
    ).body.movimentos!.filter((m) => m.tipo === "estorno");
    expect(estornos).toHaveLength(1);
  });

  it("rascunho não é cancelado (é descartado)", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 1);
    const v = (await venda(c, [{ produto: prod, unidades: 1 }])).body.venda!;
    expect(
      (await call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, { motivo: "Teste" })).status,
    ).toBe(409);
  });
});

describe("agenda (seção 13)", () => {
  const AMANHA = NOW + 24 * H;
  async function base() {
    const c = await cliente();
    const t = (await call("POST", p("/profissionais"), ADMIN, { nome: "Técnico João" })).body
      .profissional!.id;
    return { c, t };
  }
  function par(
    c: string,
    t: string,
    inicio: number,
    inicioSegundo: number,
    extra: Record<string, unknown> = {},
  ) {
    return call("POST", p("/agenda"), ADMIN, {
      cliente: c,
      profissional: t,
      tipo: "instalacao",
      inicio,
      inicioSegundo,
      campos: { endereco: "Rua A, 10" },
      ...extra,
    });
  }

  it("T24: par com o mesmo técnico, uma hora cada, segundo depois do primeiro; passado recusado", async () => {
    const { c, t } = await base();
    const r = await par(c, t, AMANHA, AMANHA + 5 * H);
    expect(r.status).toBe(201);
    const [inst, ret] = r.body.atendimentos!;
    expect(inst).toMatchObject({
      tipo: "instalacao",
      fim: AMANHA + H,
      posicaoNoPar: 1,
      profissional: t,
    });
    expect(ret).toMatchObject({
      tipo: "retirada",
      inicio: AMANHA + 5 * H,
      fim: AMANHA + 6 * H,
      posicaoNoPar: 2,
    });
    expect((await par(c, t, AMANHA + 10 * H, AMANHA + 10 * H + 30 * MIN)).body.error!.code).toBe(
      "segundo_antes_do_fim",
    );
    expect((await par(c, t, NOW - H, NOW + H)).body.error!.code).toBe("horario_no_passado");
    const sozinho = await call("POST", p("/agenda"), ADMIN, {
      cliente: c,
      profissional: t,
      tipo: "retirada",
      inicio: AMANHA,
      campos: { endereco: "Rua A" },
    });
    expect(sozinho.body.error!.code).toBe("segundo_sem_par");
  });

  it("T25: sobreposição recusada, consecutivo aceito; remarcação com conflito preserva o par", async () => {
    const { c, t } = await base();
    const primeiro = (await par(c, t, AMANHA, AMANHA + 2 * H)).body.atendimentos!;
    expect((await par(c, t, AMANHA + 30 * MIN, AMANHA + 4 * H)).body.error!.code).toBe(
      "conflito_agenda",
    );
    const consecutivo = await par(c, t, AMANHA + H, AMANHA + 3 * H);
    expect(consecutivo.status).toBe(201);
    // Remarcar o primeiro par para cima do segundo: recusado, horários anteriores mantidos.
    const conflito = await call("POST", p(`/agenda/${primeiro[0]!.id}/remarcar`), ADMIN, {
      inicio: AMANHA,
      inicioSegundo: AMANHA + H,
    });
    expect(conflito.body.error!.code).toBe("conflito_agenda");
    const agenda = (await call("GET", p("/agenda"), ADMIN)).body.atendimentos!;
    expect(agenda.find((a) => a.id === primeiro[1]!.id)!.inicio).toBe(AMANHA + 2 * H);
    // Outro técnico no mesmo horário: sem conflito.
    const t2 = (await call("POST", p("/profissionais"), ADMIN, { nome: "Técnica Ana" })).body
      .profissional!.id;
    expect((await par(c, t2, AMANHA, AMANHA + 2 * H)).status).toBe(201);
  });

  it("T26: início registrado preserva a retirada; nada muda sozinho pelo relógio", async () => {
    const { c, t } = await base();
    const [inst, ret] = (await par(c, t, AMANHA, AMANHA + 3 * H)).body.atendimentos!;
    agora = AMANHA + 10 * MIN; // passou do horário sem registro
    const atrasado = (await call("GET", p("/agenda"), ADMIN)).body.atendimentos!.find(
      (a) => a.id === inst!.id,
    )!;
    expect(atrasado).toMatchObject({ status: "scheduled", atrasado: true });
    expect((await call("POST", p(`/agenda/${ret!.id}/iniciar`), ADMIN, {})).body.error!.code).toBe(
      "primeiro_nao_concluido",
    );
    await call("POST", p(`/agenda/${inst!.id}/iniciar`), ADMIN, {});
    const cancelar = await call("POST", p(`/agenda/${ret!.id}/cancelar`), ADMIN, {
      motivo: "Evento cancelado",
    });
    expect(cancelar.body.error!.code).toBe("retirada_preservada");
    agora = AMANHA + 5 * H; // passou do fim: continua em atendimento até o registro (AGE-08)
    const emAndamento = (await call("GET", p("/agenda"), ADMIN)).body.atendimentos!.find(
      (a) => a.id === inst!.id,
    )!;
    expect(emAndamento.status).toBe("in_progress");
    const feito = await call("POST", p(`/agenda/${inst!.id}/concluir`), ADMIN, {});
    expect(feito.body.atendimentos![0]!.status).toBe("done");
  });

  it("AGE-09: cancelar antes do início cancela o par inteiro", async () => {
    const { c, t } = await base();
    const [inst] = (await par(c, t, AMANHA, AMANHA + 3 * H)).body.atendimentos!;
    const r = await call("POST", p(`/agenda/${inst!.id}/cancelar`), ADMIN, {
      motivo: "Desistência",
    });
    expect(r.body.atendimentos!.map((a) => a.status)).toEqual(["cancelled", "cancelled"]);
  });

  it("T23: venda com serviços não iniciados pede confirmação; iniciados bloqueiam o cancelamento", async () => {
    const { c, t } = await base();
    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades: 2 }])).body.venda!;
    await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    const [inst] = (await par(c, t, AMANHA, AMANHA + 3 * H, { venda: v.id })).body.atendimentos!;

    const semConfirmar = await call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, {
      motivo: "Desistiu",
    });
    expect(semConfirmar.body.error!.code).toBe("confirmar_servicos");
    expect(semConfirmar.body.servicos).toHaveLength(2);

    await call("POST", p(`/agenda/${inst!.id}/iniciar`), ADMIN, {});
    const iniciado = await call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, {
      motivo: "Desistiu",
      cancelarServicos: true,
    });
    expect(iniciado.body.error!.code).toBe("servico_iniciado");
    expect((await estoqueDe(prod)).fisico).toBe(8); // nada estornado
  });

  it("CAN-04: com confirmação, cancela venda e serviços juntos", async () => {
    const { c, t } = await base();
    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades: 2 }])).body.venda!;
    await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    await par(c, t, AMANHA, AMANHA + 3 * H, { venda: v.id });
    const r = await call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, {
      motivo: "Desistiu",
      cancelarServicos: true,
    });
    expect(r.body.venda!.status).toBe("cancelled");
    const servicos = (await call("GET", p(`/vendas/${v.id}`), ADMIN)).body.servicos!;
    expect(servicos.map((s) => s.status)).toEqual(["cancelled", "cancelled"]);
  });

  it("T27: profissional com atendimento pendente não é inativado", async () => {
    const { c, t } = await base();
    await par(c, t, AMANHA, AMANHA + 3 * H);
    const r = await call("POST", p(`/profissionais/${t}/status`), ADMIN, { status: "inactive" });
    expect(r.body.error!.code).toBe("profissional_com_atendimento");
  });
});

describe("T31: concorrência", () => {
  it("reservas simultâneas não passam do físico", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 30);
    const respostas = await Promise.all(
      Array.from({ length: 6 }, () => venda(c, [{ produto: prod, unidades: 7 }])),
    );
    expect(respostas.filter((r) => r.status === 201)).toHaveLength(4);
    expect(await estoqueDe(prod)).toMatchObject({ reservado: 28, disponivel: 2 });
  });

  it("conclusões e cancelamentos simultâneos baixam e estornam uma vez", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades: 4 }])).body.venda!;
    await Promise.all(
      Array.from({ length: 4 }, () =>
        call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao }),
      ),
    );
    expect((await estoqueDe(prod)).fisico).toBe(6);
    await Promise.all(
      Array.from({ length: 4 }, () =>
        call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, { motivo: "Teste" }),
      ),
    );
    expect((await estoqueDe(prod)).fisico).toBe(10);
  });

  it("agendamentos simultâneos no mesmo horário: só um entra", async () => {
    const c = await cliente();
    const t = (await call("POST", p("/profissionais"), ADMIN, { nome: "Técnico" })).body
      .profissional!.id;
    const inicio = NOW + 24 * H;
    const respostas = await Promise.all(
      Array.from({ length: 4 }, () =>
        call("POST", p("/agenda"), ADMIN, {
          cliente: c,
          profissional: t,
          tipo: "instalacao",
          inicio,
          inicioSegundo: inicio + 2 * H,
          campos: { endereco: "Rua B" },
        }),
      ),
    );
    expect(respostas.filter((r) => r.status === 201)).toHaveLength(1);
  });
});

describe("revisão cruzada: guardas no banco e idempotência", () => {
  const AMANHA = NOW + 24 * H;
  async function parAgendado(extra: Record<string, unknown> = {}) {
    const c = await cliente();
    const t = (await call("POST", p("/profissionais"), ADMIN, { nome: "Técnico" })).body
      .profissional!.id;
    const r = await call("POST", p("/agenda"), ADMIN, {
      cliente: c,
      profissional: t,
      tipo: "instalacao",
      inicio: AMANHA,
      inicioSegundo: AMANHA + 3 * H,
      campos: { endereco: "Rua C" },
      ...extra,
    });
    return { c, t, par: r.body.atendimentos! };
  }

  it("revisão: segunda gravação com a mesma revisão esperada é desfeita pelo trigger", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades: 1 }])).body.venda!;
    const grava = () =>
      env.DB.prepare("UPDATE sales SET revision = ?, updated_at = ? WHERE id = ?")
        .bind(v.revisao + 1, NOW + 1, v.id)
        .run();
    await grava(); // a primeira tela salvou
    await expect(grava()).rejects.toThrow(/venda_alterada/); // a segunda, com a revisão antiga
  });

  it("revisão: gravações simultâneas pela API deixam uma vencedora e reservas coerentes", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 20);
    const v = (await venda(c, [{ produto: prod, unidades: 1 }])).body.venda!;
    const respostas = await Promise.all(
      [2, 3, 4, 5].map((unidades) =>
        call("POST", p(`/vendas/${v.id}/itens`), ADMIN, {
          revisao: v.revisao,
          itens: [{ produto: prod, unidades }],
        }),
      ),
    );
    const ok = respostas.filter((r) => r.status === 200);
    expect(ok).toHaveLength(1);
    const final = (await call("GET", p(`/vendas/${v.id}`), ADMIN)).body.venda!;
    expect(final.revisao).toBe(v.revisao + 1);
    expect((await estoqueDe(prod)).reservado).toBe(final.itens[0]!.unidades);
  });

  it("remarcação: se um atendimento do par já começou, o lote inteiro é desfeito", async () => {
    const { par } = await parAgendado();
    const [inst, ret] = par;
    await call("POST", p(`/agenda/${inst!.id}/iniciar`), ADMIN, {});
    // O mesmo lote que o handler monta, como se a leitura tivesse sido anterior ao início.
    await expect(
      env.DB.batch(
        remarcacoes(
          env.DB,
          S,
          [
            { id: inst!.id, inicio: AMANHA + 2 * H, fim: AMANHA + 3 * H },
            { id: ret!.id, inicio: AMANHA + 3 * H + 30 * MIN, fim: AMANHA + 4 * H + 30 * MIN },
          ],
          NOW,
        ),
      ),
    ).rejects.toThrow(/atendimento_iniciado/);
    const agenda = (await call("GET", p("/agenda"), ADMIN)).body.atendimentos!;
    expect(agenda.find((a) => a.id === ret!.id)!.inicio).toBe(AMANHA + 3 * H);
  });

  it("vínculo: atendimento não é gravado para venda cancelada", async () => {
    const { c, t } = await parAgendado();
    const prod = await produto();
    await entrada(prod, 5);
    const v = (await venda(c, [{ produto: prod, unidades: 1 }])).body.venda!;
    await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    await call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, { motivo: "Desistiu" });
    // INSERT direto, como se a venda tivesse sido cancelada depois da leitura do handler.
    await expect(
      env.DB.prepare(
        `INSERT INTO appointments (id, system_id, customer_id, professional_id, service_type, start_at, end_at,
           sale_id, created_by, created_at, updated_at) VALUES ('x', ?, ?, ?, 'instalacao', ?, ?, ?, 'a', ?, ?)`,
      )
        .bind(S, c, t, AMANHA + 10 * H, AMANHA + 11 * H, v.id, NOW, NOW)
        .run(),
    ).rejects.toThrow(/venda_indisponivel/);
  });

  it("remarcação idempotente: repetir a chave antiga não desfaz a remarcação posterior", async () => {
    const { par } = await parAgendado();
    const inst = par[0]!;
    const k = { inicio: AMANHA + H, inicioSegundo: AMANHA + 4 * H };
    const l = { inicio: AMANHA + 2 * H, inicioSegundo: AMANHA + 5 * H };
    await call("POST", p(`/agenda/${inst.id}/remarcar`), ADMIN, k, "chave-remarcar-k");
    await call("POST", p(`/agenda/${inst.id}/remarcar`), ADMIN, l, "chave-remarcar-l");
    await call("POST", p(`/agenda/${inst.id}/remarcar`), ADMIN, k, "chave-remarcar-k");
    const agenda = (await call("GET", p("/agenda"), ADMIN)).body.atendimentos!;
    expect(agenda.find((a) => a.id === inst.id)!.inicio).toBe(AMANHA + 2 * H);
    const reuso = await call(
      "POST",
      p(`/agenda/${inst.id}/remarcar`),
      ADMIN,
      l,
      "chave-remarcar-k",
    );
    expect(reuso.body.error!.code).toBe("chave_idempotencia_reutilizada");
  });

  it("mesma chave em paralelo devolve o resultado vencedor, não um conflito", async () => {
    const c = await cliente();
    const t = (await call("POST", p("/profissionais"), ADMIN, { nome: "Técnico" })).body
      .profissional!.id;
    const corpo = {
      cliente: c,
      profissional: t,
      tipo: "instalacao",
      inicio: AMANHA,
      inicioSegundo: AMANHA + 2 * H,
      campos: { endereco: "Rua D" },
    };
    const agendas = await Promise.all(
      Array.from({ length: 3 }, () => call("POST", p("/agenda"), ADMIN, corpo, "chave-agenda-par")),
    );
    expect(agendas.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(agendas.map((r) => r.body.atendimentos![0]!.id)).size).toBe(1);

    const prod = await produto();
    await entrada(prod, 10);
    const correcao = { produto: prod, fisicoEsperado: 10, novoFisico: 8, motivo: "Contagem" };
    const correcoes = await Promise.all(
      Array.from({ length: 3 }, () =>
        call("POST", p("/estoque/correcoes"), ADMIN, correcao, "chave-correcao-1"),
      ),
    );
    expect(correcoes.map((r) => r.status)).toEqual([201, 201, 201]);
    expect((await estoqueDe(prod)).fisico).toBe(8);
  });
});

describe("revisão cruzada, segunda passada", () => {
  it("rascunho: a mesma chave em paralelo devolve a gravação vencedora", async () => {
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 20);
    const v = (await venda(c, [{ produto: prod, unidades: 1 }])).body.venda!;
    const corpo = { revisao: v.revisao, itens: [{ produto: prod, unidades: 4 }] };
    const respostas = await Promise.all(
      Array.from({ length: 3 }, () =>
        call("POST", p(`/vendas/${v.id}/itens`), ADMIN, corpo, "chave-salvar-rascunho"),
      ),
    );
    expect(respostas.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(new Set(respostas.map((r) => r.body.venda!.revisao))).toEqual(new Set([v.revisao + 1]));
    expect((await estoqueDe(prod)).reservado).toBe(4);
  });

  it("agenda: o outro atendimento do par vem junto mesmo fora do período", async () => {
    const c = await cliente();
    const t = (await call("POST", p("/profissionais"), ADMIN, { nome: "Técnico" })).body
      .profissional!.id;
    const inicio = NOW + 24 * H;
    await call("POST", p("/agenda"), ADMIN, {
      cliente: c,
      profissional: t,
      tipo: "instalacao",
      inicio,
      inicioSegundo: inicio + 10 * 24 * H,
      campos: { endereco: "Rua E" },
    });
    const de = NOW;
    const ate = NOW + 7 * 24 * H;
    const lista = (await call("GET", p(`/agenda?de=${de}&ate=${ate}`), ADMIN)).body.atendimentos!;
    expect(lista.map((a) => a.posicaoNoPar)).toEqual([1, 2]);
  });
});

// ---- Regras do catálogo ampliado (ADR-005) e painel: cada regra é aplicada pela operação ----

describe("regras do catálogo (ADR-005)", () => {
  const AMANHA = NOW + 24 * H; // sexta, 06/11, 09:00 em São Paulo
  async function ativarCom(extras: Record<string, unknown>[]) {
    S = await ativar(ADMIN, {
      ...DISTRIBUIDORA,
      requisitos: [
        ...DISTRIBUIDORA.requisitos,
        { id: "REQ-90", texto: "Regras extras do catálogo", status: "confirmado" },
      ],
      regras: [...DISTRIBUIDORA.regras, ...extras.map((r) => ({ ...r, requisitos: ["REQ-90"] }))],
    });
  }
  async function tecnico() {
    return (await call("POST", p("/profissionais"), ADMIN, { nome: "Técnico Ana" })).body
      .profissional!.id;
  }
  const par = (c: string, t: string, inicio: number) =>
    call("POST", p("/agenda"), ADMIN, {
      cliente: c,
      profissional: t,
      tipo: "instalacao",
      inicio,
      inicioSegundo: inicio + 2 * H,
      campos: { endereco: "Rua A, 10" },
    });

  it("pedido mínimo: abaixo do valor a venda não conclui; a partir dele, conclui", async () => {
    await ativarCom([{ tipo: "pedido_minimo", valor_centavos: 5000 }]);
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 100);
    const v = (await venda(c, [{ produto: prod, unidades: 2 }])).body.venda!;
    const baixo = await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    expect(baixo.status).toBe(409);
    expect(baixo.body.error!.code).toBe("pedido_minimo");
    const maior = (
      await call("POST", p(`/vendas/${v.id}/itens`), ADMIN, {
        revisao: v.revisao,
        itens: [{ produto: prod, unidades: 10 }],
      })
    ).body.venda!;
    const ok = await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, {
      revisao: maior.revisao,
    });
    expect(ok.body.venda!.status).toBe("completed");
  });

  it("limite de unidades por item: pedido acima do limite é recusado", async () => {
    await ativarCom([{ tipo: "limite_unidades_por_item", unidades: 24 }]);
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 100);
    const r = await venda(c, [{ produto: prod, caixas: 2, unidades: 1 }]); // 25 unidades
    expect(r.status).toBe(422);
    expect(r.body.error!.code).toBe("limite_unidades_por_item");
    expect((await venda(c, [{ produto: prod, caixas: 2 }])).status).toBe(201);
  });

  it("prazo para cancelar venda: depois do prazo, a venda concluída não é cancelada", async () => {
    await ativarCom([{ tipo: "prazo_cancelamento_venda", dias: 7 }]);
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 100);
    const v = (await venda(c, [{ produto: prod, unidades: 1 }])).body.venda!;
    await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    agora = NOW + 8 * 24 * H;
    const r = await call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, { motivo: "Desistiu" });
    expect(r.status).toBe(409);
    expect(r.body.error!.code).toBe("prazo_cancelamento_venda");
  });

  it("horário de funcionamento: fora do horário ou do dia é recusado; dentro, agenda", async () => {
    await ativarCom([
      {
        tipo: "horario_funcionamento",
        abre: "08:00",
        fecha: "18:00",
        dias_semana: [1, 2, 3, 4, 5],
      },
    ]);
    const c = await cliente();
    const t = await tecnico();
    const cedo = await par(c, t, AMANHA - 2 * H); // sexta 07:00
    expect(cedo.status).toBe(422);
    expect(cedo.body.error!.code).toBe("fora_do_horario");
    const sabado = await par(c, t, AMANHA + 24 * H); // sábado 09:00
    expect(sabado.body.error!.code).toBe("fora_do_horario");
    const tarde = await par(c, t, AMANHA + 7 * H); // sexta 16:00, retirada termina às 19:00
    expect(tarde.body.error!.code).toBe("fora_do_horario");
    expect((await par(c, t, AMANHA)).status).toBe(201); // sexta 09:00 a 12:00
  });

  it("antecedência mínima: em cima da hora é recusado", async () => {
    await ativarCom([{ tipo: "antecedencia_minima", minutos: 24 * 60 }]);
    const c = await cliente();
    const t = await tecnico();
    const r = await par(c, t, NOW + 3 * H);
    expect(r.status).toBe(422);
    expect(r.body.error!.code).toBe("antecedencia_minima");
    expect((await par(c, t, AMANHA + H)).status).toBe(201);
  });

  it("prazo para cancelar atendimento: perto do início não cancela nem remarca", async () => {
    await ativarCom([{ tipo: "prazo_cancelamento_atendimento", horas: 24 }]);
    const c = await cliente();
    const t = await tecnico();
    const a = (await par(c, t, NOW + 5 * H)).body.atendimentos![0]!;
    const cancelar = await call("POST", p(`/agenda/${a.id}/cancelar`), ADMIN, { motivo: "Chuva" });
    expect(cancelar.status).toBe(409);
    expect(cancelar.body.error!.code).toBe("prazo_cancelamento_atendimento");
    const remarcar = await call("POST", p(`/agenda/${a.id}/remarcar`), ADMIN, {
      inicio: AMANHA + 2 * 24 * H,
      inicioSegundo: AMANHA + 2 * 24 * H + 2 * H,
    });
    expect(remarcar.body.error!.code).toBe("prazo_cancelamento_atendimento");
  });

  it("prazo para cancelar atendimento vale pelo par e pela venda (revisão do Codex)", async () => {
    await ativarCom([{ tipo: "prazo_cancelamento_atendimento", horas: 24 }]);
    const c = await cliente();
    const t = await tecnico();
    const [, segundo] = (
      await call("POST", p("/agenda"), ADMIN, {
        cliente: c,
        profissional: t,
        tipo: "instalacao",
        inicio: NOW + 5 * H,
        inicioSegundo: NOW + 72 * H,
        campos: { endereco: "Rua A, 10" },
      })
    ).body.atendimentos!;
    const peloSegundo = await call("POST", p(`/agenda/${segundo!.id}/cancelar`), ADMIN, {
      motivo: "Chuva",
    });
    expect(peloSegundo.body.error!.code).toBe("prazo_cancelamento_atendimento");

    const prod = await produto();
    await entrada(prod, 10);
    const v = (await venda(c, [{ produto: prod, unidades: 2 }])).body.venda!;
    await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    await call("POST", p("/agenda"), ADMIN, {
      cliente: c,
      profissional: t,
      tipo: "instalacao",
      inicio: NOW + 6 * H,
      inicioSegundo: NOW + 9 * H,
      campos: { endereco: "Rua A, 10" },
      venda: v.id,
    });
    const pelaVenda = await call("POST", p(`/vendas/${v.id}/cancelar`), ADMIN, {
      motivo: "Desistiu",
      cancelarServicos: true,
    });
    expect(pelaVenda.body.error!.code).toBe("prazo_cancelamento_atendimento");
    expect((await call("GET", p(`/vendas/${v.id}`), ADMIN)).body.venda!.status).toBe("completed");
  });

  it("painel: vendas do dia e do mês, abertas, clientes ativos, estoque abaixo do mínimo e agenda", async () => {
    await ativarCom([{ tipo: "estoque_minimo", unidades: 10 }]);
    const c = await cliente();
    await call("POST", p(`/clientes/${await cliente("Inativo")}/status`), ADMIN, {
      status: "inactive",
    });
    const cerveja = await produto();
    const agua = await produto({ nome: "Água" });
    await entrada(cerveja, 100);
    await entrada(agua, 8);
    const v = (await venda(c, [{ produto: cerveja, unidades: 4 }])).body.venda!;
    await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    await venda(c, [{ produto: cerveja, unidades: 1 }]); // rascunho aberto
    const t = await tecnico();
    await par(c, t, AMANHA);
    const r = await call("GET", p("/painel"), ADMIN);
    expect(r.status).toBe(200);
    const painel = (r.body as unknown as { painel: PainelDto }).painel;
    expect(painel.hoje).toBe("2026-11-05");
    expect(painel.vendas).toMatchObject({
      hoje: { quantidade: 1, totalCentavos: 2000 },
      mes: { quantidade: 1, totalCentavos: 2000 },
      abertas: 1,
      canceladasNoMes: 0,
    });
    expect(painel.clientes).toEqual({ ativos: 1, inativos: 1 });
    expect(painel.estoque).toMatchObject({ produtosAtivos: 2, minimo: 10, abaixoDoMinimo: 1 });
    expect(painel.estoque!.criticos[0]).toMatchObject({ nome: "Água", disponivel: 8 });
    expect(painel.agenda!.proximos).toHaveLength(2);
  });
  const painelDe = async (token = ADMIN) =>
    (
      (await call("GET", p("/painel"), token)).body as unknown as {
        painel: PainelDto;
      }
    ).painel;

  it("painel: dia e mês contados no fuso de São Paulo, sem a virada errada", async () => {
    await ativarCom([]);
    const c = await cliente();
    const prod = await produto();
    await entrada(prod, 100);
    const vendaConcluida = async (unidades: number) => {
      const v = (await venda(c, [{ produto: prod, unidades }])).body.venda!;
      await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    };
    agora = Date.UTC(2026, 10, 1, 2, 59); // 31/10, 23:59 em São Paulo: mês anterior
    await vendaConcluida(1);
    agora = Date.UTC(2026, 10, 1, 3, 0); // 01/11, 00:00
    await vendaConcluida(2);
    agora = Date.UTC(2026, 10, 6, 2, 59); // 05/11, 23:59
    await vendaConcluida(3);
    let painel = await painelDe();
    expect(painel.hoje).toBe("2026-11-05");
    expect(painel.vendas!.hoje).toEqual({ quantidade: 1, totalCentavos: 1500 });
    expect(painel.vendas!.mes).toEqual({ quantidade: 2, totalCentavos: 2500 });
    agora = Date.UTC(2026, 10, 6, 3, 0); // 06/11, 00:00: o dia virou, o mês não
    painel = await painelDe();
    expect(painel.vendas!.hoje.quantidade).toBe(0);
    expect(painel.vendas!.mes.quantidade).toBe(2);
  });

  it("painel: só os números do próprio sistema e só dos módulos que ele tem", async () => {
    await ativarCom([]);
    const prod = await produto();
    await entrada(prod, 100);
    const v = (await venda(await cliente(), [{ produto: prod, unidades: 4 }])).body.venda!;
    await call("POST", p(`/vendas/${v.id}/concluir`), ADMIN, { revisao: v.revisao });
    const doAdmin = S;

    S = await ativar(ADMIN2, {
      ...DISTRIBUIDORA,
      modelo: "comercio",
      modulos: ["clientes", "produtos", "vendas", "estoque"],
      campos: DISTRIBUIDORA.campos.filter((c) => c.entidade !== "agendamentos"),
      tipos_atendimento: [],
      regras: DISTRIBUIDORA.regras.filter((r) => r.tipo !== "par_atendimento"),
    });
    const outro = await painelDe(ADMIN2);
    expect(outro.vendas!.mes.quantidade).toBe(0);
    expect(outro.clientes).toEqual({ ativos: 0, inativos: 0 });
    expect(outro.estoque!.produtosAtivos).toBe(0);
    expect(outro.agenda).toBeUndefined();
    expect((await call("GET", p("/painel"), ADMIN)).status).toBe(404);
    S = doAdmin;
    expect((await call("GET", p("/painel"), ADMIN2)).status).toBe(404);
  });
});
