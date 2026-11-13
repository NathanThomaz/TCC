-- Migration 0007 — logotipo do sistema (seções 5 e 29; emenda da seção 31): PNG ou JPEG de até
-- 200 KB guardado no próprio D1 (R2 exige meio de pagamento). O tipo é conferido pelo conteúdo no
-- Worker; SVG e qualquer outro formato são recusados. Sem logotipo, a tela mostra as iniciais.
-- Não é versionado com a configuração: nome, logotipo e cores podem mudar depois de ativar (seção 9).
-- Nunca editar esta migration depois de aplicada.

CREATE TABLE system_logos (
  system_id TEXT NOT NULL PRIMARY KEY REFERENCES systems (id),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg')),
  bytes BLOB NOT NULL CHECK (typeof(bytes) = 'blob' AND length(bytes) BETWEEN 1 AND 204800),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  updated_by TEXT NOT NULL REFERENCES users (id),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at > 0)
);
