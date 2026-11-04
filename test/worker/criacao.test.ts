import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { CriacaoApiBody, SystemsApiBody } from "../../src/shared/api";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { IaIndisponivel, type PedidoIa, type ProvedorIa } from "../../src/worker/ia/gemini";
import { custoMicroBrl } from "../../src/worker/ia/orcamento";
import { mesclarRequisitos } from "../../src/worker/modules/criacao";
import { DISTRIBUIDORA } from "../fixtures/distribuidora";
import { limparBanco } from "../limpar-banco";

// Criação por conversa (seção 8) com a IA simulada: T05, T06, T08, T10, T30 e T33.

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
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

/** IA roteirizada: devolve as respostas na ordem e guarda os pedidos recebidos. */
let roteiro: (string | Error)[] = [];
let pedidos: PedidoIa[] = [];
let comIa = true;
const provedor: ProvedorIa = {
  modelo: "simulado",
  gerar(pedido) {
    pedidos.push(pedido);
    const proxima = roteiro.shift();
    if (proxima === undefined) return Promise.reject(new Error("roteiro vazio"));
    if (proxima instanceof Error) return Promise.reject(proxima);
    return Promise.resolve({ texto: proxima, tokensEntrada: 1200, tokensSaida: 400 });
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
  ia: () => (comIa ? provedor : undefined),
});

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
  return { status: response.status, body: await response.json<CriacaoApiBody & SystemsApiBody>() };
}

const levantamento = (dados: Partial<Record<string, unknown>>) =>
  JSON.stringify({
    resposta: "Entendi.",
    requisitos: [],
    perguntas: [],
    fora_do_catalogo: [],
    ...dados,
  });

const TEXTOS = [
  "Vender bebidas com estoque e clientes",
  "Atacado a partir de R$ 1.000 a preço de varejo",
  "Cerveja vendida avulsa ou na caixa com 12",
  "Pedido aberto segura o estoque por 30 minutos",
  "Instalação e retirada da chopeira pelo mesmo técnico, uma hora cada",
];

let S = "";
const c = (path = "") => `/systems/${S}/criacao${path}`;

