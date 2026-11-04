-- Migration 0003 — operação dos sistemas ativos: cadastros, estoque, reservas, vendas e agenda
-- (seções 10 a 14 e 18). Todo registro pertence a um sistema; chaves compostas (system_id, id)
-- impedem apontar para cliente, produto, profissional ou venda de outro sistema (T04).
-- Dinheiro em centavos inteiros; quantidades em unidades inteiras positivas; instantes em ms UTC.
-- Os triggers recebem o relógio do backend pelo updated_at/created_at da própria linha: o banco
-- não lê relógio próprio (ADR-001, item 7). Nunca editar esta migration depois de aplicada.

CREATE TABLE customers (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  -- Campos informativos da configuração ativa, já validados pelo Worker.
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra_json)),
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  UNIQUE (system_id, id)
);

CREATE INDEX customers_system ON customers (system_id, status, name);

CREATE TABLE products (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  -- PRE-01: varejo sempre; atacado obrigatório quando a configuração tem limite de atacado.
  retail_cents INTEGER NOT NULL
    CHECK (typeof(retail_cents) = 'integer' AND retail_cents BETWEEN 1 AND 100000000),
  wholesale_cents INTEGER CHECK (wholesale_cents IS NULL
    OR (typeof(wholesale_cents) = 'integer' AND wholesale_cents BETWEEN 1 AND 100000000)),
  -- PRE-05: fator da caixa do próprio produto; NULL = vendido só em unidades.
  units_per_box INTEGER CHECK (units_per_box IS NULL
    OR (typeof(units_per_box) = 'integer' AND units_per_box BETWEEN 2 AND 1000)),
  -- EST-01: começa em zero. O reservado não é guardado: é a soma das reservas ativas não vencidas.
  physical INTEGER NOT NULL DEFAULT 0 CHECK (typeof(physical) = 'integer' AND physical >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra_json)),
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  UNIQUE (system_id, id)
);

CREATE INDEX products_system ON products (system_id, status, name);

CREATE TABLE professionals (
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

CREATE INDEX professionals_system ON professionals (system_id, status, name);

-- Vendas (seção 18). "Expirado" não é status gravado: é rascunho com expires_at vencido (RES-05),
-- para que a expiração funcione sem tarefa periódica e com a aba fechada.
CREATE TABLE sales (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'discarded', 'completed', 'cancelled')),
  -- Condições comerciais registradas na criação (PRE-06): limite de atacado (NULL = sem atacado)
  -- e prazo de reserva, copiados da versão ativa da configuração.
  model_version_id TEXT NOT NULL REFERENCES model_versions (id),
  wholesale_threshold_cents INTEGER CHECK (wholesale_threshold_cents IS NULL
    OR (typeof(wholesale_threshold_cents) = 'integer' AND wholesale_threshold_cents > 0)),
  reservation_minutes INTEGER NOT NULL CHECK (reservation_minutes BETWEEN 1 AND 1440),
  -- Controle de edição concorrente: cada gravação do rascunho soma exatamente 1.
  revision INTEGER NOT NULL DEFAULT 1 CHECK (typeof(revision) = 'integer' AND revision >= 1),
  expires_at INTEGER NOT NULL CHECK (typeof(expires_at) = 'integer' AND expires_at > 0),
  subtotal_retail_cents INTEGER NOT NULL CHECK (subtotal_retail_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  price_tier TEXT NOT NULL CHECK (price_tier IN ('varejo', 'atacado')),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra_json)),
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  discarded_at INTEGER,
  completed_at INTEGER,
  completed_by TEXT REFERENCES users (id),
  -- CAN-06: motivo, ator e data do cancelamento.
  cancelled_at INTEGER,
  cancelled_by TEXT REFERENCES users (id),
  cancel_reason TEXT CHECK (cancel_reason IS NULL OR length(cancel_reason) BETWEEN 3 AND 300),
  UNIQUE (system_id, id),
  FOREIGN KEY (system_id, customer_id) REFERENCES customers (system_id, id),
  CHECK (status <> 'completed' OR (completed_at IS NOT NULL AND completed_by IS NOT NULL)),
  CHECK (status <> 'cancelled' OR (completed_at IS NOT NULL AND cancelled_at IS NOT NULL
    AND cancelled_by IS NOT NULL AND cancel_reason IS NOT NULL))
);

