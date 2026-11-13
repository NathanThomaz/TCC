-- Migration 0008: módulos opcionais (ADR-006) — formas de pagamento, fornecedores e compras,
-- financeiro. Aditiva: só cria tabelas, colunas e gatilhos; nenhuma tabela existente é refeita.

-- ---- Contas criadas com senha (pedido do dono, 2026-11-13) ----

-- Administrador independente criado pelo dono do Nexus (o primeiro administrador): guarda quem
-- criou, para listar, desativar e redefinir a senha dessas contas.
ALTER TABLE users ADD COLUMN created_by TEXT REFERENCES users (id);

-- ---- Formas de pagamento ----

-- Forma registrada na conclusão da venda (NULL em sistema sem o módulo e em vendas antigas).
ALTER TABLE sales ADD COLUMN payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN
  ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'a_prazo'));

-- A forma só é gravada junto com a conclusão e não muda depois.
CREATE TRIGGER sales_payment_method_on_complete
BEFORE UPDATE OF payment_method ON sales
WHEN NEW.payment_method IS NOT OLD.payment_method
  AND NOT (OLD.status = 'draft' AND NEW.status = 'completed')
BEGIN
  SELECT RAISE(ABORT, 'forma_pagamento_imutavel');
END;

-- ---- Fornecedores e compras ----

CREATE TABLE suppliers (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra_json)),
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  UNIQUE (system_id, id)
);

CREATE INDEX suppliers_system ON suppliers (system_id, status, name);

-- Último custo de compra do produto (valor do estoque a custo no painel).
ALTER TABLE products ADD COLUMN last_cost_cents INTEGER CHECK (last_cost_cents IS NULL
  OR (typeof(last_cost_cents) = 'integer' AND last_cost_cents BETWEEN 0 AND 100000000));

CREATE TABLE purchases (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  supplier_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
  total_cents INTEGER NOT NULL CHECK (typeof(total_cents) = 'integer' AND total_cents >= 0),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 300),
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  cancelled_at INTEGER,
  cancelled_by TEXT REFERENCES users (id),
  cancel_reason TEXT CHECK (cancel_reason IS NULL OR length(cancel_reason) BETWEEN 3 AND 300),
  FOREIGN KEY (system_id, supplier_id) REFERENCES suppliers (system_id, id),
  UNIQUE (system_id, id),
  CHECK (status <> 'cancelled'
    OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancel_reason IS NOT NULL))
);

CREATE INDEX purchases_system ON purchases (system_id, created_at);
CREATE INDEX purchases_supplier ON purchases (system_id, supplier_id);

-- Itens: gravados uma vez, com a compra; a quantidade já está em unidades.
CREATE TABLE purchase_items (
  purchase_id TEXT NOT NULL,
  system_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  product_id TEXT NOT NULL,
  units INTEGER NOT NULL CHECK (typeof(units) = 'integer' AND units > 0),
  informed_boxes INTEGER NOT NULL DEFAULT 0 CHECK (informed_boxes >= 0),
  informed_units INTEGER NOT NULL DEFAULT 0 CHECK (informed_units >= 0),
  unit_cost_cents INTEGER NOT NULL
    CHECK (typeof(unit_cost_cents) = 'integer' AND unit_cost_cents BETWEEN 0 AND 100000000),
  line_cents INTEGER NOT NULL CHECK (line_cents = units * unit_cost_cents),
  PRIMARY KEY (purchase_id, position),
  UNIQUE (purchase_id, product_id),
  FOREIGN KEY (system_id, purchase_id) REFERENCES purchases (system_id, id),
  FOREIGN KEY (system_id, product_id) REFERENCES products (system_id, id)
);

-- Movimento de estoque que veio de uma compra (entrada) ou do seu cancelamento (correção).
ALTER TABLE stock_movements ADD COLUMN purchase_id TEXT REFERENCES purchases (id);

CREATE TRIGGER purchases_active_supplier
BEFORE INSERT ON purchases
WHEN (SELECT status FROM suppliers WHERE id = NEW.supplier_id AND system_id = NEW.system_id)
  IS NOT 'active'
BEGIN
  SELECT RAISE(ABORT, 'fornecedor_inativo');
END;

CREATE TRIGGER purchase_items_active_product
BEFORE INSERT ON purchase_items
WHEN (SELECT status FROM products WHERE id = NEW.product_id AND system_id = NEW.system_id)
  IS NOT 'active'
BEGIN
  SELECT RAISE(ABORT, 'produto_inativo');
END;

-- Item entra junto com a compra concluída: dá entrada no estoque e grava o último custo.
CREATE TRIGGER purchase_items_effects
AFTER INSERT ON purchase_items
BEGIN
  UPDATE products
  SET physical = physical + NEW.units, last_cost_cents = NEW.unit_cost_cents,
      updated_at = max(updated_at, (SELECT created_at FROM purchases WHERE id = NEW.purchase_id))
  WHERE id = NEW.product_id AND system_id = NEW.system_id;
  INSERT INTO stock_movements
    (id, system_id, product_id, kind, delta, informed_boxes, informed_units, balance_after, reason,
     purchase_id, actor_id, created_at)
  SELECT lower(hex(randomblob(16))), NEW.system_id, NEW.product_id, 'entrada', NEW.units,
         NEW.informed_boxes, NEW.informed_units, p.physical,
         substr('Compra de ' || s.name, 1, 300), NEW.purchase_id, c.created_by, c.created_at
  FROM products p, purchases c JOIN suppliers s ON s.id = c.supplier_id
  WHERE p.id = NEW.product_id AND c.id = NEW.purchase_id;
END;

CREATE TRIGGER purchase_items_immutable_update
BEFORE UPDATE ON purchase_items
BEGIN
  SELECT RAISE(ABORT, 'compra_imutavel');
