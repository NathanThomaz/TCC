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

  it("aplica integridade referencial (sistema de dono inexistente é recusado)", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO systems (id, owner_id, name, created_at, updated_at) VALUES ('s1', 'ninguem', 'X', ?, ?)",
      )
        .bind(T, T)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/i);
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
});
