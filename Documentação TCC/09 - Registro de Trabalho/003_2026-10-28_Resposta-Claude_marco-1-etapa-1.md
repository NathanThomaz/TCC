---
tipo: resposta
autor: Claude
numero: "003"
data: 2026-10-28
assunto: "Marco 1, etapa 1: contrato v0.2 e testes estruturais"
pergunta: "[[003_2026-10-28_Pergunta-Nathan_marco-1-etapa-1]]"
tags: [tcc, registro, resposta]
---

# 003 · Resposta do Claude — Marco 1, etapa 1: contrato v0.2 e testes estruturais

**Pergunta:** [[003_2026-10-28_Pergunta-Nathan_marco-1-etapa-1]]
**Novidades do contrato v0.2:**
**O que mudou no exemplo da padaria:**
**"O contrato é encontrado depois de instalado":**
**Etapa 2: validador semântico e códigos de erro.**

## Resposta enviada (texto integral)

A Etapa 1 do Marco 1 está concluída: o contrato v0.2 existe dentro do pacote `forja`, o exemplo da padaria foi migrado e os testes estruturais passam. Não houve contradição no contrato nem foi preciso mexer no projeto antigo. Paro aqui, como pedido, e aguardo o seu "ok" para a Etapa 2.

## Conferência de escopo
- O projeto antigo (`src/tcc_exp/`, `experiment/` e seus testes) não foi tocado: o `git status` dessas pastas continua vazio.
- Não criei interface, Ollama nem motor de geração.
- Nenhuma dependência nova foi instalada.
- O projeto já estava instalado em modo editável apontando para `src/`, então o pacote novo `forja` passou a ser importável sem reinstalação.

## Arquivos

| Arquivo | Ação | Conteúdo |
|---|---|---|
| [src/forja/__init__.py](src/forja/__init__.py) | criado | Pacote novo, separado do projeto antigo. A descrição declara que só existe o contrato |
| [src/forja/contrato/__init__.py](src/forja/contrato/__init__.py) | criado | `carregar_schema()` lê o contrato como recurso do pacote, o que funciona no repositório e depois de instalado. Devolve uma cópia, para ninguém alterar o original sem querer |
| [src/forja/contrato/mapa-do-sistema.schema.json](src/forja/contrato/mapa-do-sistema.schema.json) | criado (v0.2) | Novidades da v0.2 listadas abaixo da tabela |
| `docs/forja/mapa-do-sistema.schema.json` | removido | Agora existe uma única cópia do contrato (P1) |
| [docs/forja/exemplo-padaria.mapa.json](docs/forja/exemplo-padaria.mapa.json) | migrado à mão | Mudanças listadas abaixo da tabela |
| [pyproject.toml](pyproject.toml) | modificado | Grupo opcional `forja = ["jsonschema>=4.18,<5"]` e inclusão do contrato no pacote. Dependências do projeto antigo intactas |
| [tests/forja/](tests/forja/) | criados | `conftest.py` (fixtures) + `test_estrutural.py` |
| [docs/forja/README.md](docs/forja/README.md) | ajuste mínimo | Novo caminho do contrato + aviso de que o restante do texto ainda descreve a v0.1 |
| Vault | atualizado | Ponto de parada e registro da sessão |

**Novidades do contrato v0.2:**
- ciclo de vida por entidade (estados, transições, `estorna`, `detalhes`);
- `origem` de cada campo, com `calculado` aceito como sinônimo obsoleto e proibido junto com `origem`;
- regras disparadas por `transicoes`, além dos eventos CRUD;
- `para_cada` (regra aplicada a cada item);
- `preparacao` com `forcar`, só nos testes;
- passo de teste do tipo `transicao`;
- `permissoes_transicoes` nos perfis;
- `filtro` no relatório.

**O que mudou no exemplo da padaria:**
- a venda nasce como rascunho; concluir baixa o estoque e soma o fiado; cancelar estorna;
- `saldo_fiado` passou a ter `origem: acao`;
- nova regra: a venda precisa ter ao menos um item para ser concluída;
- painel e relatório consideram só vendas concluídas;
- só a dona pode cancelar;
- 8 testes de aceitação no mapa: os 6 previstos no plano + "rascunho não mexe no estoque" e "estorno do fiado".

