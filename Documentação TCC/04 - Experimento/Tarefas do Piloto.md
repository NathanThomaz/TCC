---
tipo: experimento
fase: piloto
fonte: experiment/tasks/piloto/; experiment/tasks/README.md
atualizado: 2026-10-28
tags: [tcc, experimento, tarefas, piloto]
---

# Tarefas do Piloto (P1–P4)

Fonte: [experiment/tasks/piloto](https://github.com/NathanThomaz/TCC/tree/main/experiment/tasks/piloto) · formato: [tasks/README.md](https://github.com/NathanThomaz/TCC/blob/main/experiment/tasks/README.md)

- **Públicas** no repositório e escritas pelo Claude (D4). O piloto testa **procedimento e instrumento**; os dados ficam em `data/raw/piloto` e **não entram na análise principal**.
- **Todas as 8 validadas** com `exp validar-tarefa`: estado inicial falha em parte dos ocultos; referência passa 100%.
- Um par por tipo (D9).

## Tipos de tarefa

| Tipo | Descrição | Alvo típico | Referência |
|---|---|---|---|
| T1 | Correção de defeito em regra de negócio | `precos`, `estoque`, `pedidos` | aplicação-base (defeito injetado) |
| T2 | Nova funcionalidade com requisitos especificados | novo módulo/função | `referencia/` obrigatório |
| T3 | Consulta SQL com resultado incorreto | `relatorios` | aplicação-base (defeito injetado) |
| T4 | Robustez da importação (validação, exceções, bordas) | `etl` | `referencia/` ou base |

Refatoração e "escrever testes" ficaram de fora (avaliação objetiva difícil).

## Os 8 pacotes

| Par | Tipo | Tarefa | Título | Módulo | Ocultos (crítico/maior/menor) |
|---|---|---|---|---|---|
| P1 | T1 | **P1a** | Frete grátis concedido indevidamente em pedidos com cupom | `precos.py` | 5 (2/2/1) |
| P1 | T1 | **P1b** | Estoque não é totalmente devolvido ao cancelar pedidos | `pedidos.py` | 5 (1/3/1) |
| P2 | T3 | **P2a** | Relatório de vendas por categoria infla o número de pedidos | `relatorios.py` | 5 (1/3/1) |
| P2 | T3 | **P2b** | Relatório de produtos sem venda omite produtos | `relatorios.py` | 5 (2/2/1) |
| P3 | T2 | **P3a** | Relatório de produtos abaixo do estoque mínimo | `estoque.py` (com `referencia/`) | 6 (1/3/2) |
| P3 | T2 | **P3b** | Resumo de compras do cliente | `pedidos.py` (com `referencia/`) | 6 (1/3/2) |
| P4 | T4 | **P4a** | Importação falha com arquivos exportados pelo Excel (BOM, duplicados, linhas) | `etl.py` (`importar_produtos_csv`) | 6 (2/2/2) |
| P4 | T4 | **P4b** | Preços em formato inválido importados com valor errado | `etl.py` (`preco_br_para_centavos`) | 6 (2/2/2) |

**Atenção ao critério "módulos diferentes":**
- **P4** — gêmeas no mesmo `etl.py` (funções diferentes). Ressalva registrada na D9; avaliar no piloto.
- **P2** — gêmeas também no mesmo `relatorios.py` (`COUNT(*)` vs. `COUNT(DISTINCT)` em vendas por categoria × `LEFT JOIN` incompleto em produtos sem venda). **Essa ressalva não está registrada na D9** → ver [[Inconsistências do Repositório]].

## Formato de cada pacote
```
<ID>/
  task.toml          id, tipo, par, titulo, base, piloto, total_ocultos,
                     [severidade_ocultos], [descricao_ocultos]
  enunciado.md       relato + regras + critérios (tudo o que os ocultos verificam está dito aqui)
  overrides/         arquivos que substituem os da base (estado inicial)
  testes_publicos/   conftest + testes visíveis (caso relatado / caminho feliz)
  testes_ocultos/    conftest + testes de avaliação (bordas das regras escritas)
  referencia/        (opcional) solução de referência
```
Os `conftest.py` são sincronizados a partir de `conftest_comum.py` por `experiment/scripts/sincronizar_conftest.py`.

## Públicos × ocultos
Públicos cobrem o caminho feliz e os critérios explícitos. Ocultos cobrem **bordas dos mesmos requisitos escritos** — não requisitos escondidos (apoio: Liu et al., 2023).

## Equivalência entre gêmeas
Mesmo tipo; mesmo nº de ocultos e severidade (±1); tamanho da referência parecido (±30%); enunciado de extensão parecida; defeitos/funções **diferentes**, idealmente em módulos diferentes.

Relacionadas: [[Plano de Randomização]] · [[Aplicação-base loja]] · [[Tarefas Principais e Selagem]]
