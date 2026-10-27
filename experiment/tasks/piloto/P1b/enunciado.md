# Tarefa P1b — Estoque não volta ao cancelar pedidos

**Tipo:** correção de defeito · **Tarefa de PILOTO** (não faz parte da coleta principal)

## Relato do defeito (equipe de logística)

> Cancelamos um pedido de 3 pacotes de café (CAF-001). Antes do pedido havia 50 no
> estoque; depois do cancelamento o sistema mostra 48. As unidades do pedido cancelado
> deveriam voltar todas para o estoque.

## Regras de negócio (vigentes)

- Só podem ser cancelados pedidos com status `pendente` ou `pago` (ver `TRANSICOES` em
  `loja/pedidos.py`).
- Ao cancelar, **todas** as unidades de **todos** os itens voltam ao estoque.
- O cancelamento pode ser feito por `cancelar_pedido` ou por `alterar_status(..., "cancelado")`.

## O que fazer

Corrija o defeito para que o estoque seja restaurado corretamente em qualquer cancelamento válido.

## Critérios de aceitação

1. O caso relatado restaura o estoque para 50 (teste público em `testes_publicos/`).
2. As regras acima continuam válidas.
3. A entrega será avaliada também por cenários de avaliação adicionais, derivados das
   regras acima, que não são mostrados.

## Como trabalhar

- Rode os testes públicos com `exp testar <exec_id>`.
- Entregue com `exp entregar <exec_id>`.
- Não altere os arquivos em `testes_publicos/`.
