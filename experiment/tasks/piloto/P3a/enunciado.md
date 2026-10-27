# Tarefa P3a — Produtos abaixo do estoque mínimo

**Tipo:** nova funcionalidade · **Tarefa de PILOTO** (não faz parte da coleta principal)

## Pedido (equipe de compras)

> Queremos uma lista dos produtos que precisam de reposição, começando pelos mais urgentes.

## Especificação

Implemente `produtos_abaixo_do_minimo(conn, minimo_padrao, minimos_por_categoria=None)` em
`loja/estoque.py`. A assinatura já existe e hoje lança `NotImplementedError`.

Regras:
1. Considerar apenas produtos **ativos**.
2. O mínimo de um produto é `minimos_por_categoria[categoria]`, se a categoria estiver no dicionário. Caso contrário, é `minimo_padrao`.
3. Produto sem registro na tabela `estoque` tem saldo **0**.
4. Está abaixo do mínimo quando **saldo < mínimo** (estritamente).
5. Retorno: lista de tuplas `(sku, saldo, minimo)`, ordenada por **déficit** (`minimo − saldo`) decrescente. Em caso de empate, por SKU crescente.
6. Mínimo negativo (padrão ou de qualquer categoria) → `ValueError`.

## Critérios de aceitação

1. O exemplo dos testes públicos funciona.
2. Todas as regras acima são respeitadas. A entrega será avaliada também por cenários adicionais, derivados dessas regras, que não são mostrados.

## Como trabalhar

`exp testar <exec_id>` para os testes públicos e `exp entregar <exec_id>` para entregar. Não altere `testes_publicos/`.