CREATE INDEX sales_system ON sales (system_id, status, created_at);
CREATE INDEX sales_completed ON sales (system_id, completed_at);

-- Itens: um por produto, em caixas e/ou unidades soltas (T15: 2 caixas de 12 + 3 = 27).
-- Preços e fator da caixa são os do momento em que o produto entrou no rascunho (decisão do
-- dono, 2026-11-04); itens antigos nunca são recalculados com preço novo.
CREATE TABLE sale_items (
  sale_id TEXT NOT NULL,
  system_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 100),
  boxes INTEGER NOT NULL DEFAULT 0 CHECK (typeof(boxes) = 'integer' AND boxes >= 0),
  loose_units INTEGER NOT NULL DEFAULT 0 CHECK (typeof(loose_units) = 'integer' AND loose_units >= 0),
  units_per_box INTEGER CHECK (units_per_box IS NULL OR units_per_box BETWEEN 2 AND 1000),
  units INTEGER NOT NULL CHECK (units > 0),
  retail_unit_cents INTEGER NOT NULL CHECK (retail_unit_cents > 0),
  wholesale_unit_cents INTEGER CHECK (wholesale_unit_cents IS NULL OR wholesale_unit_cents > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
  added_at INTEGER NOT NULL CHECK (typeof(added_at) = 'integer' AND added_at > 0),
  PRIMARY KEY (sale_id, product_id),
  FOREIGN KEY (system_id, sale_id) REFERENCES sales (system_id, id),
  FOREIGN KEY (system_id, product_id) REFERENCES products (system_id, id),
  CHECK (boxes = 0 OR units_per_box IS NOT NULL),
  CHECK (units = boxes * COALESCE(units_per_box, 0) + loose_units)
);

-- PRE-07: itens só mudam enquanto a venda é rascunho.
CREATE TRIGGER sale_items_only_draft_insert
BEFORE INSERT ON sale_items
WHEN (SELECT status FROM sales WHERE id = NEW.sale_id) IS NOT 'draft'
BEGIN
  SELECT RAISE(ABORT, 'venda_nao_editavel');
END;

CREATE TRIGGER sale_items_only_draft_update
BEFORE UPDATE ON sale_items
WHEN (SELECT status FROM sales WHERE id = OLD.sale_id) IS NOT 'draft'
BEGIN
  SELECT RAISE(ABORT, 'venda_nao_editavel');
END;

CREATE TRIGGER sale_items_only_draft_delete
BEFORE DELETE ON sale_items
WHEN (SELECT status FROM sales WHERE id = OLD.sale_id) IN ('discarded', 'completed', 'cancelled')
BEGIN
  SELECT RAISE(ABORT, 'venda_nao_editavel');
END;

