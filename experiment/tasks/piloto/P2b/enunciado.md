# Tarefa P2b — Relatório de produtos sem venda incompleto

**Tipo:** consulta SQL incorreta · **Tarefa de PILOTO** (não faz parte da coleta principal)

## Relato do defeito (compras)

> O chá verde (CHA-002) teve um único pedido em fevereiro, e esse pedido foi cancelado.
> Mesmo assim, ele não aparece no relatório de "produtos sem venda" de fevereiro, e por
> isso não entrou na lista de itens para promoção.

## Regras do relatório (vigentes)

As convenções estão no cabeçalho de `loja/relatorios.py`. Para `produtos_sem_venda`:
- lista os SKUs de produtos **ativos** sem nenhuma unidade **vendida** no período;
- "vendida" significa pedido com status `pago`, `enviado` ou `entregue`;
- período com início inclusivo e fim exclusivo;
- resultado em ordem alfabética de SKU.

## O que fazer

Corrija o relatório para que respeite todas as regras acima.

## Critérios de aceitação

1. O caso relatado passa a listar CHA-002 (teste público em `testes_publicos/`).
2. As demais regras continuam válidas.
3. A entrega será avaliada também por cenários de avaliação adicionais, derivados das
   regras acima, que não são mostrados.

## Como trabalhar

- Rode os testes públicos com `exp testar <exec_id>`.
- Entregue com `exp entregar <exec_id>`.
- Não altere os arquivos em `testes_publicos/`.
