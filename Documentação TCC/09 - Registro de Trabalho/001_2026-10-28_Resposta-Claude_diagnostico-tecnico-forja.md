---
tipo: resposta
autor: Claude
numero: "001"
data: 2026-10-28
assunto: "Diagnóstico técnico do projeto Forja"
pergunta: "[[001_2026-10-28_Pergunta-Nathan_diagnostico-tecnico-forja]]"
tags: [tcc, registro, resposta]
---

# 001 · Resposta do Claude — Diagnóstico técnico do projeto Forja

**Pergunta:** [[001_2026-10-28_Pergunta-Nathan_diagnostico-tecnico-forja]]
**Tipo:** revisão técnica, somente leitura (nenhum arquivo alterado, nada instalado, nenhum commit)
**Verificações que rodei:**
**A Forja ainda não tem nenhuma implementação.** [VERIFICADO] Uma busca por `forja`, `ollama`, `fastapi`, `jinja` e `mapa-do-sistema` em `.py`, `.toml`, `.js` e `.html` não encontrou nada.
**Itens fora do git:**
**Implementado [VERIFICADO no código; fluxo coberto por `tests/integration/test_fluxo_cli.py`]:** o instrumento do experimento antigo.
**Forja [PLANEJADO]** (`docs/proposta-v2-gerador-de-sistemas.md`, §3–4):
**Questões de semântica ainda em aberto** (`docs/forja/README.md`):
**Pelo `tcc_exp` (projeto antigo):**
**Pela Forja:** nenhum artefato. As duas apresentações `.pptx` foram geradas por um script que ficou **fora do repositório** (pasta temporária da sessão), então hoje não são reproduzíveis a partir do repo.
**Fora da lista, mas recomendado antes de qualquer commit:**

## Resposta enviada (texto integral)

Escrito para: os participantes da revisão técnica conjunta da Forja.

# Diagnóstico técnico do projeto Forja (28/10/2026)

Respeitei as restrições da revisão: nenhum arquivo alterado, nenhuma dependência instalada, nenhum commit.

**Verificações que rodei:**
- `git status`;
- busca no código;
- `pytest` sem gravar cache;
- validação do mapa feita só em memória;
- `exp verificar-ambiente`.

O `git status` ficou idêntico antes e depois. Pela mesma restrição, também não atualizei o vault nem a memória.

Legenda:
- **[VERIFICADO]**: executado ou inspecionado nesta revisão;
- **[DOCUMENTADO]**: afirmado nos documentos, não reexecutado agora;
- **[PLANEJADO]**: só intenção.

## Conclusão central
**A Forja ainda não tem nenhuma implementação.** [VERIFICADO] Uma busca por `forja`, `ollama`, `fastapi`, `jinja` e `mapa-do-sistema` em `.py`, `.toml`, `.js` e `.html` não encontrou nada.

O que existe da Forja:
- o contrato do mapa (JSON Schema) e um mapa de exemplo escrito à mão;
- documentos: proposta, README e apresentações.

Todo o código do repositório pertence ao **projeto anterior**: o instrumento `tcc_exp` do experimento N-de-1 (v0.1, hoje suspenso) e a aplicação-base `loja`.

## 1. Árvore de diretórios
```
TCC/
├─ Documentação TCC/          vault Obsidian (não versionado)
├─ data/                      só README (nenhum dado coletado)
├─ docs/                      planejamento v0.1 + proposta v2
│  └─ forja/                  ★ Forja: schema + exemplo + README (não versionado)
├─ experiment/                material do experimento v0.1
│  ├─ base-system/loja/       aplicação-base (Python + SQLite) + tests/
│  ├─ config/  randomization/  scripts/
│  └─ tasks/piloto/P1a…P4b/   8 pacotes de tarefa
├─ pesquisa/                  referências verificadas, estratégia, .bib
├─ src/tcc_exp/               instrumento v0.1 (CLI exp) + analise/
├─ tests/                     unit/, integration/, fixtures/
└─ thesis/                    capítulos + apresentacao/ (2 .pptx da v2)
```
[VERIFICADO]