-- Reservas (RES-01 a RES-08): uma linha por produto a cada gravação do rascunho. Vencida, deixa
-- de contar sozinha (expires_at <= agora); gravar de novo libera as anteriores e cria novas.
CREATE TABLE reservations (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (typeof(quantity) = 'integer' AND quantity > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released')),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  FOREIGN KEY (system_id, sale_id) REFERENCES sales (system_id, id),
  FOREIGN KEY (system_id, product_id) REFERENCES products (system_id, id)
);

CREATE INDEX reservations_product ON reservations (product_id, status, expires_at);
CREATE INDEX reservations_sale ON reservations (sale_id, status);

-- EST-05 / RES-02: só reserva o disponível (físico − reservado ativo no instante da gravação).
-- Dentro de db.batch(), a recusa desfaz o lote inteiro (prova d1-atomicidade, ADR-001).
CREATE TRIGGER reservations_available
BEFORE INSERT ON reservations
WHEN NEW.status = 'active' AND
  (SELECT physical FROM products WHERE id = NEW.product_id)
  - (SELECT COALESCE(SUM(quantity), 0) FROM reservations
     WHERE product_id = NEW.product_id AND status = 'active' AND expires_at > NEW.created_at)
  < NEW.quantity
BEGIN
  SELECT RAISE(ABORT, 'estoque_insuficiente');
END;

CREATE TRIGGER reservations_active_product
BEFORE INSERT ON reservations
WHEN (SELECT status FROM products WHERE id = NEW.product_id) IS NOT 'active'
BEGIN
  SELECT RAISE(ABORT, 'produto_inativo');
END;

CREATE TRIGGER reservations_status_transition
BEFORE UPDATE OF status ON reservations
WHEN NEW.status IS NOT OLD.status AND NOT (OLD.status = 'active' AND NEW.status IN ('consumed', 'released'))
BEGIN
  SELECT RAISE(ABORT, 'transicao_de_status_invalida');
END;

-- EST-04 e invariante geral: o físico nunca cai abaixo do reservado ativo. O instante de
-- referência é o updated_at gravado junto (relógio do backend).
CREATE TRIGGER products_physical_above_reserved
BEFORE UPDATE OF physical ON products
WHEN NEW.physical < OLD.physical AND NEW.physical < (
  SELECT COALESCE(SUM(quantity), 0) FROM reservations
  WHERE product_id = NEW.id AND status = 'active' AND expires_at > NEW.updated_at)
BEGIN
  SELECT RAISE(ABORT, 'abaixo_do_reservado');
END;

-- Seção 14: produto com reserva ativa não é inativado.
CREATE TRIGGER products_inactivate_without_reservation
BEFORE UPDATE OF status ON products
WHEN NEW.status = 'inactive' AND OLD.status = 'active' AND EXISTS (
  SELECT 1 FROM reservations
  WHERE product_id = NEW.id AND status = 'active' AND expires_at > NEW.updated_at)
BEGIN
  SELECT RAISE(ABORT, 'produto_com_reserva');
END;

-- Movimentos de estoque: entrada e correção (EST-02, EST-03), baixa da venda e estorno do
-- cancelamento. São evidência: não mudam depois de gravados.
CREATE TABLE stock_movements (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('entrada', 'correcao', 'venda', 'estorno')),
  delta INTEGER NOT NULL CHECK (typeof(delta) = 'integer' AND delta <> 0),
  -- Como a quantidade foi informada (caixas + unidades); o delta já está em unidades.
  informed_boxes INTEGER CHECK (informed_boxes IS NULL OR informed_boxes >= 0),
  informed_units INTEGER CHECK (informed_units IS NULL OR informed_units >= 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reason TEXT CHECK (reason IS NULL OR length(reason) BETWEEN 3 AND 300),
  sale_id TEXT,
  actor_id TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  FOREIGN KEY (system_id, product_id) REFERENCES products (system_id, id),
  FOREIGN KEY (system_id, sale_id) REFERENCES sales (system_id, id),
  CHECK ((kind IN ('entrada', 'correcao') AND reason IS NOT NULL)
    OR (kind IN ('venda', 'estorno') AND sale_id IS NOT NULL)),
  CHECK (kind <> 'entrada' OR delta > 0)
);

CREATE INDEX stock_movements_product ON stock_movements (system_id, product_id, created_at);

CREATE TRIGGER stock_movements_immutable
BEFORE UPDATE ON stock_movements
BEGIN
  SELECT RAISE(ABORT, 'movimento_imutavel');
END;

-- Transições de venda: draft -> discarded | completed; completed -> cancelled (CAN-03: sem
-- cancelamento parcial). Rascunho descartado e venda cancelada são estados distintos.
CREATE TRIGGER sales_status_transition
BEFORE UPDATE OF status ON sales
WHEN NEW.status IS NOT OLD.status AND NOT (
  (OLD.status = 'draft' AND NEW.status IN ('discarded', 'completed'))
  OR (OLD.status = 'completed' AND NEW.status = 'cancelled')
)
BEGIN
  SELECT RAISE(ABORT, 'transicao_de_status_invalida');
END;

-- Só rascunho é regravado, e cada gravação parte da revisão que o usuário viu (edição concorrente).
CREATE TRIGGER sales_revision_only_draft
BEFORE UPDATE OF revision ON sales
WHEN OLD.status <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'venda_nao_editavel');
END;

-- Quem grava envia revisão esperada + 1: se outra gravação passou na frente, OLD já avançou e o
-- valor enviado não é mais OLD + 1 (inclusive quando coincide com OLD), então o lote é desfeito.
CREATE TRIGGER sales_revision_check
BEFORE UPDATE OF revision ON sales
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'venda_alterada');
END;

