---
tipo: projeto
fonte: docs/protocolo-experimental.md §2–3; docs/plano-execucao.md §4
atualizado: 2026-10-28
tags: [tcc, metodologia, hipoteses]
---

# Hipóteses e Variáveis

Fonte: [protocolo-experimental.md](https://github.com/NathanThomaz/TCC/blob/main/docs/protocolo-experimental.md) §2–3

Todas as hipóteses são **bilaterais** (não pressupõem direção). α = 0,05, com **correção de Holm** sobre H1–H3.

| ID | H0 | Variável | Escala | Natureza |
|---|---|---|---|---|
| **H1** | Mediana de log(t_aceite_B) − log(t_aceite_A) = 0 | `t_aceite_min` | log | Confirmatória |
| **H2** | Mediana de taxa_ocultos_1a_B − taxa_ocultos_1a_A = 0 | `taxa_ocultos_1a` | proporção | Confirmatória |
| **H3** | Mediana de t_retrabalho_B − t_retrabalho_A = 0 | `t_retrabalho_min` | minutos | Confirmatória (`ciclos` só descritivo) |
| **H4** | — | Diferenças de H1 e H2 por tipo de tarefa | descritiva | **Exploratória** (~3 pares por tipo, sem poder para teste) |

Em palavras:
- **H1:** a IA altera o tempo até a entrega aceita.
- **H2:** a IA altera a qualidade funcional da primeira entrega.
- **H3:** a IA altera o tempo de retrabalho após a devolutiva.
- **H4:** a relação tempo × qualidade varia por tipo de tarefa.

## Variáveis

- **Independente (fator):** condição — **A** = sem IA; **B** = com o assistente da D3 ([[Ferramenta de IA - GitHub Copilot]]).
- **Dependentes:** ver [[Métricas]].
- **Bloco:** par de tarefas gêmeas.
- **Controladas (fixas):** executor, Python 3.11, SQLite, editor, máquina, recursos permitidos, tempo-limite, aplicação-base.
- **Covariáveis registradas:** posição na sequência (aprendizagem), ordem no par, tipo de tarefa, modelo e versão da ferramenta, data e hora.

Relacionadas: [[Plano de Análise Estatística]] · [[Análise de Poder]] · [[Tema, Pergunta e Objetivos]]
