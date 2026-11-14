-- Migration 0011: estoque mínimo de cada produto (pedido do dono, 2026-11-14). Aditiva.
-- Cada produto tem o seu limite de aviso; NULL usa a regra estoque_minimo do sistema (se houver)
-- ou, sem ela, avisa só quando o produto acaba.
ALTER TABLE products ADD COLUMN min_units INTEGER CHECK (min_units IS NULL
  OR (typeof(min_units) = 'integer' AND min_units BETWEEN 1 AND 1000000));