CREATE TRIGGER sales_active_customer
BEFORE INSERT ON sales
WHEN (SELECT status FROM customers WHERE id = NEW.customer_id) IS NOT 'active'
BEGIN
  SELECT RAISE(ABORT, 'cliente_inativo');
END;

-- RES-08: concluir exige cada item coberto por reserva ativa e não vencida (RES-06: vencida
-- precisa ser regravada antes).
CREATE TRIGGER sales_complete_requires_reservation
BEFORE UPDATE OF status ON sales
WHEN OLD.status = 'draft' AND NEW.status = 'completed' AND (
  NOT EXISTS (SELECT 1 FROM sale_items WHERE sale_id = NEW.id)
  OR EXISTS (
    SELECT 1 FROM sale_items i
    WHERE i.sale_id = NEW.id AND i.units <> (
      SELECT COALESCE(SUM(r.quantity), 0) FROM reservations r
      WHERE r.sale_id = NEW.id AND r.product_id = i.product_id
        AND r.status = 'active' AND r.expires_at > NEW.updated_at)))
BEGIN
  SELECT RAISE(ABORT, 'reserva_expirada');
END;

-- RES-08: concluir consome a reserva e baixa o físico uma única vez (a transição só acontece
-- uma vez). A reserva é consumida antes da baixa, então a baixa não esbarra nela mesma.
CREATE TRIGGER sales_complete_effects
AFTER UPDATE OF status ON sales
WHEN OLD.status = 'draft' AND NEW.status = 'completed'
BEGIN
  UPDATE reservations SET status = 'consumed' WHERE sale_id = NEW.id AND status = 'active';
  UPDATE products
  SET physical = physical - (SELECT units FROM sale_items WHERE sale_id = NEW.id AND product_id = products.id),
      updated_at = max(updated_at, NEW.updated_at)
  WHERE id IN (SELECT product_id FROM sale_items WHERE sale_id = NEW.id);
  INSERT INTO stock_movements (id, system_id, product_id, kind, delta, balance_after, sale_id, actor_id, created_at)
  SELECT lower(hex(randomblob(16))), NEW.system_id, i.product_id, 'venda', -i.units, p.physical,
         NEW.id, NEW.completed_by, NEW.updated_at
  FROM sale_items i JOIN products p ON p.id = i.product_id
  WHERE i.sale_id = NEW.id;
END;

-- RES-07: descartar libera imediatamente.
CREATE TRIGGER sales_discard_effects
AFTER UPDATE OF status ON sales
WHEN OLD.status = 'draft' AND NEW.status = 'discarded'
BEGIN
  UPDATE reservations SET status = 'released' WHERE sale_id = NEW.id AND status = 'active';
END;

-- CAN-01: cancelar devolve o estoque uma única vez (a transição completed -> cancelled é única).
CREATE TRIGGER sales_cancel_effects
AFTER UPDATE OF status ON sales
WHEN OLD.status = 'completed' AND NEW.status = 'cancelled'
BEGIN
  UPDATE products
  SET physical = physical + (SELECT units FROM sale_items WHERE sale_id = NEW.id AND product_id = products.id),
      updated_at = max(updated_at, NEW.updated_at)
  WHERE id IN (SELECT product_id FROM sale_items WHERE sale_id = NEW.id);
  INSERT INTO stock_movements (id, system_id, product_id, kind, delta, balance_after, sale_id, actor_id, created_at)
  SELECT lower(hex(randomblob(16))), NEW.system_id, i.product_id, 'estorno', i.units, p.physical,
         NEW.id, NEW.cancelled_by, NEW.updated_at
  FROM sale_items i JOIN products p ON p.id = i.product_id
  WHERE i.sale_id = NEW.id;
END;

