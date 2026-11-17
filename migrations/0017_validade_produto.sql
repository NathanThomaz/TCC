-- Validade do produto (regra validade_produto, ADR-015 etapa 2b). Só acrescenta a coluna; os
-- produtos atuais ficam sem validade (NULL). Data local AAAA-MM-DD, como os vencimentos.

ALTER TABLE products ADD COLUMN expires_on TEXT
  CHECK (expires_on IS NULL OR expires_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]');
