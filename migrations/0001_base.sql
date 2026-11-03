-- Migration 0001 — identidade, sistemas, acessos, auditoria e idempotência (seção 18).
-- Convenções: ids TEXT NOT NULL (UUID gerado no Worker); instantes em INTEGER (ms desde 1970,
-- UTC), impostos por CHECK; status com CHECK; nenhuma senha é guardada (Firebase Auth).
-- Nunca editar esta migration depois de aplicada: mudanças vão em migrations novas.

CREATE TABLE users (
  id TEXT NOT NULL PRIMARY KEY,
  -- Preenchido no primeiro login validado; NULL enquanto o convite está pendente.
  firebase_uid TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 320),
  display_name TEXT CHECK (display_name IS NULL OR length(display_name) <= 120),
  role TEXT NOT NULL CHECK (role IN ('admin', 'secondary')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  -- Administrador que criou a conta secundária; o primeiro administrador não tem.
  owner_id TEXT REFERENCES users (id),
  -- tokensValidAfterTime do Firebase (ms): sessões com auth_time anterior são recusadas.
  valid_since INTEGER CHECK (valid_since IS NULL OR (typeof(valid_since) = 'integer' AND valid_since > 0)),
  -- Última consulta do validSince no Firebase (ms); a sessão reconsulta quando fica velha.
  valid_since_checked_at INTEGER CHECK (valid_since_checked_at IS NULL OR valid_since_checked_at > 0),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  -- Administrador não tem dono; secundário sempre tem.
  CHECK ((role = 'admin' AND owner_id IS NULL) OR (role = 'secondary' AND owner_id IS NOT NULL))
);

CREATE INDEX users_owner ON users (owner_id);

-- O dono de uma conta secundária precisa ser administrador (não há secundária de secundária).
CREATE TRIGGER users_owner_is_admin_insert
BEFORE INSERT ON users
WHEN NEW.owner_id IS NOT NULL
  AND (SELECT role FROM users WHERE id = NEW.owner_id) IS NOT 'admin'
BEGIN
  SELECT RAISE(ABORT, 'dono_nao_e_administrador');
END;

-- Papel e dono não mudam depois de criados: mudar quebraria a coerência dos vínculos já
-- concedidos (system_access) e a autoria. Trocar de administrador = nova conta.
CREATE TRIGGER users_role_owner_immutable
BEFORE UPDATE OF owner_id, role ON users
WHEN NEW.owner_id IS NOT OLD.owner_id OR NEW.role IS NOT OLD.role
BEGIN
  SELECT RAISE(ABORT, 'papel_e_dono_imutaveis');
END;

CREATE TABLE systems (
  id TEXT NOT NULL PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users (id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at)
);

CREATE INDEX systems_owner ON systems (owner_id, status);

CREATE TRIGGER systems_owner_is_admin
BEFORE INSERT ON systems
WHEN (SELECT role FROM users WHERE id = NEW.owner_id) IS NOT 'admin'
BEGIN
  SELECT RAISE(ABORT, 'dono_nao_e_administrador');
END;

CREATE TRIGGER systems_owner_immutable
BEFORE UPDATE OF owner_id ON systems
WHEN NEW.owner_id IS NOT OLD.owner_id
BEGIN
  SELECT RAISE(ABORT, 'dono_do_sistema_imutavel');
END;

-- Vínculo de conta secundária a um sistema (permissão inicial por sistema, seção 7).
CREATE TABLE system_access (
  user_id TEXT NOT NULL REFERENCES users (id),
  system_id TEXT NOT NULL REFERENCES systems (id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  PRIMARY KEY (user_id, system_id)
);

CREATE INDEX system_access_system ON system_access (system_id, status);
CREATE INDEX system_access_granted_by ON system_access (granted_by);

-- Só a conta secundária do próprio administrador recebe acesso, e quem concede é o dono do sistema.
CREATE TRIGGER system_access_coherent_insert
BEFORE INSERT ON system_access
WHEN NOT EXISTS (
  SELECT 1 FROM users u JOIN systems s ON s.id = NEW.system_id
  WHERE u.id = NEW.user_id AND u.role = 'secondary'
    AND u.owner_id = s.owner_id AND NEW.granted_by = s.owner_id
)
BEGIN
  SELECT RAISE(ABORT, 'acesso_incoerente');
END;

CREATE TRIGGER system_access_coherent_update
BEFORE UPDATE OF user_id, system_id, granted_by ON system_access
WHEN NOT EXISTS (
  SELECT 1 FROM users u JOIN systems s ON s.id = NEW.system_id
  WHERE u.id = NEW.user_id AND u.role = 'secondary'
    AND u.owner_id = s.owner_id AND NEW.granted_by = s.owner_id
)
BEGIN
  SELECT RAISE(ABORT, 'acesso_incoerente');
END;

-- Efeitos relevantes, com autoria preservada mesmo após desativação da conta.
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  system_id TEXT REFERENCES systems (id),
  actor_id TEXT REFERENCES users (id),
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  target_type TEXT,
  target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0)
);

CREATE INDEX audit_events_system ON audit_events (system_id, created_at);
CREATE INDEX audit_events_actor ON audit_events (actor_id, created_at);

-- Idempotência por escopo (sistema ou 'global') + ator + comando + chave (seção 19).
-- Repetir o mesmo pedido devolve a resposta guardada; mesma chave com outro hash = conflito.
CREATE TABLE operation_requests (
  scope TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users (id),
  command TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 100),
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL CHECK (status_code BETWEEN 100 AND 599),
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  PRIMARY KEY (scope, actor_id, command, idempotency_key)
);

CREATE INDEX operation_requests_actor ON operation_requests (actor_id);
