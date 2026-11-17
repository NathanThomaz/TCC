-- Regras do financeiro (ADR-015, etapa 2a). Só acrescenta colunas; nada muda nas contas atuais.
-- category: categoria da conta (regra categorias_financeiras); fica NULL nas contas sem ela e
-- nas automáticas (venda a prazo, compra).
-- paid_amount_cents: valor efetivamente recebido ou pago na baixa (com multa e juros por atraso,
-- quando a regra existe). As contas pagas antes desta migration ficam com NULL = o próprio valor.

ALTER TABLE financial_entries ADD COLUMN category TEXT
  CHECK (category IS NULL OR length(category) BETWEEN 2 AND 40);

ALTER TABLE financial_entries ADD COLUMN paid_amount_cents INTEGER
  CHECK (paid_amount_cents IS NULL OR (typeof(paid_amount_cents) = 'integer' AND paid_amount_cents >= 1));
