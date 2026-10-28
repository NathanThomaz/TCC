---
tipo: instrumento
fonte: src/tcc_exp/; tests/; pyproject.toml
atualizado: 2026-10-28
tags: [tcc, instrumento, codigo]
---

# Instrumento `tcc_exp`

Fonte: [src/tcc_exp](https://github.com/NathanThomaz/TCC/tree/main/src/tcc_exp) · pacote `tcc-exp` (pyproject `version = "0.1.0"`; CHANGELOG está em 0.2.0 — ver [[Inconsistências do Repositório]])

Instrumento de coleta e análise. Registra eventos, versiona o código produzido, executa testes e calcula métricas. **Não chama nenhuma API de IA e nunca gera dados de execução**: tudo em `data/raw/` vem de uma sessão real.

## Instalação e verificação
```bash
pip install -e ".[dev,estatica]"   # dev = pytest; estatica = ruff + radon
exp verificar-ambiente
python -m pytest                   # instrumento + aplicação-base
```
Requisitos: Python ≥ 3.11 e git. Dependências: numpy, pandas, scipy, matplotlib. O comando `exp` também roda como `python -m tcc_exp`.

**Verificado em 28/10/2026:** 45 testes passando; ruff e radon **não instalados** (as métricas estáticas sairiam "indisponível").

## Módulos

| Módulo | Função |
|---|---|
| `cli.py` | CLI `exp` (ver [[Comandos da CLI exp]]) |
| `config.py` | Diretórios e leitura de `experimento.toml` e `.env` |
| `eventos.py` | JSONL **somente-acréscimo** com **cadeia de hash** (cada linha guarda o SHA-256 da anterior; `verificar_cadeia` detecta edição) |
| `sessao.py` | Máquina de estados da execução e tempo ativo; estado sempre reconstruído dos eventos (nada escondido fora de `data/raw`) |
| `workspace.py` | Workspace de cada execução versionado com git (snapshot por evento) |
| `tarefas.py` | Manifesto, verificação de integridade/selo e montagem do workspace |
| `avaliacao.py` | Roda pytest (públicos e ocultos) e lê JUnit XML; força UTF-8 (correção do Windows) |
| `analise_estatica.py` | ruff + radon; se ausentes, diz "indisponível" (não inventa valor) |
| `metricas.py` | Métricas por execução (espelha [[Métricas]]) |
| `ia.py` | Adaptador **de registro** da condição de IA (não chama fornecedor) |
| `sorteio.py` | Plano de randomização (ver [[Plano de Randomização]]) |
| `sintetico.py` | Gera execuções **sintéticas** só para testes e demo; marca `sintetico=True` |
| `analise/pipeline.py` | `processar` (raw → processed) e `analisar` (processed → reports) |
| `analise/estatistica.py` | Randomização, Hodges-Lehmann, bootstrap, Wilcoxon, Holm, descritivas |
| `analise/graficos.py` | Figuras PNG para o texto |
| `analise/dashboard.py` | Dashboard HTML autocontido (ver [[Dados, Pipeline e Dashboard]]) |

## Variáveis de ambiente (`.env`, não versionado)

| Variável | Padrão | Uso |
|---|---|---|
| `TCC_FASE` | `piloto` | `piloto` ou `principal`; define `data/raw/<fase>/` |
| `TCC_TAREFAS_DIR` | `experiment/tasks/piloto` | **Obrigatória na principal** (pacotes selados, fora do repo) |
| `TCC_PLANO` | `experiment/randomization/plano-<fase>.csv` | Plano usado |
| `TCC_WORKSPACES` | `../tcc-workspaces/<fase>` | Workspaces fora do repo |
| `TCC_RAIZ` | raiz do projeto | — |

Nunca colocar chaves de API no repositório (o instrumento não usa nenhuma).

## Testes do instrumento
- `tests/unit/` — estatística, eventos/sessão, métricas, sorteio/IA.
- `tests/integration/` — fluxo completo da CLI, pipeline sintético, dashboard.
- `tests/fixtures/sinteticos.py` — dados sintéticos **rotulados**, nunca em `data/`.
- + 16 testes da aplicação-base.

## Scripts auxiliares
- `experiment/scripts/analise_poder.py` → gera [[Análise de Poder]].
- `experiment/scripts/sincronizar_conftest.py <dir-da-fase>` → copia `conftest_comum.py` para os testes de cada tarefa.

Relacionadas: [[Comandos da CLI exp]] · [[Dados, Pipeline e Dashboard]]
