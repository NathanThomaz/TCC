-- Migration 0014: valor de compra informado no cadastro do produto (pedido do dono, 2026-11-14).
-- last_cost_cents continua sendo o custo em uso: compras o atualizam e o cadastro também, quando
-- a pessoa informa o valor. cost_cents guarda o valor informado e cost_set_at, quando foi
-- informado, para o cancelamento de compra saber o que é mais recente.
ALTER TABLE products ADD COLUMN cost_cents INTEGER CHECK (cost_cents IS NULL
  OR (typeof(cost_cents) = 'integer' AND cost_cents BETWEEN 0 AND 100000000));
ALTER TABLE products ADD COLUMN cost_set_at INTEGER CHECK (cost_set_at IS NULL
  OR (typeof(cost_set_at) = 'integer' AND cost_set_at > 0));

-- Igual ao da 0008, menos o custo: cancelada a compra, vale a compra válida mais recente que o
-- valor informado; sem ela, o valor informado; sem os dois, a última compra válida (ou nenhum).
-- No mesmo milissegundo, a compra vale (como no trigger de entrada, que sempre grava o custo).
DROP TRIGGER purchases_cancel_effects;
CREATE TRIGGER purchases_cancel_effects
AFTER UPDATE OF status ON purchases
WHEN OLD.status = 'completed' AND NEW.status = 'cancelled'
BEGIN
  UPDATE products
  SET physical = physical - (SELECT units FROM purchase_items
                             WHERE purchase_id = NEW.id AND product_id = products.id),
      last_cost_cents = COALESCE(
        (SELECT i.unit_cost_cents FROM purchase_items i JOIN purchases c ON c.id = i.purchase_id
         WHERE i.product_id = products.id AND c.status = 'completed' AND c.id <> NEW.id
           AND c.created_at >= COALESCE(products.cost_set_at, -1)
         ORDER BY c.created_at DESC, c.rowid DESC LIMIT 1),
        products.cost_cents,
        (SELECT i.unit_cost_cents FROM purchase_items i JOIN purchases c ON c.id = i.purchase_id
         WHERE i.product_id = products.id AND c.status = 'completed' AND c.id <> NEW.id
         ORDER BY c.created_at DESC, c.rowid DESC LIMIT 1)),
      updated_at = max(updated_at, NEW.cancelled_at)
  WHERE id IN (SELECT product_id FROM purchase_items WHERE purchase_id = NEW.id);
  INSERT INTO stock_movements
    (id, system_id, product_id, kind, delta, balance_after, reason, purchase_id, actor_id, created_at)
  SELECT lower(hex(randomblob(16))), NEW.system_id, i.product_id, 'correcao', -i.units, p.physical,
         substr('Compra cancelada: ' || NEW.cancel_reason, 1, 300), NEW.id, NEW.cancelled_by,
         NEW.cancelled_at
  FROM purchase_items i JOIN products p ON p.id = i.product_id
  WHERE i.purchase_id = NEW.id;
  UPDATE financial_entries
  SET status = 'cancelado', cancelled_at = NEW.cancelled_at, cancelled_by = NEW.cancelled_by,
      cancel_reason = 'Compra cancelada', updated_at = max(updated_at, NEW.cancelled_at)
  WHERE purchase_id = NEW.id AND status = 'pendente';
END;
