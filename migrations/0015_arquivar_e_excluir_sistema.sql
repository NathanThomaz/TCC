-- Arquivar, reativar e excluir sistema (pedido do dono, 2026-11-16).
-- Arquivar usa o status 'archived' que já existe (0001). Excluir vale só para sistema que nunca
-- foi ativado: ele some de vez para o dono, mas a linha fica, porque o consumo da IA (ai_usage)
-- aponta para ela e entra no limite mensal de cada conta. O nome volta a ficar livre.

ALTER TABLE systems ADD COLUMN deleted_at INTEGER
  CHECK (deleted_at IS NULL OR (typeof(deleted_at) = 'integer' AND deleted_at > 0));

-- Só exclui o que nunca foi ativado, e excluído não volta.
CREATE TRIGGER systems_delete_rules
BEFORE UPDATE OF deleted_at ON systems
WHEN NEW.deleted_at IS NOT OLD.deleted_at AND (
  OLD.deleted_at IS NOT NULL OR OLD.active_version_id IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'exclusao_invalida');
END;

-- Sistema excluído não muda mais de status nem recebe versão ativa.
CREATE TRIGGER systems_deleted_frozen
BEFORE UPDATE OF status, active_version_id ON systems
WHEN OLD.deleted_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'sistema_excluido');
END;

-- Inativar confere as pendências no próprio UPDATE; aqui, o outro lado da corrida: venda, reserva
-- e agendamento novos só entram em sistema ativo (quem chegar depois do arquivar é recusado).
CREATE TRIGGER sales_only_active_system
BEFORE INSERT ON sales
WHEN (SELECT status FROM systems WHERE id = NEW.system_id) IS NOT 'active'
BEGIN
  SELECT RAISE(ABORT, 'sistema_inativo');
END;

CREATE TRIGGER reservations_only_active_system
BEFORE INSERT ON reservations
WHEN (SELECT status FROM systems WHERE id = NEW.system_id) IS NOT 'active'
BEGIN
  SELECT RAISE(ABORT, 'sistema_inativo');
END;

CREATE TRIGGER appointments_only_active_system
BEFORE INSERT ON appointments
WHEN (SELECT status FROM systems WHERE id = NEW.system_id) IS NOT 'active'
BEGIN
  SELECT RAISE(ABORT, 'sistema_inativo');
END;

-- Uma resposta da IA começada antes da exclusão não grava na conversa do sistema excluído.
CREATE TRIGGER creation_state_system_deleted
BEFORE UPDATE ON creation_state
WHEN (SELECT deleted_at FROM systems WHERE id = NEW.system_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'sistema_excluido');
END;
