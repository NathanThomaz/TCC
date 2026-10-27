# Aplicação-base "loja"

Aplicação fictícia de pedidos e estoque usada como contexto das tarefas. Está escrita em Python 3.11 e usa SQLite pela biblioteca padrão, sem dependências externas.

> Esta é a versão **pública**, usada na familiarização e no piloto. As tarefas da coleta principal usam uma variante selada (ver `../tasks/README.md`).

## Módulos

| Módulo | Responsabilidade |
|---|---|
| `loja/db.py` | Esquema SQLite (clientes, produtos, estoque, cupons, pedidos, itens) e `conectar()` |
| `loja/precos.py` | Desconto por quantidade, cupom, frete e arredondamento (regras no cabeçalho) |
| `loja/estoque.py` | Saldo, reposição, baixa e `EstoqueInsuficiente` |
| `loja/pedidos.py` | Criação, transições de status e cancelamento (com devolução de estoque) |
| `loja/relatorios.py` | Relatórios em SQL: vendas por categoria, top clientes, produtos sem venda |
| `loja/etl.py` | Importação de catálogo CSV (preço em formato brasileiro) com rejeição por linha |
| `loja/exemplo.py` | Dados de exemplo fictícios |

## Convenções

- Dinheiro sempre em **centavos inteiros**.
- Datas em ISO (`AAAA-MM-DD`).
- Períodos de relatório: início inclusivo e fim exclusivo.
- Pedidos que contam como venda: `pago`, `enviado` e `entregue`.

## Testes

```bash
python -m pytest experiment/base-system/tests -q
```
