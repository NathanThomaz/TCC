---
tipo: resposta
autor: Claude
numero: "005"
data: 2026-10-28
assunto: "Marco 1, etapa 2: validador semântico"
pergunta: "[[005_2026-10-28_Pergunta-Nathan_marco-1-etapa-2]]"
tags: [tcc, registro, resposta]
---

# 005 · Resposta do Claude — Marco 1, etapa 2: validador semântico

**Pergunta:** [[005_2026-10-28_Pergunta-Nathan_marco-1-etapa-2]]
**Branch:** `forja-marco-1`. **Sem commit nem push:** aguardando revisão, como pedido.
**Registro:** criei a [entrada 005](docs/registro-de-trabalho/005-marco-1-etapa-2.md), atualizei o índice e o vault.
**Para seguir:** com a sua aprovação, faço o commit e o push na `forja-marco-1`. Em seguida vem a etapa de documentação do Marco 1, que fecha as pendências acima.
**Conferência inicial:**
**Arquivos:**
**Comandos e resultados:**
**Teste de mutação:**
**Cobertura do catálogo:** busca nos arquivos de teste: nenhum código ficou sem teste.
**Incidente (não é defeito do validador):** um script de exibição falhou ao imprimir "→" num terminal cp1252; foi refeito com `PYTHONIOENCODING=utf-8`.

## Resposta enviada (texto integral)

A Etapa 2 do Marco 1 está pronta: o validador semântico funciona e todos os testes passam. Como você pediu, não fiz commit nem push; os arquivos estão só na sua máquina, na branch `forja-marco-1`, aguardando sua revisão.

## Conferência inicial
Não encontrei contradição com as decisões aprovadas. Houve três ajustes pequenos, sem mudar decisão nem escopo:
- **Códigos que só apareciam em outras seções do plano.** Três códigos citados no plano (P2, P3 e a migração da versão) estavam fora da tabela de códigos. Entraram no catálogo.
- **Dois códigos novos** para verificações que o plano previa sem código: "agregação sem o valor a agregar" e "teste usando um registro de outra entidade".
- **Um arquivo a mais**, `validacao.py`, que junta as duas etapas. Assim, ler o contrato continua sem exigir o `jsonschema`.

## O que foi implementado (em `src/forja/`)

| Arquivo | Papel |
|---|---|
| [erros.py](src/forja/erros.py) | Formato do erro (código, caminho, mensagem, severidade, camada, detalhes) e catálogo de **48 códigos**, sendo 4 avisos. Código fora do catálogo é recusado. Ordem determinística, com `/regras/2` antes de `/regras/10` |
| [caminhos.py](src/forja/caminhos.py) | Percorre caminhos como `produto.estoque` pelos relacionamentos e sugere nomes parecidos quando um não existe |
| [estrutural.py](src/forja/estrutural.py) | Confere a forma: versão do mapa (com mensagem de migração) e o contrato JSON Schema |
| [semantica.py](src/forja/semantica.py) | Confere o sentido do mapa (lista abaixo da tabela) |
| [validacao.py](src/forja/validacao.py) | Roda as duas etapas. Se a forma falhar, a segunda nem roda, para não gerar erros em cascata |
| [__main__.py](src/forja/__main__.py) | Comando `python -m forja validar <mapa> [--json]`, que termina com código 0 (válido), 1 (com erros) ou 2 (arquivo ilegível) |

O que a parte semântica confere:
- referências e tipos;
- cálculos sem regra, duplicados ou em círculo;
- ações que alteram campos protegidos;
- regras duplicadas;
- ciclo de vida: estados, transições, estorno, exclusão;
- telas e perfis;
- testes de aceitação.

As expressões nunca são executadas: um teste varre o código e confirma que não existe `eval` nem nada parecido.

## Testes (resultados reais)

| O que rodei | Resultado |
|---|---|
| `python -m forja validar` no mapa da padaria | **0 erros, 0 avisos**, código de saída 0 |
| Testes da Forja (`tests/forja`) | **111 passaram** (27 de forma, 54 de sentido, 17 de ciclo de vida, 13 de formato e comando) |
| Suíte completa | **156 passaram** |
| Só os 45 do projeto antigo | **45 passaram** (`src/tcc_exp`, `experiment` e `main` não foram tocados) |

