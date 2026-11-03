-- Migration 0002 — versões de configuração, validações, aprovações e versão ativa (seções 8 e 17).
-- Uma versão é imutável depois de gravada; aprovar e ativar apontam para a versão exata (hash).

CREATE TABLE model_versions (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  version INTEGER NOT NULL CHECK (typeof(version) = 'integer' AND version >= 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  catalog_version TEXT NOT NULL,
  -- Rascunho validado estruturalmente (ConfigDraft), em JSON canônico.
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  -- SHA-256 hex do JSON canônico: é o que a aprovação e a ativação conferem.
  hash TEXT NOT NULL CHECK (length(hash) = 64 AND hash NOT GLOB '*[^0-9a-f]*'),
  origin TEXT NOT NULL CHECK (origin IN ('formulario', 'chat')),
  -- valid = sem erro bloqueante; invalid = guardada para mostrar diagnóstico, não aprovável.
  status TEXT NOT NULL CHECK (status IN ('valid', 'invalid', 'approved', 'superseded')),
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  UNIQUE (system_id, version),
  -- Permite chave estrangeira composta (system_id, id) em outras tabelas.
  UNIQUE (system_id, id)
);

-- Conteúdo, hash e autoria não mudam depois de gravados.
CREATE TRIGGER model_versions_immutable
BEFORE UPDATE OF system_id, version, schema_version, catalog_version, config_json, hash, origin, created_by, created_at
ON model_versions
BEGIN
  SELECT RAISE(ABORT, 'versao_imutavel');
END;

-- Transições de status permitidas: valid -> approved | superseded; approved -> superseded.
-- invalid é terminal (corrigir = nova versão).
CREATE TRIGGER model_versions_status_transition
BEFORE UPDATE OF status ON model_versions
WHEN NEW.status IS NOT OLD.status AND NOT (
  (OLD.status = 'valid' AND NEW.status IN ('approved', 'superseded'))
  OR (OLD.status = 'approved' AND NEW.status = 'superseded')
)
BEGIN
  SELECT RAISE(ABORT, 'transicao_de_status_invalida');
END;

CREATE TABLE validation_runs (
  id TEXT NOT NULL PRIMARY KEY,
  model_version_id TEXT NOT NULL REFERENCES model_versions (id),
  blocking_count INTEGER NOT NULL CHECK (blocking_count >= 0),
  issues_json TEXT NOT NULL CHECK (json_valid(issues_json)),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0)
);

CREATE INDEX validation_runs_version ON validation_runs (model_version_id, created_at);

CREATE TABLE approvals (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL,
  model_version_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users (id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  FOREIGN KEY (system_id, model_version_id) REFERENCES model_versions (system_id, id)
);

CREATE INDEX approvals_version ON approvals (model_version_id, created_at);

-- Aprovação é evidência: não muda depois de gravada.
CREATE TRIGGER approvals_immutable
BEFORE UPDATE ON approvals
BEGIN
  SELECT RAISE(ABORT, 'aprovacao_imutavel');
END;

-- A aprovação vale para o conteúdo exato: hash diferente do da versão é recusado; versão com
-- erro bloqueante não pode ser aprovada; só o dono do sistema aprova.
CREATE TRIGGER approvals_exact_version
BEFORE INSERT ON approvals
WHEN NEW.decision = 'approved' AND NOT EXISTS (
  SELECT 1 FROM model_versions v JOIN systems s ON s.id = v.system_id
  WHERE v.id = NEW.model_version_id AND v.system_id = NEW.system_id
    AND v.hash = NEW.hash AND v.status = 'valid' AND s.owner_id = NEW.actor_id
)
BEGIN
  SELECT RAISE(ABORT, 'aprovacao_invalida');
END;

ALTER TABLE systems ADD COLUMN active_version_id TEXT REFERENCES model_versions (id);

-- Só ativa versão do próprio sistema com aprovação registrada para o hash exato (seção 8,
-- passo 10). O status sozinho não basta: alterar status por SQL não substitui a aprovação.
CREATE TRIGGER systems_active_version_approved
BEFORE UPDATE OF active_version_id ON systems
WHEN NEW.active_version_id IS NOT NULL
  AND NEW.active_version_id IS NOT OLD.active_version_id
  AND NOT EXISTS (
    SELECT 1 FROM model_versions v
    JOIN approvals a
      ON a.model_version_id = v.id AND a.system_id = v.system_id
     AND a.hash = v.hash AND a.decision = 'approved'
    WHERE v.id = NEW.active_version_id AND v.system_id = NEW.id AND v.status = 'approved'
  )
BEGIN
  SELECT RAISE(ABORT, 'versao_nao_aprovada');
END;
