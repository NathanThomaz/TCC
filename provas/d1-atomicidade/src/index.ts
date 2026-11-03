import { PROVA_SCHEMA, appointmentInsert, reservationInsert } from "./schema";

// Worker temporário da prova no D1 remoto. Publicado só durante a prova, protegido por
// token aleatório (segredo PROVA_TOKEN) e removido em seguida; não guarda dados reais.
interface Env {
  DB: D1Database;
  PROVA_TOKEN: string;
}

const HOUR = 3_600_000;

function reply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function count(db: D1Database, table: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? -1;
}

async function attempt(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
    return "ok";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function reset(db: D1Database): Promise<void> {
  await db.batch(PROVA_SCHEMA.map((sql) => db.prepare(sql)));
  await db.batch([
    db.prepare("DELETE FROM prova_reservations"),
    db.prepare("DELETE FROM prova_appointments"),
    db.prepare("DELETE FROM prova_stock"),
    db.prepare(
      "INSERT INTO prova_stock (product_id, physical) VALUES ('cerveja', 30), ('chope', 5)",
    ),
  ]);
}

/** Cenários sequenciais: lote desfeito, contraste fora do lote e par de agenda. */
async function sequential(db: D1Database) {
  const now = Date.now();
  await reset(db);
  const batchError = await attempt(() =>
    db.batch([
      reservationInsert(db, { id: "r1", product: "cerveja", qty: 10, now }),
      reservationInsert(db, { id: "r2", product: "chope", qty: 6, now }),
    ]),
  );
  const afterBatch = await count(db, "prova_reservations");

  const outsideError = await attempt(async () => {
    await reservationInsert(db, { id: "r3", product: "cerveja", qty: 10, now }).run();
    await reservationInsert(db, { id: "r4", product: "chope", qty: 6, now }).run();
  });
  const afterOutside = await count(db, "prova_reservations");

  await db.batch([
    appointmentInsert(db, { id: "a0", tech: "t1", start: now + 3 * HOUR, hours: 1 }),
  ]);
  const pairError = await attempt(() =>
    db.batch([
      appointmentInsert(db, { id: "inst", tech: "t1", start: now + 2 * HOUR, hours: 1 }),
      appointmentInsert(db, { id: "ret", tech: "t1", start: now + 3 * HOUR, hours: 1 }),
    ]),
  );
  const afterPair = await count(db, "prova_appointments");

  return {
    loteComFalha: { erro: batchError, reservasGravadas: afterBatch, esperado: 0 },
    foraDoLote: { erro: outsideError, reservasGravadas: afterOutside, esperado: 1 },
    parDeAgenda: { erro: pairError, agendamentos: afterPair, esperado: 1 },
  };
}

export default {
  async fetch(request, env) {
    if (!env.PROVA_TOKEN || request.headers.get("x-prova-token") !== env.PROVA_TOKEN) {
      return reply({ erro: "nao_autorizado" }, 401);
    }
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/sequencial") {
      return reply(await sequential(env.DB));
    }
    if (request.method === "POST" && url.pathname === "/reset") {
      await reset(env.DB);
      return reply({ ok: true });
    }
    // Uma reserva de 2 unidades por requisição; o cliente dispara várias ao mesmo tempo.
    if (request.method === "POST" && url.pathname === "/reservar") {
      const id = crypto.randomUUID();
      const erro = await attempt(() =>
        env.DB.batch([
          reservationInsert(env.DB, { id, product: "cerveja", qty: 2, now: Date.now() }),
        ]),
      );
      return reply({ ok: erro === "ok", erro });
    }
    if (request.method === "GET" && url.pathname === "/estado") {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS reservas, COALESCE(SUM(qty), 0) AS unidades FROM prova_reservations WHERE status = 'active'",
      ).first<{ reservas: number; unidades: number }>();
      return reply(row);
    }
    return reply({ erro: "nao_encontrado" }, 404);
  },
} satisfies ExportedHandler<Env>;
