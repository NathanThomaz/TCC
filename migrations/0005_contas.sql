-- Migration 0005 — gestão de contas secundárias (seção 7). Invariantes que valem por qualquer
-- caminho (tela, consulta de revogação, corrida entre requisições), e não só pelo handler:
-- conta desativada não tem nem recebe acesso, e a sincronização com o Firebase fica registrada
-- até dar certo. Nunca editar esta migration depois de aplicada.

-- uid da conta no Firebase criada no convite (antes do primeiro acesso, firebase_uid é NULL).
ALTER TABLE users ADD COLUMN invited_uid TEXT;
-- Quando o link de definir senha foi pedido ao Firebase com sucesso (NULL = ainda não saiu).
ALTER TABLE users ADD COLUMN invite_sent_at INTEGER;
-- Ação pendente no Firebase depois de gravada no D1 (o D1 vale na hora; o Firebase só reforça).
ALTER TABLE users ADD COLUMN provider_sync TEXT
  CHECK (provider_sync IS NULL OR provider_sync IN ('desativar', 'reativar'));

-- Desativar, por qualquer origem (administrador ou desativação vista no Firebase), revoga todos
-- os acessos: reativar sempre exige revisar os acessos (seção 7).
CREATE TRIGGER users_disabled_revokes_access
AFTER UPDATE OF status ON users
WHEN NEW.status = 'disabled' AND OLD.status IS NOT 'disabled'
BEGIN
  UPDATE system_access SET status = 'revoked', updated_at = NEW.updated_at
  WHERE user_id = NEW.id AND status = 'active';
END;

-- Conta desativada não recebe acesso, nem numa concessão que corra junto com a desativação.
CREATE TRIGGER system_access_enabled_user_insert
BEFORE INSERT ON system_access
WHEN NEW.status = 'active' AND (SELECT status FROM users WHERE id = NEW.user_id) = 'disabled'
BEGIN
  SELECT RAISE(ABORT, 'conta_desativada');
END;

CREATE TRIGGER system_access_enabled_user_update
BEFORE UPDATE OF status ON system_access
WHEN NEW.status = 'active' AND (SELECT status FROM users WHERE id = NEW.user_id) = 'disabled'
BEGIN
  SELECT RAISE(ABORT, 'conta_desativada');
END;