beforeEach(async () => {
  roteiro = [];
  pedidos = [];
  comIa = true;
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at) VALUES
     ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T}),
     ('s', 'uid-s', 's@example.com', 'secondary', 'active', 'a', ${T}, ${T})`,
  ).run();
  S = (await call("POST", "/systems", ADMIN, { nome: "Distribuidora Exemplo" })).body.sistema!.id;
});

/** Conversa até os 5 requisitos da distribuidora, todos confirmados pelo usuário. */
async function requisitosConfirmados() {
  roteiro.push(levantamento({ requisitos: TEXTOS.map((texto) => ({ codigo: null, texto })) }));
  await call("POST", c("/mensagens"), ADMIN, { texto: "Tenho uma distribuidora de bebidas..." });
  for (let n = 1; n <= TEXTOS.length; n++) {
    await call("POST", c(`/requisitos/REQ-0${n}/confirmar`), ADMIN, {});
  }
}

describe("conversa e requisitos", () => {
  it("sem IA configurada, o chat avisa e o formulário continua sendo o caminho", async () => {
    comIa = false;
    expect((await call("GET", c(), ADMIN)).body.iaDisponivel).toBe(false);
    const r = await call("POST", c("/mensagens"), ADMIN, { texto: "Olá" });
    expect(r.status).toBe(503);
    expect(r.body.error!.code).toBe("ia_nao_configurada");
  });

  it("uma rodada grava as duas mensagens, os requisitos pendentes e o consumo", async () => {
    roteiro.push(
      levantamento({
        resposta: "Quanto tempo o pedido aberto segura o estoque?",
        requisitos: [{ codigo: null, texto: TEXTOS[0] }],
        perguntas: ["Quanto tempo o pedido aberto segura o estoque?"],
        fora_do_catalogo: ["Emitir nota fiscal"],
      }),
    );
    const r = await call("POST", c("/mensagens"), ADMIN, {
      texto: "Distribuidora, e quero nota fiscal",
    });
    expect(r.status).toBe(201);
    expect(r.body.mensagens!.map((m) => m.papel)).toEqual(["usuario", "assistente"]);
    expect(r.body.mensagens![1]).toMatchObject({
      perguntas: ["Quanto tempo o pedido aberto segura o estoque?"],
      foraDoCatalogo: ["Emitir nota fiscal"],
    });
    expect(r.body.requisitos).toEqual([
      { codigo: "REQ-01", texto: TEXTOS[0], status: "pendente", origem: "ia" },
    ]);
    // O pedido leva o catálogo e a mensagem; a próxima rodada leva o histórico e os requisitos.
    expect(pedidos[0]!.instrucoes).toContain("CATÁLOGO FECHADO");
    roteiro.push(levantamento({}));
    await call("POST", c("/mensagens"), ADMIN, { texto: "30 minutos" });
    expect(pedidos[1]!.mensagens.map((m) => m.papel)).toEqual(["usuario", "modelo", "usuario"]);
    expect(pedidos[1]!.instrucoes).toContain("REQ-01 [pendente]");
    const uso = await env.DB.prepare(
      "SELECT state, cost_micro_brl FROM ai_usage ORDER BY created_at",
    ).all<{
      state: string;
      cost_micro_brl: number;
    }>();
    expect(uso.results.map((u) => u.state)).toEqual(["concluido", "concluido"]);
    expect(uso.results[0]!.cost_micro_brl).toBe(custoMicroBrl(1200, 400));
  });

  it("T10: repetir a mesma mensagem (mesma chave) não chama a IA de novo nem duplica", async () => {
    roteiro.push(levantamento({ requisitos: [{ codigo: null, texto: TEXTOS[0] }] }));
    await call("POST", c("/mensagens"), ADMIN, { texto: "Olá" }, "chave-mensagem-1");
    const de_novo = await call(
      "POST",
      c("/mensagens"),
      ADMIN,
      { texto: "Olá" },
      "chave-mensagem-1",
    );
    expect(pedidos).toHaveLength(1);
    expect(de_novo.body.mensagens).toHaveLength(2);
  });

  it("T30: falha da IA não grava nada e o progresso anterior continua", async () => {
    roteiro.push(levantamento({ requisitos: [{ codigo: null, texto: TEXTOS[0] }] }));
    await call("POST", c("/mensagens"), ADMIN, { texto: "Primeira" });
    roteiro.push(new IaIndisponivel("http_500"));
    const falha = await call("POST", c("/mensagens"), ADMIN, { texto: "Segunda" });
    expect(falha.status).toBe(503);
    expect(falha.body.error!.code).toBe("ia_indisponivel");
    const atual = (await call("GET", c(), ADMIN)).body;
    expect(atual.mensagens).toHaveLength(2);
    expect(atual.requisitos).toHaveLength(1);
    const falhou = await env.DB.prepare("SELECT error FROM ai_usage WHERE state = 'falhou'").first<{
      error: string;
    }>();
    expect(falhou!.error).toBe("http_500");
  });

  it("resposta fora do formato não altera nada", async () => {
    roteiro.push("isto não é json");
    const r = await call("POST", c("/mensagens"), ADMIN, { texto: "Olá" });
    expect(r.status).toBe(502);
    expect((await call("GET", c(), ADMIN)).body.mensagens).toHaveLength(0);
  });

  it("limite mensal atingido: bloqueia antes de chamar a IA", async () => {
    // R$ 20,00 já consumidos no mês (teto padrão).
    await env.DB.prepare(
      `INSERT INTO ai_usage (id, system_id, user_id, purpose, model, state, reserved_micro_brl, cost_micro_brl, created_at)
       VALUES ('u1', ?, 'a', 'levantamento', 'simulado', 'concluido', 0, 20000000, ?)`,
    )
      .bind(S, NOW - 1000)
      .run();
    roteiro.push(levantamento({}));
    const r = await call("POST", c("/mensagens"), ADMIN, { texto: "Olá" });
    expect(r.body.error!.code).toBe("limite_ia");
    expect(pedidos).toHaveLength(0);
  });

  it("só o administrador conversa; secundário recebe 403", async () => {
    await env.DB.prepare(
      "INSERT INTO system_access (user_id, system_id, granted_by, created_at, updated_at) VALUES ('s', ?, 'a', ?, ?)",
    )
      .bind(S, NOW, NOW)
      .run();
    expect((await call("GET", c(), SEC)).status).toBe(403);
  });

  it("a IA não remove nem duplica requisitos; reescrever um código gera versão pendente", () => {
    const vivos = [
      { codigo: "REQ-01", texto: "A", status: "confirmado" as const, origem: "ia" as const },
      { codigo: "REQ-02", texto: "Bbb", status: "pendente" as const, origem: "ia" as const },
    ];
    const m = mesclarRequisitos(
      vivos,
      [
        { codigo: "REQ-01", texto: "A alterado" },
        { codigo: null, texto: "bbb" }, // igual a um existente: ignorado
        { codigo: "REQ-09", texto: "Novo" }, // código desconhecido: vira novo
      ],
      5,
    );
    expect(m.reescritos).toEqual([{ codigo: "REQ-01", texto: "A alterado", eraConfirmado: true }]);
    expect(m.novos).toEqual([{ codigo: "REQ-06", texto: "Novo" }]);
  });
});

describe("geração, correção e ativação", () => {
  it("T05: requisito pendente impede gerar", async () => {
    roteiro.push(levantamento({ requisitos: [{ codigo: null, texto: TEXTOS[0] }] }));
    await call("POST", c("/mensagens"), ADMIN, { texto: "Olá" });
    const r = await call("POST", c("/gerar"), ADMIN, {});
    expect(r.body.error!.code).toBe("requisitos_pendentes");
    expect(pedidos).toHaveLength(1);
  });

  it("T33: a versão da conversa usa os requisitos confirmados, passa no validador e ativa pelo mesmo fluxo", async () => {
    await requisitosConfirmados();
    // A IA tenta mudar a lista de requisitos: o backend usa a confirmada pelo usuário.
    roteiro.push(
      JSON.stringify({
        ...DISTRIBUIDORA,
        requisitos: [{ id: "REQ-01", texto: "inventado", status: "pendente" }],
      }),
    );
    const g = await call("POST", c("/gerar"), ADMIN, {});
    expect(g.status).toBe(201);
    expect(g.body.versao).toMatchObject({ origem: "chat", status: "valid" });
    const cfg = (await call("GET", `/systems/${S}`, ADMIN)).body.ultimaConfig!;
    expect(cfg.requisitos.map((r) => [r.id, r.status])).toEqual(
      TEXTOS.map((_, i) => [`REQ-0${i + 1}`, "confirmado"]),
    );
    const v = g.body.versao!;
    await call("POST", `/systems/${S}/versions/${v.id}/approve`, ADMIN, { hash: v.hash });
    const ativo = await call("POST", `/systems/${S}/activate`, ADMIN, { versao: v.id });
    expect(ativo.body.sistema!.status).toBe("active");
    // Ativado, a conversa de criação não altera mais nada.
    expect((await call("POST", c("/mensagens"), ADMIN, { texto: "mudar" })).status).toBe(409);
  });

  it("T08: erro bloqueante fica na versão; a correção só roda quando o usuário pede", async () => {
    await requisitosConfirmados();
    roteiro.push(
      JSON.stringify({
        ...DISTRIBUIDORA,
        regras: DISTRIBUIDORA.regras.filter((r) => r.tipo !== "prazo_reserva"),
      }),
    );
    const g = await call("POST", c("/gerar"), ADMIN, {});
    expect(g.body.versao!.status).toBe("invalid");
    expect(g.body.issues!.some((i) => i.severity === "bloqueante")).toBe(true);
    expect(pedidos).toHaveLength(2); // levantamento + geração; nenhuma correção automática

    roteiro.push(JSON.stringify(DISTRIBUIDORA));
    const corr = await call("POST", c("/corrigir"), ADMIN, { versao: g.body.versao!.id });
    expect(corr.body.versao).toMatchObject({ status: "valid", versao: 2 });
    expect(pedidos[2]!.mensagens[0]!.texto).toContain("ERROS DO VALIDADOR");
    // Versão válida não pede correção.
    expect(
      (await call("POST", c("/corrigir"), ADMIN, { versao: corr.body.versao!.id })).status,
    ).toBe(409);
  });

  it("T06: mudar um requisito confirmado invalida a versão aprovada e exige nova confirmação", async () => {
    await requisitosConfirmados();
    roteiro.push(JSON.stringify(DISTRIBUIDORA));
    const v = (await call("POST", c("/gerar"), ADMIN, {})).body.versao!;
    await call("POST", `/systems/${S}/versions/${v.id}/approve`, ADMIN, { hash: v.hash });
    roteiro.push(
      levantamento({
        requisitos: [{ codigo: "REQ-02", texto: "Atacado a partir de R$ 800 a preço de varejo" }],
      }),
    );
    const r = await call("POST", c("/mensagens"), ADMIN, {
      texto: "Na verdade o atacado é a partir de 800",
    });
    expect(r.body.requisitos!.find((q) => q.codigo === "REQ-02")).toMatchObject({
      status: "pendente",
    });
    expect(r.body.versao!.status).toBe("superseded");
    const ativar = await call("POST", `/systems/${S}/activate`, ADMIN, { versao: v.id });
    expect(ativar.status).toBe(409);
  });

  it("o usuário edita, descarta e acrescenta requisitos com as próprias palavras", async () => {
    await requisitosConfirmados();
    const e = await call("POST", c("/requisitos/REQ-01/editar"), ADMIN, {
      texto: "Vender bebidas e gelo",
    });
    expect(e.body.requisitos![0]).toMatchObject({
      texto: "Vender bebidas e gelo",
      status: "confirmado",
      origem: "usuario",
    });
    const d = await call("POST", c("/requisitos/REQ-03/descartar"), ADMIN, {});
    expect(d.body.requisitos!.map((q) => q.codigo)).not.toContain("REQ-03");
    const a = await call("POST", c("/requisitos"), ADMIN, {
      texto: "Anotar o telefone do cliente",
    });
    expect(a.body.requisitos!.at(-1)).toMatchObject({ codigo: "REQ-06", status: "confirmado" });
  });
});
