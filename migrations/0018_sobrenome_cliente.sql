-- Sobrenome do cliente em campo próprio (pedido do dono, 2026-11-17). Aditiva: os clientes que já
-- existem ficam sem sobrenome; o nome completo é name + ' ' + surname (nomeClienteSql no Worker).
ALTER TABLE customers ADD COLUMN surname TEXT CHECK (surname IS NULL OR length(surname) BETWEEN 1 AND 120);