**Itens fora do git:**
- `Documentação TCC/`;
- `docs/forja/`;
- `docs/proposta-v2-gerador-de-sistemas.md`;
- os dois `.pptx` da v2;
- `thesis/apresentacao/~$proposta-v2-forja-rev3.pptx`, um arquivo de bloqueio do PowerPoint. Ele indica que a rev3 está aberta neste momento.

O último commit continua sendo `d092da9` (D3 do projeto antigo).

## 2. Tecnologias

| Camada | Implementado [VERIFICADO] | Planejado para a Forja [PLANEJADO] |
|---|---|---|
| Frontend | Não há aplicação web. Existe só o dashboard HTML estático com SVG inline (`src/tcc_exp/analise/dashboard.py`) | Painel web local no navegador |
| Backend | CLI Python com argparse (`src/tcc_exp/cli.py`) | Servidor local com FastAPI |
| Persistência | JSONL somente-acréscimo com cadeia SHA-256 (`eventos.py`); CSV (`pipeline.py`); SQLite via `sqlite3` da biblioteca padrão, só na `loja` (`experiment/base-system/loja/db.py`) | SQLite nos sistemas gerados; mapa em JSON versionado |
| Geração de sistemas | Nenhuma | Motor por templates (Jinja2) + empacotamento em executável |
| IA | Nenhuma chamada. `src/tcc_exp/ia.py` só **registra** metadados da ferramenta do experimento antigo | Ollama + modelo aberto local |
| Dependências declaradas | numpy, pandas, scipy, matplotlib; pytest (dev); ruff e radon (opcional `estatica`, **não instalados**) (`pyproject.toml`) | `jsonschema` foi usado na validação, mas **não está declarado** no `pyproject.toml`; está instalado globalmente (4.24.0) |

## 3. Arquitetura implementada e fluxo de execução
**Implementado [VERIFICADO no código; fluxo coberto por `tests/integration/test_fluxo_cli.py`]:** o instrumento do experimento antigo.
```
exp sortear → plano CSV + sha256 (sorteio.py)
exp abrir → workspace git a partir do pacote de tarefa (tarefas.py, workspace.py)
exp iniciar/testar/entregar → eventos JSONL com hash (eventos.py, sessao.py)
   entregar → pytest dos testes ocultos + JUnit (avaliacao.py) → devolutiva
exp processar → execucoes.csv (metricas.py, analise/pipeline.py)
exp analisar → tabelas, figuras, relatório (estatistica.py, graficos.py)
exp dashboard → dashboard.html (analise/dashboard.py)
```

**Forja [PLANEJADO]** (`docs/proposta-v2-gerador-de-sistemas.md`, §3–4):
```
conversa → IA local → mapa → validador → motor de templates → sistema → pacote offline
```
Nenhuma dessas peças existe, exceto o **formato** do mapa.

## 4. O que funciona, o que é parcial e o que é só planejado

| Item | Situação | Evidência |
|---|---|---|
| Instrumento `tcc_exp` (projeto antigo) | **Funciona** | 45 testes passaram agora |
| Aplicação `loja` | **Funciona** | 16 dos 45 testes (`experiment/base-system/tests/test_loja.py`) |
| 8 tarefas-piloto validadas | Funciona | [DOCUMENTADO] em CHANGELOG/README; `exp validar-tarefa` não foi reexecutado nesta revisão |
| Contrato do mapa (forma) | **Funciona** | Schema válido (Draft 2020-12) e exemplo válido [VERIFICADO agora, em memória] |
| Contrato do mapa (coerência) | **Parcial** | O schema **aceita** uma regra apontando para entidade e campo inexistentes [VERIFICADO agora]. Não há validador semântico |
| Validação reprodutível | **Parcial** | Não há script nem teste da validação no repositório. As validações de 28/10 e de agora foram comandos avulsos |
| Interpretação por IA, modo guiado, motor, templates, painel, documentação gerada, layout, empacotamento, prova offline | **Só planejado** | Nenhum arquivo correspondente existe |
| Avaliação técnica e com usuários da Forja | Só planejado | Proposta §5 |

