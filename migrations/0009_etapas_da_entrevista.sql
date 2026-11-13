-- Migration 0009: etapas novas da entrevista guiada (pedido do dono, 2026-11-13): vendas e
-- pagamentos, módulos extras, regras do negócio e revisão final. A coluna topic (0006) aceita só
-- os seis assuntos originais por CHECK; mudar o CHECK exigiria refazer a tabela. A etapa passa a
-- ficar em stage, e topic recebe o assunto original equivalente (para relatórios antigos).
ALTER TABLE requirements ADD COLUMN stage TEXT CHECK (stage IS NULL OR stage IN
  ('negocio', 'produtos_precos', 'pedidos_estoque', 'vendas_pagamentos', 'clientes',
   'atendimentos', 'modulos_extras', 'regras', 'aparencia', 'revisao'));
