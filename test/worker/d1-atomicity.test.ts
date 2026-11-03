import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  PROVA_SCHEMA,
  appointmentInsert,
  reservationInsert,
} from "../../provas/d1-atomicidade/src/schema";

// Prova do mecanismo da ADR-001, item 5, no D1 local (Miniflare). A mesma prova roda no D1
// remoto por `provas/d1-atomicidade` e o resultado fica registrado no README de lá.
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);
const HOUR = 3_600_000;

async function count(sql: string): Promise<number> {
  const row = await env.DB.prepare(sql).first<{ n: number }>();
  return row?.n ?? -1;
}

describe("atomicidade de db.batch() com triggers RAISE(ABORT)", () => {
  beforeAll(async () => {
    await env.DB.batch(PROVA_SCHEMA.map((sql) => env.DB.prepare(sql)));
  });

  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM prova_reservations"),
      env.DB.prepare("DELETE FROM prova_appointments"),
      env.DB.prepare("DELETE FROM prova_stock"),
      env.DB.prepare(
        "INSERT INTO prova_stock (product_id, physical) VALUES ('cerveja', 30), ('chope', 5)",
      ),
    ]);
  });

  it("desfaz o lote inteiro quando o segundo item não tem saldo (RES-02, T18)", async () => {
    await expect(
      env.DB.batch([
        reservationInsert(env.DB, { id: "r1", product: "cerveja", qty: 10, now: NOW }),
        reservationInsert(env.DB, { id: "r2", product: "chope", qty: 6, now: NOW }),
      ]),
    ).rejects.toThrow(/estoque_insuficiente/);

    expect(await count("SELECT COUNT(*) AS n FROM prova_reservations")).toBe(0);
  });

  it("contraste: fora de um batch, o ABORT desfaz só a instrução e a primeira escrita fica", async () => {
    await reservationInsert(env.DB, { id: "r1", product: "cerveja", qty: 10, now: NOW }).run();
    await expect(
      reservationInsert(env.DB, { id: "r2", product: "chope", qty: 6, now: NOW }).run(),
    ).rejects.toThrow(/estoque_insuficiente/);

    expect(await count("SELECT COUNT(*) AS n FROM prova_reservations")).toBe(1);
  });

  it("calcula o disponível como físico menos reservas ativas não vencidas (EST-05, T17)", async () => {
    await env.DB.batch([
      reservationInsert(env.DB, { id: "r1", product: "cerveja", qty: 20, now: NOW }),
    ]);

    await expect(
      env.DB.batch([
        reservationInsert(env.DB, { id: "r2", product: "cerveja", qty: 11, now: NOW + 1000 }),
      ]),
    ).rejects.toThrow(/estoque_insuficiente/);
    await env.DB.batch([
      reservationInsert(env.DB, { id: "r3", product: "cerveja", qty: 10, now: NOW + 1000 }),
    ]);

    // 30 minutos depois, r1 venceu e libera saldo sem nenhuma tarefa de expiração (RES-05).
    await env.DB.batch([
      reservationInsert(env.DB, { id: "r4", product: "cerveja", qty: 20, now: NOW + 31 * 60_000 }),
    ]);
    expect(await count("SELECT COUNT(*) AS n FROM prova_reservations")).toBe(3);
  });

  it("não grava a instalação quando a retirada do par conflita (AGE-05, T25)", async () => {
    await env.DB.batch([
      appointmentInsert(env.DB, { id: "a0", tech: "t1", start: NOW + 3 * HOUR, hours: 1 }),
    ]);

    await expect(
      env.DB.batch([
        appointmentInsert(env.DB, { id: "inst", tech: "t1", start: NOW + 2 * HOUR, hours: 1 }),
        // Retirada começa no fim da instalação e cai em cima de a0.
        appointmentInsert(env.DB, { id: "ret", tech: "t1", start: NOW + 3 * HOUR, hours: 1 }),
      ]),
    ).rejects.toThrow(/conflito_agenda/);
    expect(await count("SELECT COUNT(*) AS n FROM prova_appointments")).toBe(1);

    // Horários consecutivos são permitidos ([início, fim)).
    await env.DB.batch([
      appointmentInsert(env.DB, { id: "inst2", tech: "t1", start: NOW + HOUR, hours: 1 }),
      appointmentInsert(env.DB, { id: "ret2", tech: "t1", start: NOW + 2 * HOUR, hours: 1 }),
    ]);
    expect(await count("SELECT COUNT(*) AS n FROM prova_appointments")).toBe(3);
  });
});
