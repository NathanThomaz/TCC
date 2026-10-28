---
tipo: experimento
fase: principal
status: não iniciado
fonte: experiment/tasks/README.md; docs/decisoes-metodologicas.md D4
atualizado: 2026-10-28
tags: [tcc, experimento, tarefas, selagem]
---

# Tarefas Principais e Selagem

Fonte: [tasks/README.md](https://github.com/NathanThomaz/TCC/blob/main/experiment/tasks/README.md) · Decisão [[Decisões Metodológicas#D4. Autoria das tarefas|D4]]

**Status (28/10/2026): não existem.** Etapa E3 — a mais trabalhosa e arriscada do caminho crítico.

## O que é preciso
- **12 pares** (3 por tipo T1–T4) **+ 4 pares reserva** (1 por tipo).
- Uma **variante selada da aplicação-base** (domínio análogo, código diferente).
- Cada tarefa no formato de [[Tarefas do Piloto#Formato de cada pacote]], obedecendo aos critérios de inclusão do [[Protocolo Experimental]] §5.

## Fases

| Fase | Onde ficam | Executor vê? | Entra na análise? |
|---|---|---|---|
| Piloto | `experiment/tasks/piloto/` (repo público) | Sim | **Não** |
| Principal | Diretório externo (`TCC_TAREFAS_DIR`), **nunca** no repo | **Não** | Sim |

## Procedimento (sem que o executor veja)
O executor **não pode** escrever, ler nem revisar as tarefas principais antes de executá-las.

1. **Autoria:** um terceiro (orientador, colega, ou uma sessão de IA **conduzida por outra pessoa** — ou pelo executor sem ler a saída) produz os pacotes fora do repo, incluindo a variante selada da base.
2. **Validação:** essa pessoa roda `exp validar-tarefa` com `TCC_FASE=principal` e `TCC_TAREFAS_DIR=<dir>`. Tudo OK.
3. **Selagem:** essa pessoa roda `exp selar` → `experiment/tasks/selos-principal.json` (só hashes; pode ser versionado).
4. **Pares:** `experiment/tasks/pares-principal.toml` com IDs e tipos, sem conteúdo (pode ser versionado).
5. **Guarda:** pasta que o executor se compromete a não abrir; cópia de segurança com o orientador.
6. **Execução:** `exp abrir` confere o selo e recusa pacotes alterados.
7. **Depois da coleta:** pacotes podem ir para apêndice ou repositório (reprodutibilidade).

## Por que isso importa
"Executor conhece as tarefas ou os testes" é a ameaça **crítica** do estudo ([[Ameaças à Validade]]). Além disso, o repo é público (D8): qualquer tarefa principal nele ficaria exposta inclusive a ferramentas de IA com busca web.

## Ainda falta decidir
- **Quem** será o terceiro autor (depende da D7 — orientador).
- Revisão de uma amostra das tarefas pelo orientador (registrar em decisões).

Relacionadas: [[Princípios de Integridade]] · [[Plano de Randomização]] · [[Etapas do Projeto]]