-- Agenda (seção 13 e ADR-002, item 3). Estados: scheduled -> in_progress -> done, ou cancelled.
-- Nada muda sozinho pelo relógio: horário passado sem início registrado continua scheduled.
CREATE TABLE appointments (
  id TEXT NOT NULL PRIMARY KEY,
  system_id TEXT NOT NULL REFERENCES systems (id),
  customer_id TEXT NOT NULL,
  professional_id TEXT NOT NULL,
  -- Tipo de atendimento da configuração ativa (ex.: instalacao); duração copiada na criação.
  service_type TEXT NOT NULL CHECK (length(service_type) BETWEEN 2 AND 40),
  start_at INTEGER NOT NULL CHECK (typeof(start_at) = 'integer' AND start_at > 0),
  end_at INTEGER NOT NULL CHECK (typeof(end_at) = 'integer' AND end_at > start_at),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'done', 'cancelled')),
  -- Par vinculado (AGE-02): posição 1 = primeiro (instalação), 2 = segundo (retirada).
  pair_id TEXT,
  pair_position INTEGER CHECK (pair_position IS NULL OR pair_position IN (1, 2)),
  -- CAN-07: vínculo com a venda é opcional.
  sale_id TEXT,
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra_json)),
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at INTEGER NOT NULL CHECK (typeof(created_at) = 'integer' AND created_at > 0),
  updated_at INTEGER NOT NULL CHECK (typeof(updated_at) = 'integer' AND updated_at >= created_at),
  started_at INTEGER,
  done_at INTEGER,
  cancelled_at INTEGER,
  cancelled_by TEXT REFERENCES users (id),
  cancel_reason TEXT CHECK (cancel_reason IS NULL OR length(cancel_reason) BETWEEN 3 AND 300),
  UNIQUE (system_id, id),
  UNIQUE (pair_id, pair_position),
  FOREIGN KEY (system_id, customer_id) REFERENCES customers (system_id, id),
  FOREIGN KEY (system_id, professional_id) REFERENCES professionals (system_id, id),
  FOREIGN KEY (system_id, sale_id) REFERENCES sales (system_id, id),
  CHECK ((pair_id IS NULL) = (pair_position IS NULL)),
  CHECK (status NOT IN ('in_progress', 'done') OR started_at IS NOT NULL),
  CHECK (status <> 'done' OR done_at IS NOT NULL),
  CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL))
);

CREATE INDEX appointments_professional ON appointments (professional_id, status, start_at);
CREATE INDEX appointments_system ON appointments (system_id, start_at);
CREATE INDEX appointments_sale ON appointments (sale_id);

-- AGE-05: sem sobreposição na agenda do profissional; intervalos [início, fim) permitem
-- horários consecutivos. Os dois atendimentos do mesmo par não se comparam entre si (a ordem
-- deles é conferida pela regra do par).
CREATE TRIGGER appointments_no_overlap_insert
BEFORE INSERT ON appointments
WHEN NEW.status IN ('scheduled', 'in_progress') AND EXISTS (
  SELECT 1 FROM appointments a
  WHERE a.professional_id = NEW.professional_id AND a.status IN ('scheduled', 'in_progress')
    AND a.start_at < NEW.end_at AND a.end_at > NEW.start_at
    AND (NEW.pair_id IS NULL OR a.pair_id IS NOT NEW.pair_id))
BEGIN
  SELECT RAISE(ABORT, 'conflito_agenda');
END;

CREATE TRIGGER appointments_no_overlap_update
BEFORE UPDATE OF start_at, end_at, professional_id ON appointments
WHEN NEW.status IN ('scheduled', 'in_progress') AND EXISTS (
  SELECT 1 FROM appointments a
  WHERE a.id <> NEW.id AND a.professional_id = NEW.professional_id
    AND a.status IN ('scheduled', 'in_progress')
    AND a.start_at < NEW.end_at AND a.end_at > NEW.start_at
    AND (NEW.pair_id IS NULL OR a.pair_id IS NOT NEW.pair_id))
BEGIN
  SELECT RAISE(ABORT, 'conflito_agenda');
END;

-- AGE-02 e AGE-04 na criação: o segundo do par tem o mesmo profissional e começa depois do fim
-- do primeiro.
CREATE TRIGGER appointments_pair_insert
BEFORE INSERT ON appointments
WHEN NEW.pair_position = 2 AND NOT EXISTS (
  SELECT 1 FROM appointments f
  WHERE f.pair_id = NEW.pair_id AND f.pair_position = 1 AND f.system_id = NEW.system_id
    AND f.professional_id = NEW.professional_id AND f.end_at <= NEW.start_at)
