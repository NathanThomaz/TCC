import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { PedidoDto, PedidoGeralDto } from "../../src/shared/api";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { limparBanco } from "../limpar-banco";

// Página do desenvolvedor: o dono do Nexus vê os pedidos de todas as contas, decide o andamento e
// responde; quem pediu acompanha pela página de pedidos do sistema (pedido do dono, 2026-11-15).

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);
const identidade = (uid: string, email: string): VerifiedToken => ({
  uid,
  email,
  emailVerified: true,
  authTime: NOW,
});
const DONO = "token-dono-00000000000000";
const CLIENTE = "token-cliente-00000000000";
const IDENTITIES: Record<string, VerifiedToken> = {
  [DONO]: identidade("uid-a", "a@example.com"),
  [CLIENTE]: identidade("uid-b", "b@example.com"),
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
  token: string,
  body?: unknown,
  chave: string = crypto.randomUUID(),
) {
  const response = await app(
    new Request(`https://app.test/api/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(method === "POST" ? { "idempotency-key": chave } : {}),
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

type Geral = { pedidos?: PedidoGeralDto[]; pedido?: PedidoGeralDto };
type DoSistema = { pedidos?: PedidoDto[]; pedido?: PedidoDto };

let sistema = "";
let pedido = "";

beforeEach(async () => {
  await limparBanco();
  const T = NOW - 86_400_000;
  // 'b' criou a própria conta pelo cadastro aberto: é cliente, não o dono do Nexus.
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, display_name, role, status, owner_id, self_signup, created_at, updated_at) VALUES
     ('a', 'uid-a', 'a@example.com', 'Nathan', 'admin', 'active', NULL, 0, ${T}, ${T}),
     ('b', 'uid-b', 'b@example.com', 'Bia', 'admin', 'active', NULL, 1, ${T}, ${T})`,
  ).run();
  const s = await call<{ sistema: { id: string } }>("POST", "/systems", CLIENTE, {
    nome: "Loja da Bia",
  });
  sistema = s.body.sistema.id;
  const p = await call<DoSistema>("POST", `/systems/${sistema}/pedidos`, CLIENTE, {
    titulo: "Emitir nota fiscal",
    pedido: "Quero emitir nota fiscal pelo sistema.",
  });
  pedido = p.body.pedido!.id;
});

const doCliente = async () =>
  (await call<DoSistema>("GET", `/systems/${sistema}/pedidos`, CLIENTE)).body.pedidos![0]!;

describe("pedidos de todas as contas (desenvolvedor)", () => {
  it("o dono do Nexus vê o pedido com o sistema e quem pediu", async () => {
    const r = await call<Geral>("GET", "/pedidos", DONO);
    expect(r.status).toBe(200);
    expect(r.body.pedidos).toHaveLength(1);
    expect(r.body.pedidos![0]).toMatchObject({
      id: pedido,
      titulo: "Emitir nota fiscal",
      estado: "aberto",
      sistema: { id: sistema, nome: "Loja da Bia" },
      pedidoPor: { nome: "Bia", email: "b@example.com" },
    });
  });

  it("outra conta não vê nem altera os pedidos de todos", async () => {
    expect((await call("GET", "/pedidos", CLIENTE)).body.error!.code).toBe("so_o_dono");
    const estado = await call("POST", `/pedidos/${pedido}/estado`, CLIENTE, {
      estado: "implementado",
    });
    expect(estado.status).toBe(403);
    const coment = await call("POST", `/pedidos/${pedido}/comentarios`, CLIENTE, { texto: "x" });
    expect(coment.status).toBe(403);
  });

  it("o andamento com nota aparece para quem pediu", async () => {
    const analise = await call<Geral>("POST", `/pedidos/${pedido}/estado`, DONO, {
      estado: "em_analise",
      nota: "Vou avaliar com a integração da prefeitura.",
    });
    expect(analise.status).toBe(200);
    expect(analise.body.pedido!.estado).toBe("em_analise");
    await call("POST", `/pedidos/${pedido}/estado`, DONO, { estado: "implementado" });
    const visto = await doCliente();
    expect(visto.estado).toBe("implementado");
    expect(visto.historico.map((h) => [h.estado, h.nota])).toEqual([
      ["aberto", "Pedido registrado para avaliação, sem previsão de implementação."],
      ["em_analise", "Vou avaliar com a integração da prefeitura."],
      ["implementado", null],
    ]);
  });

  it("recusa transição inválida e estado final, sem gravar nada", async () => {
    await call("POST", `/pedidos/${pedido}/estado`, DONO, { estado: "recusado" });
    const r = await call("POST", `/pedidos/${pedido}/estado`, DONO, { estado: "em_analise" });
    expect(r.status).toBe(409);
    expect((await doCliente()).historico).toHaveLength(2);
    // Cancelar é só de quem pediu.
    const cancelar = await call("POST", `/pedidos/${pedido}/estado`, DONO, {
      estado: "cancelado",
    });
    expect(cancelar.status).toBe(422);
  });

  it("pedido cancelado por quem pediu não volta a andar", async () => {
    await call("POST", `/systems/${sistema}/pedidos/${pedido}/cancelar`, CLIENTE, {});
    const r = await call("POST", `/pedidos/${pedido}/estado`, DONO, { estado: "em_analise" });
    expect(r.status).toBe(409);
    expect((await doCliente()).estado).toBe("cancelado");
  });

  it("a resposta do desenvolvedor fica marcada; o comentário de quem pediu, não", async () => {
    await call("POST", `/systems/${sistema}/pedidos/${pedido}/comentarios`, CLIENTE, {
      texto: "Preciso disso até o fim do ano.",
    });
    const r = await call<Geral>("POST", `/pedidos/${pedido}/comentarios`, DONO, {
      texto: "Anotado. Aviso quando começar.",
    });
    expect(r.status).toBe(201);
    expect((await doCliente()).comentarios.map((c) => [c.texto, c.doDesenvolvedor])).toEqual([
      ["Preciso disso até o fim do ano.", false],
      ["Anotado. Aviso quando começar.", true],
    ]);
  });

  it("repetir a mesma mudança (mesma chave) não duplica o histórico", async () => {
    const chave = crypto.randomUUID();
    const corpo = { estado: "em_analise", nota: "Avaliando." };
    const a = await call("POST", `/pedidos/${pedido}/estado`, DONO, corpo, chave);
    const b = await call("POST", `/pedidos/${pedido}/estado`, DONO, corpo, chave);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((await doCliente()).historico).toHaveLength(2);
  });

  it("pedido inexistente: 404", async () => {
    const r = await call("POST", "/pedidos/nao-existe/estado", DONO, { estado: "em_analise" });
    expect(r.status).toBe(404);
  });
});
