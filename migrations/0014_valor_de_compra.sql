-- Migration 0014: valor de compra informado no cadastro do produto (pedido do dono, 2026-11-14).
-- Aditiva. last_cost_cents continua sendo o último custo (compras o atualizam e o cancelamento
-- de compra o recalcula, podendo zerar); cost_cents guarda o que a pessoa informou, para o custo
-- não sumir quando a única compra é cancelada. Custo usado = COALESCE(last_cost_cents, cost_cents).
ALTER TABLE products ADD COLUMN cost_cents INTEGER CHECK (cost_cents IS NULL
  OR (typeof(cost_cents) = 'integer' AND cost_cents BETWEEN 0 AND 100000000));
