import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import c1 from "../../experiments/cenarios/c1-gabarito.json";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { fixedClock } from "../../src/worker/lib/clock";
import type { SystemsApiBody } from "../../src/shared/api";

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);

// Tokens fictícios → identidades; qualquer outro token é inválido.
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
const app = createApp({
  clock: fixedClock(NOW),
  auth: () => ({
    verify: (token) => {
      const identity = IDENTITIES[token];
      return identity ? Promise.resolve(identity) : Promise.reject(new InvalidTokenError("x"));
    },
    lookup: () => Promise.resolve({ validSince: null, disabled: false }),
  }),
});

async function call(method: string, path: string, token: string, body?: unknown, key?: string) {
  const response = await app(
    new Request(`https://app.test/api/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        // Toda criação exige Idempotency-Key (seção 19); por padrão uma nova a cada chamada.
        ...(method === "POST" ? { "idempotency-key": key ?? crypto.randomUUID() } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
  );
  return { status: response.status, body: await response.json<SystemsApiBody>() };
}
const ADMIN = "token-admin-000000000000";
const ADMIN2 = "token-admin2-00000000000";
const SEC = "token-sec-00000000000000";

beforeEach(async () => {
  const T = NOW - 1000;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM operation_requests"),
    env.DB.prepare("DELETE FROM approvals"),
    env.DB.prepare("DELETE FROM validation_runs"),
    env.DB.prepare("UPDATE systems SET active_version_id = NULL"),
    env.DB.prepare("DELETE FROM model_versions"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM system_access"),
    env.DB.prepare("DELETE FROM systems"),
    env.DB.prepare("DELETE FROM users WHERE owner_id IS NOT NULL"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare(
      `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at) VALUES
       ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T}),
       ('b', 'uid-b', 'b@example.com', 'admin', 'active', NULL, ${T}, ${T}),
       ('s', 'uid-s', 's@example.com', 'secondary', 'active', 'a', ${T}, ${T})`,
    ),
  ]);
});

async function systemWithValidVersion() {
  const created = await call("POST", "/systems", ADMIN, { nome: "Loja de Materiais" });
  const id = created.body.sistema!.id;
  const version = await call("POST", `/systems/${id}/versions`, ADMIN, {
    origem: "formulario",
    rascunho: c1,
  });
  return { id, version: version.body.versao! as { id: string; hash: string; status: string } };
}

describe("ciclo de configuração pela API", () => {
  it("cria, grava versão válida, aprova o hash exato e ativa (seção 8)", async () => {
    const { id, version } = await systemWithValidVersion();
    expect(version).toMatchObject({
      status: "valid",
      hash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
    });

    const approved = await call("POST", `/systems/${id}/versions/${version.id}/approve`, ADMIN, {
      hash: version.hash,
    });
    expect(approved.body.versao!.status).toBe("approved");

    const active = await call("POST", `/systems/${id}/activate`, ADMIN, { versao: version.id });
    expect(active.status).toBe(200);
    expect(active.body.sistema).toMatchObject({ status: "active", versaoAtiva: version.id });

    // Repetir a ativação não duplica efeitos (T10).
    const again = await call("POST", `/systems/${id}/activate`, ADMIN, { versao: version.id });
    const audits = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'system.activated'",
    ).first<{ n: number }>();
    expect(again.status).toBe(200);
    expect(audits?.n).toBe(1);
  });

  it("o mesmo rascunho gera o mesmo hash, e versões são numeradas em sequência", async () => {
    const { id, version } = await systemWithValidVersion();
    const second = await call("POST", `/systems/${id}/versions`, ADMIN, {
      origem: "chat",
      rascunho: structuredClone(c1),
    });

    expect(second.body.versao!.hash).toBe(version.hash);
    expect(second.body.versao!.versao).toBe(2);
  });

  it("recusa aprovação com hash diferente e ativação sem aprovação (T06, T07)", async () => {
    const { id, version } = await systemWithValidVersion();

    const wrong = await call("POST", `/systems/${id}/versions/${version.id}/approve`, ADMIN, {
      hash: "0".repeat(64),
    });
    expect(wrong).toMatchObject({ status: 409, body: { error: { code: "aprovacao_invalida" } } });

    const notApproved = await call("POST", `/systems/${id}/activate`, ADMIN, {
      versao: version.id,
    });
    expect(notApproved).toMatchObject({
      status: 409,
      body: { error: { code: "versao_nao_aprovada" } },
    });
  });

  it("guarda versão com bloqueios como inválida e não deixa aprovar (T07)", async () => {
    const created = await call("POST", "/systems", ADMIN, { nome: "X" });
    const id = created.body.sistema!.id;
    const draft = { ...c1, regras: c1.regras.filter((r) => r.tipo !== "prazo_reserva") };

    const version = await call("POST", `/systems/${id}/versions`, ADMIN, {
      origem: "chat",
      rascunho: draft,
    });
    expect(version.body.versao!.status).toBe("invalid");
    expect(version.body.issues!.map((i) => i.code)).toContain("parametro_obrigatorio_ausente");

    const approve = await call(
      "POST",
      `/systems/${id}/versions/${version.body.versao!.id}/approve`,
      ADMIN,
      {
        hash: version.body.versao!.hash,
      },
    );
    expect(approve.status).toBe(409);
  });

  it("estrutura inválida não vira versão (422 com diagnóstico)", async () => {
    const created = await call("POST", "/systems", ADMIN, { nome: "X" });
    const result = await call("POST", `/systems/${created.body.sistema!.id}/versions`, ADMIN, {
      origem: "chat",
      rascunho: { modelo: "padaria" },
    });

    expect(result.status).toBe(422);
    expect(result.body.versao).toBeNull();
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM model_versions").first<{
      n: number;
    }>();
    expect(count?.n).toBe(0);
  });

  it("bloqueia nova versão em sistema ativo (personalização pós-ativação é P2)", async () => {
    const { id, version } = await systemWithValidVersion();
    await call("POST", `/systems/${id}/versions/${version.id}/approve`, ADMIN, {
      hash: version.hash,
    });
    await call("POST", `/systems/${id}/activate`, ADMIN, { versao: version.id });

    const next = await call("POST", `/systems/${id}/versions`, ADMIN, {
      origem: "chat",
      rascunho: c1,
    });
    expect(next.body.error!.code).toBe("personalizacao_pos_ativacao_indisponivel");
  });
});

describe("permissões e isolamento (T01, T02, T04)", () => {
  it("token inválido não acessa; secundário não cria sistema nem configura", async () => {
    expect((await call("GET", "/systems", "token-qualquer-000000000")).status).toBe(401);
    expect((await call("POST", "/systems", SEC, { nome: "X" })).status).toBe(403);
  });

  it("outro administrador não vê nem configura o sistema (404)", async () => {
    const { id, version } = await systemWithValidVersion();

    expect((await call("GET", `/systems/${id}`, ADMIN2)).status).toBe(404);
    expect((await call("GET", "/systems", ADMIN2)).body.sistemas).toEqual([]);
    const approve = await call("POST", `/systems/${id}/versions/${version.id}/approve`, ADMIN2, {
      hash: version.hash,
    });
    expect(approve.status).toBe(404);
  });

  it("secundário só lista sistemas vinculados e não vê o histórico de versões", async () => {
    const { id } = await systemWithValidVersion();
    expect((await call("GET", "/systems", SEC)).body.sistemas).toEqual([]);

    await env.DB.prepare(
      "INSERT INTO system_access (user_id, system_id, granted_by, created_at, updated_at) VALUES ('s', ?, 'a', ?, ?)",
    )
      .bind(id, NOW, NOW)
      .run();
    const list = await call("GET", "/systems", SEC);
    const detail = await call("GET", `/systems/${id}`, SEC);

    expect(list.body.sistemas!.map((s) => s.id)).toEqual([id]);
    expect(detail.body.versoes).toEqual([]);
  });

  it("valida corpo e tipo de conteúdo", async () => {
    const response = await app(
      new Request("https://app.test/api/v1/systems", {
        method: "POST",
        headers: { authorization: `Bearer ${ADMIN}`, "content-type": "text/plain" },
        body: "nome=x",
      }),
      env,
    );
    expect(response.status).toBe(415);
    expect((await call("POST", "/systems", ADMIN, { nome: "" })).status).toBe(422);
  });
});

describe("idempotência e concorrência (seção 19, T10, T31)", () => {
  async function count(sql: string): Promise<number> {
    return (await env.DB.prepare(sql).first<{ n: number }>())?.n ?? -1;
  }

  it("mesma chave e mesmo conteúdo devolvem o mesmo sistema; outro conteúdo é conflito", async () => {
    const first = await call("POST", "/systems", ADMIN, { nome: "Loja" }, "chave-criacao-1");
    const again = await call("POST", "/systems", ADMIN, { nome: "Loja" }, "chave-criacao-1");
    const other = await call("POST", "/systems", ADMIN, { nome: "Outra" }, "chave-criacao-1");

    expect(again).toMatchObject({ status: 201, body: { sistema: { id: first.body.sistema!.id } } });
    expect(other.body.error!.code).toBe("chave_idempotencia_reutilizada");
    expect(await count("SELECT COUNT(*) AS n FROM systems")).toBe(1);
  });

  it("exige Idempotency-Key válida nas criações", async () => {
    const response = await app(
      new Request("https://app.test/api/v1/systems", {
        method: "POST",
        headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
        body: JSON.stringify({ nome: "X" }),
      }),
      env,
    );
    expect(response.status).toBe(422);
  });

  it("criações simultâneas com a mesma chave geram um único sistema", async () => {
    const results = await Promise.all(
      [1, 2, 3].map(() => call("POST", "/systems", ADMIN, { nome: "Loja" }, "chave-corrida-1")),
    );

    expect(new Set(results.map((r) => r.body.sistema?.id)).size).toBe(1);
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(await count("SELECT COUNT(*) AS n FROM systems")).toBe(1);
  });

  it("versão repetida com a mesma chave não cria outra versão", async () => {
    const created = await call("POST", "/systems", ADMIN, { nome: "X" });
    const id = created.body.sistema!.id;
    const body = { origem: "formulario", rascunho: c1 };
    const a = await call("POST", `/systems/${id}/versions`, ADMIN, body, "chave-versao-1");
    const b = await call("POST", `/systems/${id}/versions`, ADMIN, body, "chave-versao-1");

    expect(b.body.versao!.id).toBe(a.body.versao!.id);
    expect(b.body.issues).toEqual(a.body.issues);
    expect(await count("SELECT COUNT(*) AS n FROM model_versions")).toBe(1);
  });

  it("aprovações idênticas simultâneas: todas 200, uma aprovação e uma auditoria", async () => {
    const { id, version } = await systemWithValidVersion();
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        call("POST", `/systems/${id}/versions/${version.id}/approve`, ADMIN, {
          hash: version.hash,
        }),
      ),
    );

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await count("SELECT COUNT(*) AS n FROM approvals")).toBe(1);
    expect(
      await count("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'version.approved'"),
    ).toBe(1);
  });

  it("ativações simultâneas de versões diferentes: uma vence, a outra é conflito e não audita", async () => {
    const { id, version: v1 } = await systemWithValidVersion();
    const v2 = (
      await call("POST", `/systems/${id}/versions`, ADMIN, {
        origem: "chat",
        rascunho: { ...c1, aparencia: { ...c1.aparencia, titulo: "Outro título" } },
      })
    ).body.versao!;
    for (const v of [v1, v2]) {
      await call("POST", `/systems/${id}/versions/${v.id}/approve`, ADMIN, { hash: v.hash });
    }

    const results = await Promise.all([
      call("POST", `/systems/${id}/activate`, ADMIN, { versao: v1.id }),
      call("POST", `/systems/${id}/activate`, ADMIN, { versao: v2.id }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await count("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'system.activated'"),
    ).toBe(1);
  });

  it("status aprovado sem registro de aprovação não ativa; transição inválida é recusada", async () => {
    const { id, version } = await systemWithValidVersion();
    await env.DB.prepare("UPDATE model_versions SET status = 'approved' WHERE id = ?")
      .bind(version.id)
      .run();

    const activate = await call("POST", `/systems/${id}/activate`, ADMIN, { versao: version.id });
    expect(activate.body.error!.code).toBe("versao_nao_aprovada");

    const invalid = await call("POST", `/systems/${id}/versions`, ADMIN, {
      origem: "chat",
      rascunho: { ...c1, regras: [] },
    });
    await expect(
      env.DB.prepare("UPDATE model_versions SET status = 'approved' WHERE id = ?")
        .bind(invalid.body.versao!.id)
        .run(),
    ).rejects.toThrow(/transicao_de_status_invalida/);
  });
});