- **Os 48 códigos aparecem nos testes.** Cada caso de erro quebra um único ponto do mapa da padaria e confere o código e o endereço exato do erro.
- **Os testes realmente detectam falhas.** Numa cópia temporária do código, desliguei de propósito duas verificações (cálculos em círculo e ação que altera campo calculado). Exatamente os 4 testes correspondentes falharam.
- **Exemplo real de saída**, com dois defeitos inseridos de propósito na padaria:
  ```
  ERRO  REF_CAMPO_INEXISTENTE   /regras/1/condicao/dir/campo  O caminho 'produto.estoqe' não existe ...
  ERRO  CICLO_DE_CALCULO        /regras/2/expressao  Cálculos em círculo: item_venda.subtotal → venda.total → item_venda.subtotal.
  ```

## Limitações que continuam (também registradas em [validacao.md](docs/forja/validacao.md))
- Nos erros de forma, o resumo está em português, mas o detalhe técnico vem do `jsonschema` em inglês.
- O tipo dos valores em `padrao` e nos dados dos testes não é conferido, exceto listas de opções e datas. Um preço `"abc"` passaria.
- O comportamento em execução (estorno real, cancelar só uma vez, "tudo ou nada") só pode ser testado quando o motor de geração existir. Hoje só se confere que o mapa descreve isso corretamente.
- **Documentação ainda pendente:**
  - `ciclo-de-vida.md` ainda não existe;
  - o README de `docs/forja` ainda tem trechos da versão antiga do contrato;
  - a seção 4.0 da proposta aponta para o caminho antigo do contrato.

**Registro:** criei a [entrada 005](docs/registro-de-trabalho/005-marco-1-etapa-2.md), atualizei o índice e o vault.

**Para seguir:** com a sua aprovação, faço o commit e o push na `forja-marco-1`. Em seguida vem a etapa de documentação do Marco 1, que fecha as pendências acima.

> **Nota de controle (entrada 008):** o link da "entrada 005" acima usava o nome antigo do arquivo; ele agora segue o padrão `NNN_AAAA-MM-DD_assunto.md`.

---

## Registro técnico

**Conferência inicial:**
- branch `forja-marco-1`; `main` em `d092da9` (intocada);
- 27 testes estruturais passando antes de começar.

**Arquivos:**

| Arquivo | Ação |
|---|---|
| `src/forja/erros.py`, `caminhos.py`, `estrutural.py`, `semantica.py`, `validacao.py`, `__main__.py` | criados |
| `tests/forja/conftest.py` | modificado: `resolver_ponteiro()` e `validar_e_conferir()` conferem, em todo resultado, catálogo, severidade, caminho existente, ordem e determinismo |
| `tests/forja/test_semantica.py` (54), `test_ciclo_de_vida.py` (17), `test_erros.py` (13) | criados |
| `docs/forja/validacao.md` | criado: catálogo gerado a partir do código |
| `docs/forja/README.md` | aviso de status atualizado |

**Comandos e resultados:**

| Comando | Resultado |
|---|---|
| `python -m forja validar docs/forja/exemplo-padaria.mapa.json` | `VÁLIDO: 0 erro(s), 0 aviso(s).`, saída 0 |
| `python -m pytest tests/forja -q -p no:cacheprovider` | 111 passed em 6,56 s |
| `python -m pytest -q -p no:cacheprovider` | 156 passed em 32,65 s |
| `python -m pytest -q -p no:cacheprovider tests/unit tests/integration experiment/base-system/tests` | 45 passed em 25,77 s |

**Teste de mutação:**
- feito numa cópia temporária: detecção de ciclos desligada e `ACAO_ALTERA_CALCULADO` desligada;
- resultado: **4 failed, 107 passed**, exatamente os testes esperados.

**Cobertura do catálogo:** busca nos arquivos de teste: nenhum código ficou sem teste.

**Incidente (não é defeito do validador):** um script de exibição falhou ao imprimir "→" num terminal cp1252; foi refeito com `PYTHONIOENCODING=utf-8`.
