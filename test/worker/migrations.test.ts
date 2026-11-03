import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

const T = Date.UTC(2026, 10, 4);

async function insertUser(id: string, role: "admin" | "secondary", ownerId: string | null) {
  await env.DB.prepare(
    "INSERT INTO users (id, email, role, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, `${id}@example.com`, role, ownerId, T, T)
    .run();
}

describe("migration 0001", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM operation_requests"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM system_access"),
      env.DB.prepare("DELETE FROM systems"),
      env.DB.prepare("DELETE FROM users WHERE owner_id IS NOT NULL"),
      env.DB.prepare("DELETE FROM users"),
    ]);
    await insertUser("admin1", "admin", null);
  });

  it("aplica integridade referencial (autor inexistente é recusado pela chave estrangeira)", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO audit_events (actor_id, action, created_at) VALUES ('ninguem', 'teste', ?)",
      )
        .bind(T)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/i);
    // Em systems, o trigger de dono administrador barra antes, com mensagem própria.
    await expect(
      env.DB.prepare(
        "INSERT INTO systems (id, owner_id, name, created_at, updated_at) VALUES ('s1', 'ninguem', 'X', ?, ?)",
      )
        .bind(T, T)
        .run(),
    ).rejects.toThrow(/dono_nao_e_administrador/);
  });

  it("exige dono para conta secundária e recusa papel ou status fora da lista", async () => {
    await expect(insertUser("sec1", "secondary", null)).rejects.toThrow(/CHECK/i);
    await expect(
      env.DB.prepare(
        "INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('x', 'x@example.com', 'root', ?, ?)",
      )
        .bind(T, T)
        .run(),
    ).rejects.toThrow(/CHECK/i);
    await insertUser("sec2", "secondary", "admin1");
    await expect(
      env.DB.prepare("UPDATE users SET status = 'banido' WHERE id = 'sec2'").run(),
    ).rejects.toThrow(/CHECK/i);
  });

  it("trata o e-mail como único sem diferenciar maiúsculas", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('a2', 'ADMIN1@example.com', 'admin', ?, ?)",
      )
        .bind(T, T)
        .run(),
    ).rejects.toThrow(/UNIQUE/i);
  });

  it("impede vínculo duplicado e chave de idempotência repetida no mesmo escopo", async () => {
    await insertUser("sec3", "secondary", "admin1");
    await env.DB.prepare(
      "INSERT INTO systems (id, owner_id, name, created_at, updated_at) VALUES ('s1', 'admin1', 'Loja', ?, ?)",
    )
      .bind(T, T)
      .run();
    const grant = env.DB.prepare(
      "INSERT INTO system_access (user_id, system_id, granted_by, created_at, updated_at) VALUES ('sec3', 's1', 'admin1', ?, ?)",
    ).bind(T, T);
    await grant.run();
    await expect(grant.run()).rejects.toThrow(/UNIQUE|PRIMARY KEY/i);

    const op = env.DB.prepare(
      "INSERT INTO operation_requests (scope, actor_id, command, idempotency_key, request_hash, status_code, response_json, created_at) VALUES ('s1', 'admin1', 'sale.complete', 'chave-123456', 'h1', 200, '{}', ?)",
    ).bind(T);
    await op.run();
    await expect(op.run()).rejects.toThrow(/UNIQUE|PRIMARY KEY/i);
  });

  it("recusa JSON inválido na auditoria", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO audit_events (actor_id, action, details_json, created_at) VALUES ('admin1', 'teste', 'não é json', ?)",
      )
        .bind(T)
        .run(),
    ).rejects.toThrow(/CHECK/i);
  });

  it("recusa id nulo e instante fora da convenção (inteiro em ms)", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO users (id, email, role, created_at, updated_at) VALUES (NULL, 'n@example.com', 'admin', ?, ?)",
      )
        .bind(T, T)
        .run(),
    ).rejects.toThrow(/NOT NULL/i);
    await expect(
      env.DB.prepare(
        "INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('t1', 't@example.com', 'admin', 'amanha', -1)",
      ).run(),
    ).rejects.toThrow(/CHECK/i);
  });

  it("não aceita secundária como dona de conta ou de sistema", async () => {
    await insertUser("sec1", "secondary", "admin1");

    await expect(insertUser("sec_de_sec", "secondary", "sec1")).rejects.toThrow(
      /dono_nao_e_administrador/,
    );
    await expect(
      env.DB.prepare(
        "INSERT INTO systems (id, owner_id, name, created_at, updated_at) VALUES ('s9', 'sec1', 'X', ?, ?)",
      )
        .bind(T, T)
        .run(),
    ).rejects.toThrow(/dono_nao_e_administrador/);
  });

  it("só vincula secundária do próprio administrador, concedida pelo dono do sistema", async () => {
    await insertUser("admin2", "admin", null);
    await insertUser("sec1", "secondary", "admin1");
    await env.DB.prepare(
      "INSERT INTO systems (id, owner_id, name, created_at, updated_at) VALUES ('s1', 'admin1', 'A', ?, ?), ('s2', 'admin2', 'B', ?, ?)",
    )
      .bind(T, T, T, T)
      .run();
    const grant = (user: string, system: string, by: string) =>
      env.DB.prepare(
        "INSERT INTO system_access (user_id, system_id, granted_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind(user, system, by, T, T)
        .run();

    await expect(grant("sec1", "s2", "admin2")).rejects.toThrow(/acesso_incoerente/);
    await expect(grant("sec1", "s1", "sec1")).rejects.toThrow(/acesso_incoerente/);
    await expect(grant("admin2", "s1", "admin1")).rejects.toThrow(/acesso_incoerente/);
    await expect(grant("sec1", "s1", "admin1")).resolves.toBeTruthy();

    // Depois do vínculo, trocar o dono da conta ou do sistema é recusado (não fica incoerente).
    await expect(
      env.DB.prepare("UPDATE users SET owner_id = 'admin2' WHERE id = 'sec1'").run(),
    ).rejects.toThrow(/papel_e_dono_imutaveis/);
    await expect(
      env.DB.prepare("UPDATE users SET role = 'admin', owner_id = NULL WHERE id = 'sec1'").run(),
    ).rejects.toThrow(/papel_e_dono_imutaveis/);
    await expect(
      env.DB.prepare("UPDATE systems SET owner_id = 'sec1' WHERE id = 's1'").run(),
    ).rejects.toThrow(/dono_do_sistema_imutavel/);
  });
});
