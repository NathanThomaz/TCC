# Tarefa P3b — Resumo de compras do cliente

**Tipo:** nova funcionalidade · **Tarefa de PILOTO** (não faz parte da coleta principal)

## Pedido (atendimento)

> Quando um cliente liga, queremos ver rapidamente o quanto ele já comprou.

## Especificação

Implemente `resumo_cliente(conn, cliente_id)` em `loja/pedidos.py`. A assinatura já existe e hoje lança `NotImplementedError`. A função retorna um `dict` com:

| Chave | Valor |
|---|---|
| `n_pedidos` | quantidade de pedidos de venda do cliente |
| `total_gasto_centavos` | soma de `total_centavos` desses pedidos |
| `ticket_medio_centavos` | total ÷ n, arredondado em centavos com **meio para cima** (0 se não houver pedidos) |
| `ultimo_pedido` | data ISO (`criado_em`) do pedido de venda mais recente, ou `None` |
| `produto_favorito` | SKU com mais **unidades** compradas em pedidos de venda. Empate: menor SKU. Sem compras: `None` |

Regras:
1. Pedidos de venda são os com status `pago`, `enviado` ou `entregue`. Os demais são ignorados em **todos** os campos.
2. Cliente inexistente → `ErroPedido`.

## Critérios de aceitação

1. O exemplo dos testes públicos funciona.
2. Todas as regras acima são respeitadas. A entrega será avaliada também por cenários adicionais, derivados dessas regras, que não são mostrados.

## Como trabalhar

`exp testar <exec_id>` para os testes públicos e `exp entregar <exec_id>` para entregar. Não altere `testes_publicos/`.
