-- Migration 0010: cadastro aberto e limite de IA por conta (pedido do dono, 2026-11-14).
-- Aditiva: só colunas novas em users.

-- Quem criou a própria conta pela tela de entrada (cadastro aberto, e-mail confirmado).
ALTER TABLE users ADD COLUMN self_signup INTEGER NOT NULL DEFAULT 0 CHECK (self_signup IN (0, 1));

-- Limite mensal de IA da conta (administrador e suas contas secundárias), em centavos.
-- NULL = o padrão do Nexus (IA_LIMITE_CONTA_CENTAVOS); o dono do Nexus não tem limite por conta.
ALTER TABLE users ADD COLUMN ai_limit_cents INTEGER CHECK (ai_limit_cents IS NULL
  OR (typeof(ai_limit_cents) = 'integer' AND ai_limit_cents BETWEEN 0 AND 100000));
