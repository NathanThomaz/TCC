import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { OperacaoApiBody, SystemsApiBody } from "../../src/shared/api";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { DISTRIBUIDORA } from "../fixtures/distribuidora";
import { limparBanco } from "../limpar-banco";

// Inativar (arquivar), reativar e excluir sistema (pedido do dono, 2026-11-16; migration 0015).

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
const identidade = (uid: string, email: string): VerifiedToken => ({
  uid,
  email,
  emailVerified: true,
  authTime: NOW,
});
const ADMIN = "token-admin-000000000000";
const OUTRO = "token-admin2-00000000000";
const SEC = "token-sec-00000000000000";
const IDENTITIES: Record<string, VerifiedToken> = {
  [ADMIN]: identidade("uid-a", "a@example.com"),
  [OUTRO]: identidade("uid-b", "b@example.com"),
  [SEC]: identidade("uid-s", "s@example.com"),
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

type Body = OperacaoApiBody &
  SystemsApiBody & {
    pendencias?: { vendasReservadas: number; atendimentos: number };
    excluido?: boolean;
  };

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

async function rascunho(nome = `Sistema ${crypto.randomUUID().slice(0, 8)}`) {
  return (await call("POST", "/systems", ADMIN, { nome })).body.sistema!.id;
}

async function ativo(nome?: string) {
  const id = await rascunho(nome);
  const versao = (
    await call("POST", `/systems/${id}/versions`, ADMIN, {
      origem: "formulario",
      rascunho: DISTRIBUIDORA,
    })
  ).body.versao!;
  await call("POST", `/systems/${id}/versions/${versao.id}/approve`, ADMIN, { hash: versao.hash });
  expect((await call("POST", `/systems/${id}/activate`, ADMIN, { versao: versao.id })).status).toBe(
    200,
  );
  await env.DB.prepare(
    "INSERT INTO system_access (user_id, system_id, granted_by, created_at, updated_at) VALUES ('s', ?, 'a', ?, ?)",
  )
    .bind(id, NOW, NOW)
    .run();
  return id;
}

/** Venda em rascunho com estoque reservado (cliente, produto e entrada pela API real). */
async function vendaReservada(sistema: string) {
  const p = (x: string) => `/systems/${sistema}${x}`;
  const cliente = (await call("POST", p("/clientes"), ADMIN, { nome: "Bar do Zé" })).body.cliente!
    .id;
  const produto = (
    await call("POST", p("/produtos"), ADMIN, {
      nome: "Cerveja lata",
      varejoCentavos: 500,
      atacadoCentavos: 400,
      unidadesPorCaixa: 12,
    })
  ).body.produto!.id;
  await call("POST", p("/estoque/entradas"), ADMIN, {
    produto,
    caixas: 0,
    unidades: 10,
    motivo: "Compra do fornecedor",
  });
  const r = await call("POST", p("/vendas"), ADMIN, {
    cliente,
    itens: [{ produto, caixas: 0, unidades: 2 }],
  });
  expect(r.status).toBe(201);
  return r.body.venda!.id;
}

const listaDo = async (token: string) =>
  (await call("GET", "/systems", token)).body.sistemas!.map((s) => [s.id, s.status]);

beforeEach(async () => {
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at) VALUES
     ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T}),
     ('b', 'uid-b', 'b@example.com', 'admin', 'active', NULL, ${T}, ${T}),
     ('s', 'uid-s', 's@example.com', 'secondary', 'active', 'a', ${T}, ${T})`,
  ).run();
});

describe("inativar e reativar", () => {
  it("inativado some para quem opera, para de operar e volta ativo ao reativar", async () => {
    const id = await ativo();
    const r = await call("POST", `/systems/${id}/arquivar`, ADMIN, {});
    expect(r.status).toBe(200);
    expect(r.body.sistema!.status).toBe("archived");
    expect(await listaDo(SEC)).toEqual([]);
    expect((await call("GET", `/systems/${id}/app`, ADMIN)).status).toBe(409);
    const audit = await env.DB.prepare(
      "SELECT action FROM audit_events WHERE system_id = ? AND action LIKE 'system.%' ORDER BY id",
    )
      .bind(id)
      .all<{ action: string }>();
    expect(audit.results.map((a) => a.action)).toContain("system.archived");

    const volta = await call("POST", `/systems/${id}/reativar`, ADMIN, {});
    expect(volta.body.sistema!.status).toBe("active");
    expect(await listaDo(SEC)).toEqual([[id, "active"]]);
  });

  it("rascunho inativado volta como rascunho", async () => {
    const id = await rascunho();
    await call("POST", `/systems/${id}/arquivar`, ADMIN, {});
    const volta = await call("POST", `/systems/${id}/reativar`, ADMIN, {});
    expect(volta.body.sistema!.status).toBe("draft");
  });

  it("com venda reservada, não inativa e diz o que falta", async () => {
    const id = await ativo();
    await vendaReservada(id);
    const r = await call("POST", `/systems/${id}/arquivar`, ADMIN, {});
    expect(r.status).toBe(409);
    expect(r.body.error!.code).toBe("sistema_com_pendencias");
    expect(r.body.pendencias).toEqual({ vendasReservadas: 1, atendimentos: 0 });
    expect(r.body.error!.message).toMatch(/1 venda com estoque reservado/);
    expect((await call("GET", `/systems/${id}`, ADMIN)).body.sistema!.status).toBe("active");
  });

  it("só o administrador dono inativa; repetir não muda nada", async () => {
    const id = await ativo();
    expect((await call("POST", `/systems/${id}/arquivar`, SEC, {})).status).toBe(403);
    expect((await call("POST", `/systems/${id}/arquivar`, OUTRO, {})).status).toBe(404);
    await call("POST", `/systems/${id}/arquivar`, ADMIN, {});
    const de_novo = await call("POST", `/systems/${id}/arquivar`, ADMIN, {});
    expect(de_novo.status).toBe(200);
    expect(de_novo.body.sistema!.status).toBe("archived");
  });
});

describe("excluir", () => {
  it("rascunho excluído some de vez e libera o nome", async () => {
    const id = await rascunho("Loja Teste");
    const r = await call("POST", `/systems/${id}/excluir`, ADMIN, {});
    expect(r.status).toBe(200);
    expect(r.body.excluido).toBe(true);
    expect(await listaDo(ADMIN)).toEqual([]);
    expect((await call("GET", `/systems/${id}`, ADMIN)).status).toBe(404);
    expect((await call("POST", `/systems/${id}/reativar`, ADMIN, {})).status).toBe(404);
    expect((await call("POST", "/systems", ADMIN, { nome: "Loja Teste" })).status).toBe(201);
  });

  it("rascunho inativado também pode ser excluído", async () => {
    const id = await rascunho();
    await call("POST", `/systems/${id}/arquivar`, ADMIN, {});
    expect((await call("POST", `/systems/${id}/excluir`, ADMIN, {})).status).toBe(200);
  });

  it("sistema que já foi ativado não é excluído, nem inativado", async () => {
    const id = await ativo();
    const r = await call("POST", `/systems/${id}/excluir`, ADMIN, {});
    expect(r.status).toBe(409);
    expect(r.body.error!.code).toBe("sistema_ja_usado");
    await call("POST", `/systems/${id}/arquivar`, ADMIN, {});
    expect((await call("POST", `/systems/${id}/excluir`, ADMIN, {})).status).toBe(409);
  });

  it("o banco recusa excluir um sistema ativado, mesmo por fora da API", async () => {
    const id = await ativo();
    await expect(
      env.DB.prepare("UPDATE systems SET deleted_at = ? WHERE id = ?").bind(NOW, id).run(),
    ).rejects.toThrow(/exclusao_invalida/);
  });
});

describe("corridas com inativar e excluir (revisão do Codex)", () => {
  it("venda, reserva e agendamento que chegam depois de inativar são recusados pelo banco", async () => {
    const id = await ativo();
    await call("POST", `/systems/${id}/arquivar`, ADMIN, {});
    await expect(
      env.DB.prepare(
        // O gatilho roda antes das outras restrições: as colunas mínimas bastam.
        "INSERT INTO sales (id, system_id, customer_id, expires_at) VALUES ('v1', ?, 'c', ?)",
      )
        .bind(id, NOW + 1)
        .run(),
    ).rejects.toThrow(/sistema_inativo/);
    await expect(
      env.DB.prepare(
        `INSERT INTO appointments (id, system_id, customer_id, professional_id, service_type, start_at, end_at)
         VALUES ('a1', ?, 'c', 'p', 'tt', ?, ?)`,
      )
        .bind(id, NOW, NOW + 1)
        .run(),
    ).rejects.toThrow(/sistema_inativo/);
  });

  it("resposta da IA começada antes da exclusão não grava na conversa", async () => {
    const id = await rascunho();
    await env.DB.prepare("INSERT OR IGNORE INTO creation_state (system_id, revision) VALUES (?, 0)")
      .bind(id)
      .run();
    await call("POST", `/systems/${id}/excluir`, ADMIN, {});
    await expect(
      env.DB.prepare("UPDATE creation_state SET revision = revision + 1 WHERE system_id = ?")
        .bind(id)
        .run(),
    ).rejects.toThrow(/sistema_excluido/);
  });

  it("pedido de sistema excluído não muda de estado nem recebe comentário", async () => {
    const id = await rascunho();
    const pedido = (
      await call("POST", `/systems/${id}/pedidos`, ADMIN, {
        titulo: "Emitir nota fiscal",
        pedido: "Quero emitir nota fiscal.",
      })
    ).body as unknown as { pedido: { id: string } };
    await call("POST", `/systems/${id}/excluir`, ADMIN, {});
    const p = pedido.pedido.id;
    expect(
      (await call("POST", `/pedidos/${p}/estado`, ADMIN, { estado: "em_analise" })).status,
    ).toBe(404);
    expect((await call("POST", `/pedidos/${p}/comentarios`, ADMIN, { texto: "Oi" })).status).toBe(
      404,
    );
    const eventos = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM dev_request_events WHERE request_id = ?",
    )
      .bind(p)
      .first<{ n: number }>();
    expect(eventos?.n).toBe(1);
  });
});
