-- Migration 0004 — criação por conversa (seção 8), requisitos versionados e consumo de IA
-- (seção 21). A IA propõe; quem confirma requisito e aprova configuração é o usuário. O progresso
-- fica no servidor: recarregar, sair ou falhar a IA não apaga conversa nem requisitos.
-- Nunca editar esta migration depois de aplicada.

-- Uma conversa de criação por sistema (do administrador dono); consulta é por usuário + sistema.
CREATE TABLE conversations (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL CHECK (kind IN ('criacao', 'consulta')),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  UNIQUE (system_id, user_id, kind)
);

CREATE TABLE messages (
  id TEXT NOT NULL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id),
  seq INTEGER NOT NULL CHECK (typeof(seq) = 'integer' AND seq >= 1),
  role TEXT NOT NULL CHECK (role IN ('usuario', 'assistente')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 8000),
  -- Perguntas e itens fora do catálogo que a IA devolveu junto (exibição).
  data_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data_json)),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  UNIQUE (conversation_id, seq)
);

CREATE TRIGGER messages_immutable
BEFORE UPDATE ON messages
BEGIN
  SELECT RAISE(ABORT, 'mensagem_imutavel');
END;

-- Requisitos com código estável (REQ-01) e versões: mudar o texto cria outra linha e a anterior
-- vira 'substituido' (T06). Só uma linha viva por código.
CREATE TABLE requirements (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  -- Mesmo formato do contrato (REQ-01 a REQ-999).
  code TEXT NOT NULL CHECK (code GLOB 'REQ-[0-9][0-9]' OR code GLOB 'REQ-[0-9][0-9][0-9]'),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 3 AND 400),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'substituido')),
  origin TEXT NOT NULL CHECK (origin IN ('ia', 'usuario')),
  origin_message_id TEXT REFERENCES messages (id),
  confirmed_by TEXT REFERENCES users (id),
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  CHECK (status <> 'confirmado' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

CREATE UNIQUE INDEX requirements_live_code ON requirements (system_id, code) WHERE status <> 'substituido';
CREATE INDEX requirements_system ON requirements (system_id, status);

CREATE TRIGGER requirements_text_immutable
BEFORE UPDATE OF system_id, code, text, origin, origin_message_id, created_at ON requirements
BEGIN
  SELECT RAISE(ABORT, 'requisito_imutavel');
END;

-- pendente -> confirmado | substituido; confirmado -> substituido. Confirmar é ato do usuário.
CREATE TRIGGER requirements_status_transition
BEFORE UPDATE OF status ON requirements
WHEN NEW.status IS NOT OLD.status AND NOT (
  (OLD.status = 'pendente' AND NEW.status IN ('confirmado', 'substituido'))
  OR (OLD.status = 'confirmado' AND NEW.status = 'substituido')
)
BEGIN
  SELECT RAISE(ABORT, 'transicao_de_status_invalida');
END;

-- Consumo de IA (seção 21): cada chamada reserva uma estimativa antes de sair e grava o consumo
-- real ao voltar. O teto mensal soma o concluído e as reservas em aberto (bloqueio preventivo).
-- Custos em micro-reais (1 real = 1.000.000) para não perder centavos fracionários.
CREATE TABLE ai_usage (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT REFERENCES systems (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  purpose TEXT NOT NULL CHECK (purpose IN ('levantamento', 'modelagem', 'correcao', 'consulta')),
  model TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'reservado' CHECK (state IN ('reservado', 'concluido', 'falhou')),
  reserved_micro_brl INTEGER NOT NULL CHECK (reserved_micro_brl >= 0),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  cost_micro_brl INTEGER CHECK (cost_micro_brl IS NULL OR cost_micro_brl >= 0),
  error TEXT CHECK (error IS NULL OR length(error) <= 300),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  finished_at INTEGER
);

CREATE INDEX ai_usage_month ON ai_usage (created_at, state);
