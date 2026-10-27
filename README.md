# TCC — IA generativa, agilidade e qualidade na manutenção de software

Trabalho de Conclusão de Curso em **Sistemas de Informação**.

**Título provisório:** *Avaliação experimental do impacto de um assistente de IA generativa no tempo, na qualidade e no retrabalho em tarefas de manutenção de software*

**Pergunta de pesquisa:** em tarefas de manutenção e evolução de uma aplicação de pequeno porte em Python e SQL, executadas sob protocolo controlado, como o uso de um assistente de IA generativa altera (a) o tempo até uma entrega aceita, (b) a qualidade funcional da entrega, medida por testes ocultos, e (c) o retrabalho após a devolutiva, em comparação com a execução sem esse assistente?

## Status

| Etapa | Situação |
|---|---|
| Planejamento, protocolo (rascunho), instrumento, piloto preparado | ✔ estruturado (2026-10-27) |
| Decisões pendentes: executor (D2), ferramenta de IA (D3), instituição (D7) | ⏳ ver [docs/decisoes-metodologicas.md](docs/decisoes-metodologicas.md) |
| Revisão bibliográfica integral | ⏳ |
| Piloto, congelamento, coleta, análise | ⏳ |

> **Nenhum dado experimental foi coletado ainda.** Não há resultados neste repositório.
> Detalhes em [docs/gestao-projeto.md](docs/gestao-projeto.md).

## Estrutura

```
docs/            planejamento e metodologia
  plano-execucao.md          diagnóstico, viabilidade, desenho, riscos, cronograma
  protocolo-experimental.md  protocolo (versionado; congela na Etapa 5)
  metricas.md                definições operacionais de cada métrica
  ferramentas-ia.md          categorias de IA, critérios de escolha, registro, ameaças
  guia-sessao.md             roteiro do executor em cada sessão
  decisoes-metodologicas.md  decisões (pendentes, provisórias, aprovadas)
  desvios.md                 desvios do protocolo
  gestao-projeto.md          etapas, tarefas, status, critérios de conclusão
  uso-de-ia-no-tcc.md        declaração de uso de IA na elaboração do TCC
pesquisa/        revisão bibliográfica
  referencias-verificadas.md status de verificação de cada fonte
  estrategia-busca.md        string, bases, critérios
  referencias.bib            BibTeX (somente verificadas)
  fichas/                    fichas de leitura
experiment/      material do experimento
  base-system/               aplicação-base "loja" (Python + SQLite)
  tasks/piloto/              tarefas-piloto P1 e P2 (públicas)
  tasks/README.md            formato dos pacotes e selagem das tarefas principais
  randomization/             planos sorteados (+ sha256)
  config/experimento.toml    parâmetros e ferramenta de IA
  scripts/                   utilitários
src/tcc_exp/     instrumento: CLI `exp`, eventos, sessão, avaliação, métricas, análise
tests/           testes do instrumento (unit + integration; dados sintéticos isolados)
data/            raw/ (somente-acréscimo) → processed/ (gerado)
reports/         tabelas, figuras e relatório (gerados por `exp analisar`)
thesis/          capítulos do TCC e referências ABNT
```

## Instalação

Requisitos: Python ≥ 3.11 e git.

```bash
pip install -e ".[dev,estatica]"   # estatica = ruff + radon (métricas estruturais)
cp .env.example .env
exp verificar-ambiente
```

## Testes

```bash
python -m pytest                    # instrumento + aplicação-base
exp validar-tarefa                  # valida os pacotes de tarefa da fase atual
```

## Executar o experimento

Roteiro completo em [docs/guia-sessao.md](docs/guia-sessao.md). Em resumo:

```bash
exp abrir X01 --confirmo-sem-ia    # (condição A)  |  exp abrir X01 --modelo "<modelo>"  (condição B)
exp iniciar X01
exp testar X01
exp entregar X01                   # avaliação oculta → aceita ou devolutiva
exp percepcao X01 <minutos>
```

## Gerar resultados

```bash
exp processar     # data/raw/<fase> → data/processed/<fase>/execucoes.csv
exp analisar      # → reports/<fase>/ (tabelas, figuras, relatorio-experimento.md)
```

## Princípios de integridade

- Nenhum resultado é escrito antes da coleta. Os capítulos 5 a 7 estão bloqueados.
- `data/raw` é somente-acréscimo, com cadeia de hash verificável.
- Dados sintéticos existem só em `tests/` e não podem gerar relatório em `reports/`.
- Tarefas e testes ocultos da coleta principal **nunca** entram neste repositório (que é público).
- O instrumento não chama APIs de IA. Ele apenas registra a ferramenta e o modelo usados.
- Referências só entram no texto após verificação (ver o status em `pesquisa/`).