## 5. Como o mapa é representado
- **Formato:** JSON validado por `docs/forja/mapa-do-sistema.schema.json`. Seções: `metadados`, `negocio`, `entidades`, `relacionamentos`, `regras` (restricao, calculo, acao, com expressões em árvore), `telas`, `perfis`, `testes_aceitacao`, `tema`. [VERIFICADO]
- **Não existe nenhuma saída real gerada.** O único mapa é `docs/forja/exemplo-padaria.mapa.json`, **escrito à mão**.
- **Conteúdo do exemplo** [VERIFICADO]:
  - 5 entidades: cliente, produto, venda, item_venda, encomenda;
  - 4 relacionamentos;
  - 7 regras: 3 restrições, 2 cálculos, 2 ações;
  - 6 telas;
  - 2 perfis;
  - 3 testes de aceitação.

Trecho real do arquivo:
```json
{ "id": "r_estoque_suficiente", "tipo": "restricao", "entidade": "item_venda",
  "eventos": ["criar", "editar"],
  "condicao": { "comparar": "<=", "esq": { "campo": "quantidade" }, "dir": { "campo": "produto.estoque" } },
  "mensagem": "Estoque insuficiente para este produto." }
```

**Questões de semântica ainda em aberto** (`docs/forja/README.md`):
- falta um evento "confirmar" para venda com itens;
- o comportamento de ações na edição não está definido;
- não está decidido se testes podem semear campos calculados.

## 6. Interpretação por IA, modo guiado, templates e validação
- **Interpretação por IA:** não implementada. Não há cliente Ollama, prompt nem conversão de texto em mapa. `src/tcc_exp/ia.py` é de outra coisa: registra a ferramenta do experimento antigo e não chama IA.
- **Modo guiado:** não implementado. Não há formulários nem interface.
- **Templates:** não existem.
- **Validação:** existe só a do schema (forma), e sem script versionado. O validador semântico, a confirmação por exemplos e a rejeição de saídas da IA são [PLANEJADO] (proposta §4.0).

## 7. Artefatos que o sistema gera hoje
**Pelo `tcc_exp` (projeto antigo):**
- plano de sorteio (CSV + sha256);
- selos de tarefas;
- workspaces git;
- eventos JSONL;
- `execucoes.csv` e `integridade.json`;
- tabelas, figuras PNG e `relatorio-experimento.md`;
- `dashboard.html`.

Os testes de integração exercitam esses artefatos [VERIFICADO]. A demonstração sintética em `../tcc-demo/` existe, mas não foi regenerada agora.

**Pela Forja:** nenhum artefato. As duas apresentações `.pptx` foram geradas por um script que ficou **fora do repositório** (pasta temporária da sessão), então hoje não são reproduzíveis a partir do repo.

## 8. Testes e resultados reais
Executado agora com `python -m pytest -q -p no:cacheprovider`: **45 passed em 27,18 s**.

| Arquivo | Testes |
|---|---|
| `experiment/base-system/tests/test_loja.py` | 16 |
| `tests/unit/test_estatistica.py` | 7 |
| `tests/integration/test_dashboard.py` | 6 |
| `tests/unit/test_eventos_sessao.py` | 5 |
| `tests/unit/test_sorteio_ia.py` | 4 |
| `tests/unit/test_metricas.py` | 3 |
| `tests/integration/test_fluxo_cli.py` | 2 |
| `tests/integration/test_pipeline_sintetico.py` | 2 |

- **Nenhum teste cobre a Forja**, nem mesmo o schema.
- `exp verificar-ambiente`:
  - ruff e radon ausentes;
  - a "Ferramenta de IA não configurada" se refere ao projeto antigo.

## 9. Riscos técnicos, limitações e divergências
1. **Documentos à frente do código.**
   - Proposta e slides descrevem 7 etapas, painel, motor e prova offline, e nada disso existe.
   - O "Validado" do slide 11 vale **só para a forma do mapa**.
   - Risco de passar à banca ou ao orientador a impressão de um protótipo.
2. **Dois projetos misturados no mesmo repositório.**
   - README, `gestao-projeto.md` e `decisoes-metodologicas.md` ainda descrevem a v0.1.
   - A v2 está toda fora do git e **não foi aprovada** pelo orientador.
   - Nenhuma decisão D0–D17 da v2 foi registrada.