END;

-- Enquanto a compra existir, o item não sai (como sale_items: só some junto com a compra).
CREATE TRIGGER purchase_items_immutable_delete
BEFORE DELETE ON purchase_items
WHEN EXISTS (SELECT 1 FROM purchases WHERE id = OLD.purchase_id)
BEGIN
  SELECT RAISE(ABORT, 'compra_imutavel');
END;

-- Compra só vai de concluída para cancelada, uma vez.
CREATE TRIGGER purchases_status_transition
BEFORE UPDATE OF status ON purchases
WHEN NEW.status IS NOT OLD.status AND NOT (OLD.status = 'completed' AND NEW.status = 'cancelled')
BEGIN
  SELECT RAISE(ABORT, 'transicao_de_status_invalida');
END;

-- ---- Financeiro ----

CREATE TABLE financial_entries (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  kind TEXT NOT NULL CHECK (kind IN ('receber', 'pagar')),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 3 AND 200),
  amount_cents INTEGER NOT NULL
    CHECK (typeof(amount_cents) = 'integer' AND amount_cents BETWEEN 1 AND 10000000000),
  -- Vencimento como data local (AAAA-MM-DD, fuso do Nexus): vencido = antes de hoje.
  due_date TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  paid_at INTEGER,
  paid_by TEXT REFERENCES users (id),
  cancelled_at INTEGER,
  cancelled_by TEXT REFERENCES users (id),
  cancel_reason TEXT CHECK (cancel_reason IS NULL OR length(cancel_reason) BETWEEN 3 AND 300),
  -- Origem automática (venda a prazo ou compra) e contraparte, quando houver.
  sale_id TEXT,
  purchase_id TEXT,
  customer_id TEXT,
  supplier_id TEXT,
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  FOREIGN KEY (system_id, sale_id) REFERENCES sales (system_id, id),
  FOREIGN KEY (system_id, purchase_id) REFERENCES purchases (system_id, id),
  FOREIGN KEY (system_id, customer_id) REFERENCES customers (system_id, id),
  FOREIGN KEY (system_id, supplier_id) REFERENCES suppliers (system_id, id),
  CHECK (sale_id IS NULL OR kind = 'receber'),
  CHECK (purchase_id IS NULL OR kind = 'pagar'),
  CHECK (customer_id IS NULL OR kind = 'receber'),
  CHECK (supplier_id IS NULL OR kind = 'pagar'),
  CHECK (status <> 'pago' OR (paid_at IS NOT NULL AND paid_by IS NOT NULL)),
  CHECK (status <> 'cancelado' OR (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL))
);

CREATE INDEX financial_entries_system ON financial_entries (system_id, status, due_date);
-- Uma conta por venda e por compra.
CREATE UNIQUE INDEX financial_entries_sale ON financial_entries (sale_id) WHERE sale_id IS NOT NULL;
CREATE UNIQUE INDEX financial_entries_purchase ON financial_entries (purchase_id)
  WHERE purchase_id IS NOT NULL;

-- Pendente vai para paga ou cancelada; depois disso, nada muda.
CREATE TRIGGER financial_entries_status_transition
BEFORE UPDATE ON financial_entries
WHEN OLD.status <> 'pendente'
BEGIN
  SELECT RAISE(ABORT, 'lancamento_encerrado');
END;

-- Cancelar a origem cancela a conta pendente; com a conta paga, a origem não é cancelada.
CREATE TRIGGER sales_cancel_requires_unpaid
BEFORE UPDATE OF status ON sales
WHEN OLD.status = 'completed' AND NEW.status = 'cancelled'
  AND EXISTS (SELECT 1 FROM financial_entries WHERE sale_id = NEW.id AND status = 'pago')
BEGIN
  SELECT RAISE(ABORT, 'conta_ja_paga');
END;

CREATE TRIGGER sales_cancel_financial
AFTER UPDATE OF status ON sales
WHEN OLD.status = 'completed' AND NEW.status = 'cancelled'
BEGIN
  UPDATE financial_entries
  SET status = 'cancelado', cancelled_at = NEW.cancelled_at, cancelled_by = NEW.cancelled_by,
      cancel_reason = 'Venda cancelada', updated_at = max(updated_at, NEW.cancelled_at)
  WHERE sale_id = NEW.id AND status = 'pendente';
END;

CREATE TRIGGER purchases_cancel_requires_unpaid
BEFORE UPDATE OF status ON purchases
WHEN OLD.status = 'completed' AND NEW.status = 'cancelled'
  AND EXISTS (SELECT 1 FROM financial_entries WHERE purchase_id = NEW.id AND status = 'pago')
BEGIN
  SELECT RAISE(ABORT, 'conta_ja_paga');
END;

-- Cancelar a compra devolve o estoque (correção), volta o custo de cada produto ao da última
-- compra ainda válida (ou nenhum) e cancela a conta a pagar pendente. Se o estoque já foi
-- vendido ou reservado, products_physical_above_reserved recusa o lote.
CREATE TRIGGER purchases_cancel_effects
AFTER UPDATE OF status ON purchases
WHEN OLD.status = 'completed' AND NEW.status = 'cancelled'
BEGIN
  UPDATE products
  SET physical = physical - (SELECT units FROM purchase_items
                             WHERE purchase_id = NEW.id AND product_id = products.id),
      last_cost_cents = (
        SELECT i.unit_cost_cents FROM purchase_items i JOIN purchases c ON c.id = i.purchase_id
        WHERE i.product_id = products.id AND c.status = 'completed' AND c.id <> NEW.id
        ORDER BY c.created_at DESC, c.rowid DESC LIMIT 1),
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
