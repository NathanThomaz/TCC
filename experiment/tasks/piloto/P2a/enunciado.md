# Tarefa P2a — Número de pedidos inflado no relatório por categoria

**Tipo:** consulta SQL incorreta · **Tarefa de PILOTO** (não faz parte da coleta principal)

## Relato do defeito (gerência comercial)

> No relatório de vendas por categoria de fevereiro, "mercearia" aparece com 2 pedidos.
> Só existe 1 pedido com produtos de mercearia nesse mês (um café e um chá no mesmo pedido).

## Regras do relatório (vigentes)

As convenções estão no cabeçalho de `loja/relatorios.py`. Para `vendas_por_categoria`:
- receita = soma de quantidade × preço unitário dos itens vendidos;
- nº de pedidos = quantidade de pedidos **distintos** que tiveram ao menos um item da categoria;
- só contam pedidos `pago`, `enviado` ou `entregue`;
- período com início inclusivo e fim exclusivo.

## O que fazer

Corrija o relatório para que respeite todas as regras acima.

## Critérios de aceitação

1. O caso relatado mostra 1 pedido em "mercearia" (teste público em `testes_publicos/`).
2. As demais regras continuam válidas.
3. A entrega será avaliada também por cenários de avaliação adicionais, derivados das
   regras acima, que não são mostrados.

## Como trabalhar

- Rode os testes públicos com `exp testar <exec_id>`.
- Entregue com `exp entregar <exec_id>`.
- Não altere os arquivos em `testes_publicos/`.
