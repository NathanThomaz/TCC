-- Migration 0001 — identidade, sistemas, acessos, auditoria e idempotência (seção 18).
-- Convenções: ids TEXT (UUID gerado no Worker); instantes em INTEGER (ms desde 1970, UTC),
-- comparáveis sem conversão; status com CHECK; nenhuma senha é guardada (Firebase Auth).
-- Nunca editar esta migration depois de aplicada: mudanças vão em migrations novas.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  -- Preenchido no primeiro login validado; NULL enquanto o convite está pendente.
  firebase_uid TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 320),
  display_name TEXT CHECK (display_name IS NULL OR length(display_name) <= 120),
  role TEXT NOT NULL CHECK (role IN ('admin', 'secondary')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  -- Administrador que criou a conta secundária; o primeiro administrador não tem.
  owner_id TEXT REFERENCES users (id),
  -- tokensValidAfterTime do Firebase (ms): tokens emitidos antes disso são recusados (ADR-001, item 6).
  valid_since INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (role = 'admin' OR owner_id IS NOT NULL),
  CHECK (owner_id IS NULL OR owner_id <> id)
);

CREATE TABLE systems (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users (id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX systems_owner ON systems (owner_id, status);

-- Vínculo de conta secundária a um sistema (permissão inicial por sistema, seção 7).
CREATE TABLE system_access (
  user_id TEXT NOT NULL REFERENCES users (id),
  system_id TEXT NOT NULL REFERENCES systems (id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, system_id)
);

CREATE INDEX system_access_system ON system_access (system_id, status);

-- Efeitos relevantes, com autoria preservada mesmo após desativação da conta.
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  system_id TEXT REFERENCES systems (id),
  actor_id TEXT REFERENCES users (id),
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  target_type TEXT,
  target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at INTEGER NOT NULL
);

CREATE INDEX audit_events_system ON audit_events (system_id, created_at);

-- Idempotência por escopo (sistema ou 'global') + ator + comando + chave (seção 19).
-- Repetir o mesmo pedido devolve a resposta guardada; mesma chave com outro hash = conflito.
CREATE TABLE operation_requests (
  scope TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users (id),
  command TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 100),
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (scope, actor_id, command, idempotency_key)
);
