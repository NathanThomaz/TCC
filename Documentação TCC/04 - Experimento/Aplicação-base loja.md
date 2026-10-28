---
tipo: experimento
fonte: experiment/base-system/
atualizado: 2026-10-28
tags: [tcc, experimento, aplicacao-base]
---

# Aplicação-base "loja"

Fonte: [experiment/base-system](https://github.com/NathanThomaz/TCC/tree/main/experiment/base-system)

Aplicação **fictícia** de pedidos e estoque, contexto de todas as tarefas. Python 3.11 + SQLite da biblioteca padrão, sem dependências externas. **16 testes** próprios (`experiment/base-system/tests/test_loja.py`), que rodam junto com o `pytest` do projeto.

> Esta é a versão **pública**, usada na familiarização e no piloto. As tarefas principais usam uma **variante selada** (domínio análogo, código diferente) — decisão D4. Motivo: a base pública tem o código correto, então um defeito injetado nela poderia ser resolvido por comparação.

## Módulos

| Módulo | Responsabilidade | Tarefas-piloto que mexem nele |
|---|---|---|
| `loja/db.py` | Esquema SQLite (clientes, produtos, estoque, cupons, pedidos, itens) e `conectar()` | — |
| `loja/precos.py` | Desconto por quantidade, cupom, frete, arredondamento (regras no cabeçalho) | P1a |
| `loja/estoque.py` | Saldo, reposição, baixa, `EstoqueInsuficiente` | P3a |
| `loja/pedidos.py` | Criação, transições de status, cancelamento com devolução de estoque | P1b, P3b |
| `loja/relatorios.py` | Relatórios SQL: vendas por categoria, top clientes, produtos sem venda | P2a, P2b |
| `loja/etl.py` | Importação de catálogo CSV (preço em formato brasileiro), rejeição por linha | P4a, P4b |
| `loja/exemplo.py` | Dados de exemplo fictícios | — |

## Convenções
- Dinheiro sempre em **centavos inteiros**.
- Datas ISO (`AAAA-MM-DD`).
- Períodos de relatório: início **inclusivo**, fim **exclusivo**.
- Pedidos que contam como venda: `pago`, `enviado`, `entregue`.

## Testes
```bash
python -m pytest experiment/base-system/tests -q
```

## Familiarização (preparação)
Antes da coleta, ler código e documentação **sem tarefas**, e registrar a duração no [[Perfil do Executor#Registro de preparação]]. Ainda **não feita**.

Relacionadas: [[Tarefas do Piloto]] · [[Tarefas Principais e Selagem]]
