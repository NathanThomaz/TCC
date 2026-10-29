---
tipo: painel
atualizado: 2026-10-28
tags: [tcc, painel]
---

# Painel do TCC

> **Ponto de partida de cada sessão:** [[Estado Atual - Retomada]]
> **Histórico cronológico:** [[Registro de Sessões]]

## O trabalho

- **Curso:** Sistemas de Informação · **Autor:** Nathan Thomaz
- **Tema (arquivo original):** Impacto da inteligência artificial generativa na agilidade e na qualidade do processo de desenvolvimento de software.
- **Título provisório:** *Avaliação experimental do impacto de um assistente de IA generativa no tempo, na qualidade e no retrabalho em tarefas de manutenção de software* (se o N-de-1 for aprovado: "…: um estudo de caso único randomizado").
- **Desenho:** caso único randomizado (N-de-1), pares de tarefas gêmeas, condição A (sem IA) × B (com IA).
- **Ferramenta da condição B:** GitHub Copilot no VS Code (D3, provisória; modelo ainda não escolhido).
- **Repositório:** [github.com/NathanThomaz/TCC](https://github.com/NathanThomaz/TCC) — **PÚBLICO**, branch `main`.
- **Pasta local:** `C:\Users\natha\Documents\TCC` (este vault fica em `Documentação TCC/`).

## Situação em uma linha (2026-10-28)

Projeto estruturado (v0.2.0), instrumento testado (45 testes passando), piloto pronto com 8 tarefas. **Nenhum dado coletado.** O piloto está travado porque a 1ª execução (X01) é na condição B e o modelo do Copilot ainda não foi configurado. Detalhes em [[Estado Atual - Retomada]].

## Mapa do vault

### 01 – Projeto
- [[Proposta v2 - Forja]] ← **nova direção proposta (28/10), aguardando orientador** (resumo)
- [[Proposta v2 - Documento Completo]] ← texto integral da proposta
- [[Tema, Pergunta e Objetivos]] (plano v0.1, suspenso)
- [[Hipóteses e Variáveis]]
- [[Plano de Execução]]
- [[Princípios de Integridade]] ← regras que nunca podem ser quebradas

### 02 – Metodologia
- [[Desenho Experimental]]
- [[Protocolo Experimental]]
- [[Métricas]]
- [[Plano de Análise Estatística]]
- [[Análise de Poder]]
- [[Ameaças à Validade]]

### 03 – Decisões
- [[Decisões Metodológicas]] (D0–D11)
- [[Desvios do Protocolo]]

### 04 – Experimento
- [[Aplicação-base loja]]
- [[Tarefas do Piloto]]
- [[Tarefas Principais e Selagem]]
- [[Plano de Randomização]]
- [[Ferramenta de IA - GitHub Copilot]]
- [[Perfil do Executor]]
- [[Guia de Sessão]] ← roteiro de cada execução

### 05 – Instrumento
- [[Instrumento tcc_exp]]
- [[Comandos da CLI exp]]
- [[Dados, Pipeline e Dashboard]]

### 06 – Pesquisa
- [[Referências Verificadas]]
- [[Estratégia de Busca]]

### 07 – Texto do TCC
- [[Capítulos do TCC]]
- [[Roteiro da Defesa]]
- [[Uso de IA no TCC]]

### 08 – Gestão
- [[Etapas do Projeto]] (E1–E9)
- [[Backlog e Pendências]]
- [[Inconsistências do Repositório]]

### 10 – Nexo: contrato e validação
- [[Contrato do Mapa do Sistema]] · [[Validação do Mapa]] · [[Plano do Marco 1]]

### 09 – Registro de Trabalho
- [[000 - Índice do Registro de Trabalho]] ← toda pergunta (Nathan) e toda resposta (Claude), em texto integral

### Modelos (`_Modelos/`)
- [[Modelo - Registro de Sessão]]
- [[Modelo - Execução Experimental]]
- [[Modelo - Ficha de Leitura]]

## Como este vault funciona

1. **A fonte da verdade é o repositório.** Cada nota indica o arquivo de origem no campo `fonte`. Se a nota e o repositório divergirem, vale o repositório, e a nota deve ser corrigida.
2. **Ao começar uma sessão:** ler [[Estado Atual - Retomada]].
3. **Ao terminar uma sessão:** atualizar [[Estado Atual - Retomada]] (seção "Ponto de parada") e acrescentar uma entrada em [[Registro de Sessões]] usando o [[Modelo - Registro de Sessão]].
4. Nada de resultado, número ou referência que não exista no repositório. Ver [[Princípios de Integridade]].
