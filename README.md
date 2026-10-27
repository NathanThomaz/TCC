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
  analise-poder.md           poder estatístico do desenho (simulação)
  perfil-executor.md         formulário de perfil e expectativas prévias
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
thesis/          capítulos do TCC, referências ABNT e roteiro da defesa (apresentacao/)
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
exp entregar X01 --confianca 4     # avaliação oculta → aceita ou devolutiva
exp percepcao X01 <minutos>
exp questionario X01 --dificuldade 3 --esforco 3
```

## Gerar resultados e o dashboard final

```bash
exp processar     # data/raw/<fase> → data/processed/<fase>/execucoes.csv
exp analisar      # → reports/<fase>/ (tabelas, figuras, relatorio-experimento.md)
exp dashboard     # → reports/<fase>/dashboard.html (apresentação, resumo, gráficos, análises, dados, limitações)
```

O dashboard é um único arquivo HTML que funciona offline e se adapta aos temas claro e escuro. Ele tem seis seções:
- **Apresentação:** título, pergunta, hipóteses, desenho e condições;
- **Resumo:** indicadores e gráfico de efeitos com IC 95%;
- **Gráficos:** pares A × B de H1–H3, velocidade × qualidade, aprendizagem ao longo da sequência e H4 por tipo;
- **Análises:** comparações pareadas e descritivas;
- **Dados:** exclusões e execuções;
- **Limitações.**

### Ver como o dashboard ficará (antes da coleta)

```bash
exp demo-dashboard --saida ../tcc-demo   # dados SINTÉTICOS com efeito nulo, fora do repositório
```

A demonstração exibe uma faixa de aviso e **não pode** ser gravada em `reports/` nem em `data/`. Ela mostra o formato, não resultados.

## Tarefas do piloto

| Par | Tipo | Gêmea a | Gêmea b |
|---|---|---|---|
| P1 | T1 correção de defeito | P1a frete grátis indevido com cupom | P1b estoque não volta ao cancelar |
| P2 | T3 consulta SQL | P2a nº de pedidos inflado por categoria | P2b produtos sem venda incompleto |
| P3 | T2 nova funcionalidade | P3a produtos abaixo do estoque mínimo | P3b resumo de compras do cliente |
| P4 | T4 robustez da importação | P4a CSV do Excel (BOM, duplicados, linhas) | P4b formato de preço inválido |

Todas foram validadas com `exp validar-tarefa`: o estado inicial falha em parte dos testes ocultos, e a referência passa em 100%.

## Princípios de integridade

- Nenhum resultado é escrito antes da coleta. Os capítulos 5 a 7 estão bloqueados.
- `data/raw` é somente-acréscimo, com cadeia de hash verificável.
- Dados sintéticos existem só em `tests/` e não podem gerar relatório em `reports/`.
- Tarefas e testes ocultos da coleta principal **nunca** entram neste repositório (que é público).
- O instrumento não chama APIs de IA. Ele apenas registra a ferramenta e o modelo usados.
- Referências só entram no texto após verificação (ver o status em `pesquisa/`).