BEGIN
  SELECT RAISE(ABORT, 'par_incoerente');
END;

-- CAN-07: o vínculo é com venda em rascunho ou concluída, conferido na própria gravação (uma
-- venda cancelada entre a consulta e o INSERT é recusada aqui).
CREATE TRIGGER appointments_sale_open
BEFORE INSERT ON appointments
WHEN NEW.sale_id IS NOT NULL
  AND (SELECT status FROM sales WHERE id = NEW.sale_id) NOT IN ('draft', 'completed')
BEGIN
  SELECT RAISE(ABORT, 'venda_indisponivel');
END;

CREATE TRIGGER appointments_active_refs
BEFORE INSERT ON appointments
WHEN (SELECT status FROM customers WHERE id = NEW.customer_id) IS NOT 'active'
  OR (SELECT status FROM professionals WHERE id = NEW.professional_id) IS NOT 'active'
BEGIN
  SELECT RAISE(ABORT, 'cadastro_inativo');
END;

CREATE TRIGGER appointments_status_transition
BEFORE UPDATE OF status ON appointments
WHEN NEW.status IS NOT OLD.status AND NOT (
  (OLD.status = 'scheduled' AND NEW.status IN ('in_progress', 'cancelled'))
  OR (OLD.status = 'in_progress' AND NEW.status = 'done')
)
BEGIN
  SELECT RAISE(ABORT, 'transicao_de_status_invalida');
END;

-- AGE-07: só atendimento ainda não iniciado é remarcado.
CREATE TRIGGER appointments_reschedule_only_scheduled
BEFORE UPDATE OF start_at, end_at, professional_id ON appointments
WHEN OLD.status <> 'scheduled'
  AND (NEW.start_at <> OLD.start_at OR NEW.end_at <> OLD.end_at OR NEW.professional_id <> OLD.professional_id)
BEGIN
  SELECT RAISE(ABORT, 'atendimento_iniciado');
END;

-- AGE-04: o segundo do par só começa depois de o primeiro ser concluído.
CREATE TRIGGER appointments_second_after_first
BEFORE UPDATE OF status ON appointments
WHEN NEW.status = 'in_progress' AND OLD.status = 'scheduled' AND NEW.pair_position = 2
  AND (SELECT status FROM appointments WHERE pair_id = NEW.pair_id AND pair_position = 1) IS NOT 'done'
BEGIN
  SELECT RAISE(ABORT, 'primeiro_nao_concluido');
END;

-- AGE-09: iniciada a instalação, a retirada é preservada (não é cancelada).
CREATE TRIGGER appointments_preserve_second
BEFORE UPDATE OF status ON appointments
WHEN NEW.status = 'cancelled' AND NEW.pair_position = 2
  AND (SELECT status FROM appointments WHERE pair_id = NEW.pair_id AND pair_position = 1)
      IN ('in_progress', 'done')
BEGIN
  SELECT RAISE(ABORT, 'retirada_preservada');
END;

-- CAN-05: serviço vinculado já iniciado bloqueia o cancelamento da venda; CAN-04: serviços
-- vinculados ainda agendados precisam ser cancelados junto, no mesmo lote (após confirmação).
CREATE TRIGGER sales_cancel_linked_services
BEFORE UPDATE OF status ON sales
WHEN OLD.status = 'completed' AND NEW.status = 'cancelled' AND EXISTS (
  SELECT 1 FROM appointments WHERE sale_id = NEW.id AND status IN ('scheduled', 'in_progress', 'done'))
BEGIN
  SELECT RAISE(ABORT, 'servicos_vinculados');
END;

-- Seção 14: profissional com atendimento pendente não é inativado (transferência é P2).
CREATE TRIGGER professionals_inactivate_without_pending
BEFORE UPDATE OF status ON professionals
WHEN NEW.status = 'inactive' AND OLD.status = 'active' AND EXISTS (
  SELECT 1 FROM appointments WHERE professional_id = NEW.id AND status IN ('scheduled', 'in_progress'))
BEGIN
  SELECT RAISE(ABORT, 'profissional_com_atendimento');
END;
