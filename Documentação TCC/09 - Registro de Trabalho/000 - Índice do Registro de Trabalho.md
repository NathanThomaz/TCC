---
tipo: indice
atualizado: 2026-10-29
tags: [tcc, registro, indice]
---

# Índice do Registro de Trabalho

Controle de **tudo o que foi perguntado (Nathan) e respondido (Claude)** no trabalho do TCC. Esta pasta é o **único lugar** do registro; a antiga pasta `docs/registro-de-trabalho/` foi incorporada aqui.

## Regra
- **Cada mensagem de Nathan vira um par de arquivos:**
  - um com a **pergunta**, em texto integral;
  - um com a **resposta** do Claude, em texto integral, seguida do registro técnico (o que foi feito, comandos, resultados reais, arquivos, pendências).
- **Os dois arquivos do par se apontam** (links no topo e nas propriedades `resposta` / `pergunta`).
- **Nada é apagado.** Correções entram como entradas novas ou como "nota de controle".

## Como ler o nome do arquivo

```
NNN_AAAA-MM-DD_Pergunta-Nathan_assunto.md    → mensagem enviada por Nathan
NNN_AAAA-MM-DD_Resposta-Claude_assunto.md    → resposta do Claude a essa mensagem
```

| Parte | Significado |
|---|---|
| `NNN` | Número da interação, em ordem. `002-1` e `002-2` são duas mensagens da mesma interação |
| `AAAA-MM-DD` | Data |
| `Pergunta-Nathan` / `Resposta-Claude` | **Quem escreveu.** A pergunta sempre aparece antes da resposta na lista de arquivos |
| `assunto` | Do que se trata (minúsculas, sem acento, separado por hífen) |

## Entradas

| # | Assunto | Pergunta (Nathan) | Resposta (Claude) |
|---|---|---|---|
| 001 | Diagnóstico técnico do projeto Forja | [[001_2026-10-28_Pergunta-Nathan_diagnostico-tecnico-forja\|pergunta]] | [[001_2026-10-28_Resposta-Claude_diagnostico-tecnico-forja\|resposta]] |
| 002-1 | Plano do Marco 1 (contrato e validação semântica) | [[002-1_2026-10-28_Pergunta-Nathan_plano-marco-1\|pergunta]] | [[002-1_2026-10-28_Resposta-Claude_plano-marco-1\|resposta]] |
| 002-2 | Pedido do plano em arquivo .md | [[002-2_2026-10-28_Pergunta-Nathan_pedido-md-do-plano\|pergunta]] | [[002-2_2026-10-28_Resposta-Claude_pedido-md-do-plano\|resposta]] |
| 003 | Aprovação do plano; Marco 1, etapa 1: contrato v0.2 + testes | [[003_2026-10-28_Pergunta-Nathan_marco-1-etapa-1\|pergunta]] | [[003_2026-10-28_Resposta-Claude_marco-1-etapa-1\|resposta]] |
| 004 | Registro de trabalho, apresentação e GitHub | [[004_2026-10-28_Pergunta-Nathan_registro-apresentacao-github\|pergunta]] | [[004_2026-10-28_Resposta-Claude_registro-apresentacao-github\|resposta]] |
| 005 | Marco 1, etapa 2: validador semântico (sem commit) | [[005_2026-10-28_Pergunta-Nathan_marco-1-etapa-2\|pergunta]] | [[005_2026-10-28_Resposta-Claude_marco-1-etapa-2\|resposta]] |
| 006 | Diagnóstico da proposta e da apresentação (Forja → Nexo), Fase 1 | [[006_2026-10-28_Pergunta-Nathan_diagnostico-proposta-nexo\|pergunta]] | [[006_2026-10-28_Resposta-Claude_diagnostico-proposta-nexo\|resposta]] |
| 007 | Conferência: o diagnóstico Nexo foi gravado? | [[007_2026-10-28_Pergunta-Nathan_conferencia-gravacao-diagnostico\|pergunta]] | [[007_2026-10-28_Resposta-Claude_conferencia-gravacao-diagnostico\|resposta]] |
| 008 | Regra de registro integral e nomenclatura | [[008_2026-10-28_Pergunta-Nathan_regra-registro-integral-e-nomenclatura\|pergunta]] | [[008_2026-10-28_Resposta-Claude_regra-registro-integral-e-nomenclatura\|resposta]] |
| 009 | Nome por autor e registro dentro do vault | [[009_2026-10-28_Pergunta-Nathan_registro-por-autor-no-vault\|pergunta]] | [[009_2026-10-28_Resposta-Claude_registro-por-autor-no-vault\|resposta]] |
| 010 | Documentação reunida no vault | [[010_2026-10-28_Pergunta-Nathan_documentacao-reunida-no-vault\|pergunta]] | [[010_2026-10-28_Resposta-Claude_documentacao-reunida-no-vault\|resposta]] |
| 011 | Nova apresentação do Nexo (19 slides) | [[011_2026-10-28_Pergunta-Nathan_novo-ppt-nexo\|pergunta]] | [[011_2026-10-28_Resposta-Claude_novo-ppt-nexo\|resposta]] |
| 012 | Apresentação simplificada: perguntas curtas, causa e solução (15 slides) | [[012_2026-10-28_Pergunta-Nathan_ppt-simplificado\|pergunta]] | [[012_2026-10-28_Resposta-Claude_ppt-simplificado\|resposta]] |
| 013 | Fluxo com o exemplo da padaria (atender, transformar, criar, disponibilizar); tela de avaliação refeita | [[013_2026-10-28_Pergunta-Nathan_fluxo-padaria-no-ppt\|pergunta]] | [[013_2026-10-28_Resposta-Claude_fluxo-padaria-no-ppt\|resposta]] |
| 014 | Tema em destaque na capa; cronograma por datas até 20/11 | [[014_2026-10-28_Pergunta-Nathan_tema-na-capa-e-prazo\|pergunta]] | [[014_2026-10-28_Resposta-Claude_tema-na-capa-e-prazo\|resposta]] |
| 015 | Capa mais limpa (tema em destaque, Nexo abaixo) | [[015_2026-10-28_Pergunta-Nathan_capa-mais-limpa\|pergunta]] | [[015_2026-10-28_Resposta-Claude_capa-mais-limpa\|resposta]] |
| 016 | Commit das alterações (sem push) | [[016_2026-10-29_Pergunta-Nathan_commit-das-alteracoes\|pergunta]] | [[016_2026-10-29_Resposta-Claude_commit-das-alteracoes\|resposta]] |

## Observações de controle
- **002-1:** a resposta original (o plano) foi gravada, a pedido, como [[Plano do Marco 1]] (antes em `docs/forja/plano-marco-1.md`), e não literalmente.
- **004, 005 e 007:** as respostas reproduzidas citam nomes antigos de arquivos (`docs/registro-de-trabalho/00N-…`). Foram mantidas como enviadas, com nota de controle.
- **Histórico anterior a 001** (montagem do vault, propostas v2 revisões 1 a 3): ver [[Registro de Sessões]].
