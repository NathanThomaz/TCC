-- Migration 0012: código de barras do produto (pedido do dono, 2026-11-14). Aditiva.
-- Lido por leitor USB ou pela câmera na venda; único por sistema quando informado.
ALTER TABLE products ADD COLUMN barcode TEXT CHECK (barcode IS NULL
  OR (length(barcode) BETWEEN 1 AND 64 AND barcode NOT GLOB '*[^0-9A-Za-z.-]*'));

CREATE UNIQUE INDEX products_barcode ON products (system_id, barcode) WHERE barcode IS NOT NULL;
