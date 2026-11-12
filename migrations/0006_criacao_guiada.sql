-- Migration 0006 — criação guiada pela IA e pedidos ao desenvolvedor (ADR-004). A IA entrevista um
-- assunto por vez e o resumo mostra os requisitos em linguagem de negócio; o que o catálogo não cobre
-- vira pedido ao desenvolvedor, com ficha e estado. O requisito continua sendo confirmado só pelo
-- usuário. Nunca editar esta migration depois de aplicada.

-- Assunto e título curto do resumo; "sugestão" marca o valor que a IA propôs sem o dono ter dito:
-- só vale depois que o usuário o aceita (confirmar o requisito). Como o texto, não mudam depois.
ALTER TABLE requirements ADD COLUMN topic TEXT CHECK (topic IS NULL OR topic IN
  ('negocio', 'produtos_precos', 'pedidos_estoque', 'clientes', 'atendimentos', 'aparencia'));
ALTER TABLE requirements ADD COLUMN label TEXT CHECK (label IS NULL OR length(label) BETWEEN 1 AND 80);
ALTER TABLE requirements ADD COLUMN suggested INTEGER NOT NULL DEFAULT 0 CHECK (suggested IN (0, 1));

CREATE TRIGGER requirements_guided_immutable
BEFORE UPDATE OF topic, label, suggested ON requirements
BEGIN
  SELECT RAISE(ABORT, 'requisito_imutavel');
END;

-- Pedido ao desenvolvedor: a ficha é escrita uma vez (pela IA na conversa ou pelo dono no modo
-- avançado) e não muda; o andamento fica no estado e no histórico.
CREATE TABLE dev_requests (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  created_by TEXT NOT NULL REFERENCES users (id),
  origin TEXT NOT NULL CHECK (origin IN ('conversa', 'formulario')),
  origin_message_id TEXT REFERENCES messages (id),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  topic TEXT CHECK (topic IS NULL OR topic IN
    ('negocio', 'produtos_precos', 'pedidos_estoque', 'clientes', 'atendimentos', 'aparencia')),
  original_request TEXT NOT NULL CHECK (length(original_request) BETWEEN 3 AND 2000),
  context TEXT CHECK (context IS NULL OR length(context) BETWEEN 1 AND 2000),
  proposed_rule TEXT CHECK (proposed_rule IS NULL OR length(proposed_rule) BETWEEN 1 AND 2000),
  examples_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(examples_json) AND json_type(examples_json) = 'array'),
  acceptance_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(acceptance_json) AND json_type(acceptance_json) = 'array'),
  -- aberto: registrado; em_analise: o desenvolvedor avalia; implementado/recusado: decisão do
  -- desenvolvedor; cancelado: o dono desistiu.
  status TEXT NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'em_analise', 'implementado', 'recusado', 'cancelado')),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  CHECK (origin <> 'conversa' OR origin_message_id IS NOT NULL)
);

CREATE INDEX dev_requests_system ON dev_requests (system_id, created_at);

CREATE TRIGGER dev_requests_content_immutable
BEFORE UPDATE OF id, system_id, created_by, origin, origin_message_id, title, topic,
  original_request, context, proposed_rule, examples_json, acceptance_json, created_at
ON dev_requests
BEGIN
  SELECT RAISE(ABORT, 'pedido_imutavel');
END;

-- aberto -> em_analise | implementado | recusado | cancelado; em_analise -> implementado | recusado.
-- Implementado, recusado e cancelado são finais.
CREATE TRIGGER dev_requests_status_transition
BEFORE UPDATE OF status ON dev_requests
WHEN NEW.status IS NOT OLD.status AND NOT (
  (OLD.status = 'aberto' AND NEW.status IN ('em_analise', 'implementado', 'recusado', 'cancelado'))
  OR (OLD.status = 'em_analise' AND NEW.status IN ('implementado', 'recusado'))
)
BEGIN
  SELECT RAISE(ABORT, 'transicao_de_pedido_invalida');
END;

-- Histórico (mudanças de estado) e comentários do pedido; nada se reescreve.
CREATE TABLE dev_request_events (
  id TEXT NOT NULL PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES dev_requests (id),
  actor_id TEXT REFERENCES users (id),
  kind TEXT NOT NULL CHECK (kind IN ('estado', 'comentario')),
  status TEXT CHECK (status IS NULL OR status IN
    ('aberto', 'em_analise', 'implementado', 'recusado', 'cancelado')),
  note TEXT CHECK (note IS NULL OR length(note) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  CHECK ((kind = 'estado' AND status IS NOT NULL) OR (kind = 'comentario' AND status IS NULL AND note IS NOT NULL))
);

CREATE INDEX dev_request_events_request ON dev_request_events (request_id, created_at);

CREATE TRIGGER dev_request_events_immutable
BEFORE UPDATE ON dev_request_events
BEGIN
  SELECT RAISE(ABORT, 'historico_imutavel');
END;
