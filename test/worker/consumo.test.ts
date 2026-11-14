import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ConsumoDto, InicioDto } from "../../src/shared/api";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import type { ProvedorIa } from "../../src/worker/ia/gemini";
import { limparBanco } from "../limpar-banco";

// Limite de IA por conta e consumo por conta, só do dono do Nexus (ADR-009).

const NOW = Date.UTC(2026, 10, 14, 12, 0, 0);
const identidade = (uid: string, email: string): VerifiedToken => ({
  uid,
  email,
  emailVerified: true,
  authTime: NOW,
});
const DONO = "token-dono-00000000000000";
const NOVO = "token-novo-00000000000000";
const DO_NOVO = "token-do-novo-0000000000";
const IDENTITIES: Record<string, VerifiedToken> = {
  [DONO]: identidade("uid-a", "a@example.com"),
  [NOVO]: identidade("uid-b", "b@example.com"),
  [DO_NOVO]: identidade("uid-bs", "bs@example.com"),
};

let chamadasIa = 0;
const provedor: ProvedorIa = {
  modelo: "simulado",
  gerar() {
    chamadasIa++;
    return Promise.resolve({
      texto: JSON.stringify({
        resposta: "Entendi.",
        respostas_rapidas: [],
        assunto_atual: "negocio",
        pronto_para_revisar: false,
        perguntas: [],
        pedidos_desenvolvedor: [],
        requisitos: [],
      }),
      tokensEntrada: 1200,
      tokensSaida: 400,
    });
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

async function call<T = Record<string, unknown>>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
) {
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
  return {
    status: response.status,
    body: await response.json<T & { error?: { code: string } }>(),
  };
}

async function novoSistema(token: string): Promise<string> {
  const r = await call<{ sistema: { id: string } }>("POST", "/systems", token, { nome: "Loja" });
  return r.body.sistema.id;
}

async function conversar(token: string, sistema: string) {
  const estado = await call<{ revisao: number }>("GET", `/systems/${sistema}/criacao`, token);
  return call("POST", `/systems/${sistema}/criacao/mensagens`, token, {
    texto: "Tenho uma loja",
    revisao: estado.body.revisao,
  });
}

/** Gasto já registrado no mês (em micro-reais) por um usuário. */
async function gastou(
  usuario: string,
  sistema: string,
  micro: number,
  finalidade = "levantamento",
) {
  await env.DB.prepare(
    `INSERT INTO ai_usage (id, system_id, user_id, purpose, model, state, reserved_micro_brl, cost_micro_brl, created_at)
     VALUES (?, ?, ?, ?, 'simulado', 'concluido', 0, ?, ?)`,
  )
    .bind(crypto.randomUUID(), sistema, usuario, finalidade, micro, NOW - 1000)
    .run();
}

beforeEach(async () => {
  chamadasIa = 0;
  await limparBanco();
  const T = NOW - 86_400_000;
  // 'b' criou a própria conta antes do dono existir no relógio: nem assim vira o dono.
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, self_signup, created_at, updated_at) VALUES
     ('b', 'uid-b', 'b@example.com', 'admin', 'active', NULL, 1, ${T - 5000}, ${T}),
     ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, 0, ${T}, ${T}),
     ('bs', 'uid-bs', 'bs@example.com', 'secondary', 'active', 'b', 0, ${T}, ${T})`,
  ).run();
});

describe("limite de IA por conta (ADR-009)", () => {
  it("barra a conta no limite, somando as contas secundárias dela, sem chamar a IA", async () => {
    const sistema = await novoSistema(NOVO);
    await gastou("bs", sistema, 3_000_000); // R$ 3,00: o limite padrão
    const r = await conversar(NOVO, sistema);
    expect(r.status).toBe(503);
    expect(r.body.error!.code).toBe("limite_ia_conta");
    expect(chamadasIa).toBe(0);
  });

  it("abaixo do limite, a conversa segue", async () => {
    const sistema = await novoSistema(NOVO);
    await gastou("b", sistema, 1_000_000);
    expect((await conversar(NOVO, sistema)).status).toBe(201);
    expect(chamadasIa).toBe(1);
  });

  it("o dono do Nexus não tem limite por conta, só o teto geral", async () => {
    const sistema = await novoSistema(DONO);
    await gastou("a", sistema, 5_000_000); // acima do limite padrão de uma conta
    expect((await conversar(DONO, sistema)).status).toBe(201);
    await gastou("a", sistema, 15_000_000); // R$ 20,00 no total: o teto do Nexus
    expect((await conversar(DONO, sistema)).body.error!.code).toBe("limite_ia");
  });

  it("o limite ajustado pelo dono libera a conta e fica na auditoria", async () => {
    const sistema = await novoSistema(NOVO);
    await gastou("b", sistema, 3_000_000);
    const ajuste = await call("POST", "/consumo/b/limite", DONO, { limiteCentavos: 1000 });
    expect(ajuste.status).toBe(200);
    expect((await conversar(NOVO, sistema)).status).toBe(201);
    const audit = await env.DB.prepare(
      "SELECT actor_id, details_json FROM audit_events WHERE action = 'conta.limite_ia'",
    ).first<{ actor_id: string; details_json: string }>();
    expect(audit).toEqual({ actor_id: "a", details_json: '{"limite_centavos":1000}' });
  });

  it("tela inicial: o dono vê o teto do Nexus; as outras contas, o próprio limite", async () => {
    const sistema = await novoSistema(NOVO);
    await gastou("bs", sistema, 1_500_000);
    const daConta = await call<{ inicio: InicioDto }>("GET", "/inicio", NOVO);
    expect(daConta.body.inicio.ia).toEqual({
      gastoCentavos: 150,
      tetoCentavos: 300,
      escopo: "conta",
    });
    const doDono = await call<{ inicio: InicioDto }>("GET", "/inicio", DONO);
    expect(doDono.body.inicio.ia).toEqual({
      gastoCentavos: 150,
      tetoCentavos: 2000,
      escopo: "nexus",
    });
  });
});

describe("consumo por conta, só do dono (ADR-009)", () => {
  it("lista cada conta com o gasto dela e das secundárias, por etapa", async () => {
    const doNovo = await novoSistema(NOVO);
    const doDono = await novoSistema(DONO);
    await gastou("b", doNovo, 400_000, "levantamento");
    await gastou("bs", doNovo, 120_000, "consulta");
    await gastou("a", doDono, 50_000, "modelagem");
    const r = await call<{ consumo: ConsumoDto }>("GET", "/consumo", DONO);
    expect(r.status).toBe(200);
    const { consumo } = r.body;
    expect(consumo).toMatchObject({
      mes: "2026-11",
      tetoCentavos: 2000,
      gastoTotalCentavos: 57,
      limitePadraoCentavos: 300,
    });
    expect(consumo.contas.map((c) => c.id)).toEqual(["b", "a"]); // mais gasto primeiro
    const [novo, dono] = consumo.contas;
    expect(novo).toMatchObject({
      cadastro: true,
      dono: false,
      sistemas: 1,
      chamadas: 2,
      gastoCentavos: 52,
      limiteCentavos: 300,
      limitePadrao: true,
    });
    expect(novo!.porEtapa.find((e) => e.finalidade === "consulta")).toEqual({
      finalidade: "consulta",
      chamadas: 1,
      gastoCentavos: 12,
    });
    expect(dono).toMatchObject({ dono: true, cadastro: false, limiteCentavos: null });
  });

  it("outras contas não veem o consumo nem ajustam limites", async () => {
    for (const token of [NOVO, DO_NOVO]) {
      expect((await call("GET", "/consumo", token)).status).toBe(403);
      const ajuste = await call("POST", "/consumo/b/limite", token, { limiteCentavos: 99_999 });
      expect(ajuste.body.error!.code).toBe("so_o_dono");
    }
  });

  it("recusa limite para o dono, conta inexistente ou secundária e valor fora da faixa", async () => {
    const doDono = await call("POST", "/consumo/a/limite", DONO, { limiteCentavos: 10 });
    expect(doDono.body.error!.code).toBe("dono_sem_limite");
    expect((await call("POST", "/consumo/zz/limite", DONO, { limiteCentavos: 10 })).status).toBe(
      404,
    );
    expect((await call("POST", "/consumo/bs/limite", DONO, { limiteCentavos: 10 })).status).toBe(
      404,
    );
    for (const limiteCentavos of [-1, 100_001, 1.5, "10"]) {
      const r = await call("POST", "/consumo/b/limite", DONO, { limiteCentavos });
      expect(r.status).toBe(422);
      expect(r.body.error!.code).not.toBe("dono_sem_limite");
    }
    // null volta ao padrão.
    await call("POST", "/consumo/b/limite", DONO, { limiteCentavos: 50 });
    await call("POST", "/consumo/b/limite", DONO, { limiteCentavos: null });
    const row = await env.DB.prepare("SELECT ai_limit_cents FROM users WHERE id = 'b'").first();
    expect(row).toEqual({ ai_limit_cents: null });
  });
});