3. **Lacuna semântica do contrato (verificada).**
   - O schema aceita referências inexistentes.
   - As expressões precisam de um avaliador seguro (sem `eval`) que gere SQL ou Python, e ele não existe.
   - Três pontos de semântica continuam abertos (seção 5).
4. **Validação não reprodutível.** `jsonschema` fora do `pyproject.toml`; nenhum script ou teste da validação no repo.
5. **Offline não comprovado.**
   - A forma de empacotamento não foi escolhida nem testada.
   - O Windows Sandbox não está ativado (precisa de administrador).
   - Nada roda ainda numa máquina limpa.
6. **IA local não testada.**
   - Ollama não instalado; nenhum modelo avaliado.
   - O desempenho sem GPU é desconhecido; a meta de 16 GB é suposição.
   - Não se sabe se um modelo local pequeno produz mapas que passam no schema. Esse é o maior risco técnico da proposta.
7. **O isolamento do efeito da IA depende de uma interface que não existe.** O modo guiado e o modo com IA precisam compartilhar os mesmos formulários. A interface tem que ser desenhada com esse requisito desde o início.
8. **Reaproveitamento é intenção, não fato.** `avaliacao.py`, `tarefas.py` e `pipeline.py` estão acoplados ao formato de tarefas e eventos do experimento antigo. Usá-los na Forja exige adaptação.
9. **Higiene do repositório (público).**
   - Dois `.pptx` (o antigo e a rev3).
   - Arquivo de bloqueio `~$…pptx` sem regra no `.gitignore`, com risco de ser commitado.
   - Vault dentro do repo.
   - Trabalho do dia inteiro sem commit.
10. **Escopo vs. prazo.** "Sistema completo", avaliação em duas frentes e CEP, com prazo e orientador ainda desconhecidos (D7).

## 10. Próximos cinco passos (por prioridade e dependência)
1. **Aval do orientador e prazo (D7).** Apresentar a proposta deixando explícito que **nada está implementado**. Tudo o que vem abaixo depende desse aval e do prazo. Em paralelo: consultar o CEP.
2. **Fechar o contrato como código testável.** Depende de 1.
   - Declarar `jsonschema` no `pyproject.toml`.
   - Criar o validador semântico.
   - Escrever testes pytest positivos e negativos (incluindo o caso de referência inexistente encontrado aqui).
   - Decidir os três pontos de semântica abertos.
   - Passar o exemplo da padaria pelo validador completo.
3. **Experimento rápido de IA local.** Depende de 2; pode correr junto com o passo 4.
   - Instalar o Ollama e testar 2 ou 3 modelos, com e sem GPU.
   - Medir quantos mapas válidos cada um produz a partir de um roteiro do dono da padaria, e em quanto tempo.
   - É o teste de viabilidade do risco 6. Se a taxa de mapas válidos for baixa, a arquitetura precisa mudar cedo.
4. **Motor mínimo, sem IA.** Depende de 2.
   - Gerar a partir do mapa da padaria um sistema com CRUD, uma venda com itens e uma regra de cada tipo, com as expressões traduzidas sem `eval`.
   - Os 3 testes de aceitação do mapa devem rodar contra o sistema gerado.
5. **Portão offline G1.** Depende de 4.
   - Escolher e testar o empacotamento.
   - Ativar o Windows Sandbox e rodar o checklist de 12 itens sem rede.
   - Registrar o resultado em `docs/forja/prova-offline.md`.
   - Só depois disso começar as etapas com IA e o painel.

**Fora da lista, mas recomendado antes de qualquer commit:**
- adicionar `~$*` ao `.gitignore` e manter só a rev3 da apresentação;
- versionar o script que gera os slides;
- separar no repositório o que é v0.1 (suspenso) e o que é v2.

---

## Registro técnico
- **Verificações executadas:**
  - `git status`, que ficou idêntico antes e depois;
  - busca por código da Forja;
  - `pytest` sem gravar cache: 45 passed;
  - validação do mapa em memória;
  - `exp verificar-ambiente`.
- **Arquivos:** nenhum alterado. Esta entrada foi gravada depois (entrada 004) e reescrita com a pergunta e a resposta integrais na entrada 008.
- **Pendências geradas:** viraram o Marco 1 (entradas 002 e 003).
