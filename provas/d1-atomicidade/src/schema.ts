// Esquema mínimo da prova técnica do D1 (ADR-001, item 5). Não é o esquema do produto:
// só reproduz os dois invariantes críticos — saldo de reserva e sobreposição de agenda —
// para verificar se uma falha de trigger dentro de db.batch() desfaz o lote inteiro.

export const RESERVATION_MINUTES = 30;

export const PROVA_SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS prova_stock (
     product_id TEXT PRIMARY KEY,
     physical INTEGER NOT NULL CHECK (physical >= 0)
   )`,
  `CREATE TABLE IF NOT EXISTS prova_reservations (
     id TEXT PRIMARY KEY,
     product_id TEXT NOT NULL REFERENCES prova_stock (product_id),
     qty INTEGER NOT NULL CHECK (qty > 0),
     status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released')),
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
   )`,
  // O instante de referência é o created_at enviado pelo backend (relógio do servidor).
  `CREATE TRIGGER IF NOT EXISTS prova_reservations_saldo
   BEFORE INSERT ON prova_reservations
   WHEN NEW.status = 'active' AND
     (SELECT physical FROM prova_stock WHERE product_id = NEW.product_id)
     - (SELECT COALESCE(SUM(qty), 0) FROM prova_reservations
        WHERE product_id = NEW.product_id AND status = 'active' AND expires_at > NEW.created_at)
     < NEW.qty
   BEGIN
     SELECT RAISE(ABORT, 'estoque_insuficiente');
   END`,
  `CREATE TABLE IF NOT EXISTS prova_appointments (
     id TEXT PRIMARY KEY,
     tech_id TEXT NOT NULL,
     start_at INTEGER NOT NULL,
     end_at INTEGER NOT NULL CHECK (end_at > start_at),
     status TEXT NOT NULL DEFAULT 'scheduled'
       CHECK (status IN ('scheduled', 'in_progress', 'done', 'cancelled'))
   )`,
  // Intervalos [início, fim): consecutivos não conflitam.
  `CREATE TRIGGER IF NOT EXISTS prova_appointments_sobreposicao
   BEFORE INSERT ON prova_appointments
   WHEN EXISTS (
     SELECT 1 FROM prova_appointments
     WHERE tech_id = NEW.tech_id AND status IN ('scheduled', 'in_progress')
       AND start_at < NEW.end_at AND end_at > NEW.start_at
   )
   BEGIN
     SELECT RAISE(ABORT, 'conflito_agenda');
   END`,
];

export function reservationInsert(
  db: D1Database,
  r: { id: string; product: string; qty: number; now: number },
): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO prova_reservations (id, product_id, qty, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(r.id, r.product, r.qty, r.now, r.now + RESERVATION_MINUTES * 60_000);
}

export function appointmentInsert(
  db: D1Database,
  a: { id: string; tech: string; start: number; hours: number },
): D1PreparedStatement {
  return db
    .prepare("INSERT INTO prova_appointments (id, tech_id, start_at, end_at) VALUES (?, ?, ?, ?)")
    .bind(a.id, a.tech, a.start, a.start + a.hours * 3_600_000);
}