## Testes executados (resultados reais)

| Comando | Resultado |
|---|---|
| `python -m pytest tests/forja -q -p no:cacheprovider` | **27 passed** em 0,82 s |
| `python -m pytest -q -p no:cacheprovider` (suíte completa) | **72 passed** em 39,00 s |
| `python -m pytest -q -p no:cacheprovider tests/unit tests/integration experiment/base-system/tests` | **45 passed** em 25,90 s (os 45 antigos) |

Os 27 testes estruturais se dividem assim:
- **3 sobre o próprio contrato:** é um JSON Schema 2020-12 válido; `carregar_schema()` devolve uma cópia; a versão bate com o pacote.
- **3 casos válidos:** a padaria passa; o sinônimo `calculado` é aceito; uma entidade sem ciclo de vida continua válida.
- **21 casos inválidos.** Cada um quebra um único ponto do mapa da padaria e confere que o erro aparece **naquele ponto**. Exemplos: `forcar` fora da preparação, passo de transição sem nome, ciclo de vida sem estado inicial, `origem` desconhecida, `calculado` junto com `origem`, versão 0.1, restrição sem gatilho.

**"O contrato é encontrado depois de instalado":**
- **O wheel normal falhou.** O comando foi `pip wheel . --no-deps --no-build-isolation`, rodado numa cópia do projeto na pasta temporária. O erro foi `invalid command 'bdist_wheel'`: com o setuptools 65.5 da máquina, isso exige o pacote `wheel`, que não está instalado. Não o instalei.
- **Prova equivalente que funcionou:**
  - o `build_py` do setuptools montou a estrutura que vai para dentro do pacote instalado, e o contrato `.schema.json` estava lá;
  - um Python isolado (`python -I`), sem o `src/` do repositório no caminho, importou `forja.contrato` dessa cópia e carregou o contrato v0.2.

## Limitações que permanecem (previstas para as próximas etapas)
- **Por enquanto, só a forma do mapa é validada.** Referências, tipos, ciclos de cálculo e coerência do ciclo de vida dependem do validador semântico (Etapa 2).
- **Datas** declaradas como `date-time` ainda não são conferidas (virá como `DATA_INVALIDA`, na Etapa 2).
- **A versão 0.1** hoje é recusada com o erro genérico do jsonschema. O código `VERSAO_NAO_SUPORTADA`, com mensagem de migração, vem na Etapa 2.
- **Os 8 testes de aceitação do mapa só descrevem comportamento.** Não há motor para executá-los; a estorno e o "cancelar duas vezes" em execução continuam [PLANEJADO].
- **Documentação desatualizada:**
  - o README só recebeu o ajuste de caminho;
  - a seção 4.0 da proposta ainda aponta para o caminho antigo do contrato;
  - os dois serão revisados na etapa de documentação.

## Próxima etapa (aguardando o seu "ok")
**Etapa 2: validador semântico e códigos de erro.**
- **Arquivos:** `src/forja/erros.py`, `caminhos.py`, `estrutural.py`, `semantica.py` e `__main__.py`.
- **Testes:** `tests/forja/test_semantica.py`, `test_ciclo_de_vida.py` e `test_erros.py`, cobrindo cada código de erro da seção 5 do plano.

Nada foi commitado.

---

## Registro técnico
- **Comandos de verificação da instalação:**
  - `pip wheel . --no-deps --no-build-isolation` → falhou (`bdist_wheel`, falta o pacote `wheel`);
  - `python -c "from setuptools import setup; setup()" build_py --build-lib <tmp>` → copiou `forja/contrato/mapa-do-sistema.schema.json`;
  - `python -I` com só a cópia no caminho → `forja vem do repositorio? False`, schema 0.2 carregado.
- **Nota:** na primeira tentativa, a checagem "repositório no caminho?" deu um falso positivo, porque o nome da pasta temporária contém "Documents-TCC". Foi refeita de forma exata.
