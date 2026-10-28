---
tipo: projeto
status: v0.1 (recomendações adotadas provisoriamente)
fonte: docs/plano-execucao.md
atualizado: 2026-10-28
tags: [tcc, planejamento]
---

# Plano de Execução (v0.1)

Fonte: [plano-execucao.md](https://github.com/NathanThomaz/TCC/blob/main/docs/plano-execucao.md) · Status: recomendações adotadas provisoriamente em 27/10/2026 (D1, D4, D5, D6), aguardando o orientador.

Convenção do documento: **[LIT]** fato publicado · **[PROPOSTA]** recomendação pendente de aprovação · **[NÃO VALIDADO]** suposição a confirmar.

## Seções e onde estão no vault

| § | Conteúdo | Nota |
|---|---|---|
| 0 | Diagnóstico do ambiente | abaixo |
| 1 | Viabilidade crítica | [[Tema, Pergunta e Objetivos]] |
| 2–3 | Problema, pergunta, objetivos | [[Tema, Pergunta e Objetivos]] |
| 4 | Hipóteses e variáveis | [[Hipóteses e Variáveis]] |
| 5 | Comparação de desenhos, detalhamento do N-de-1, controle de vieses | [[Desenho Experimental]] |
| 6 | Tarefas (sistema-base, 4 tipos, públicos × ocultos) | [[Tarefas do Piloto]], [[Aplicação-base loja]] |
| 7 | Matriz preliminar de métricas | [[Métricas]] |
| 8 | Revisão bibliográfica | [[Estratégia de Busca]] |
| 9 | Ferramentas e arquitetura | [[Instrumento tcc_exp]] |
| 10 | Riscos e ameaças | [[Ameaças à Validade]] |
| 11 | Estrutura do repositório | implementada |
| 12–13 | Cronograma e critérios | abaixo e [[Etapas do Projeto]] |
| 14 | Decisões | [[Decisões Metodológicas]] |

## §0 Diagnóstico do ambiente (27/10/2026)
- Pasta original tinha só `Tema TCC.txt`, `Título do TCC.txt` e uma `Nova pasta/` vazia (esta não existe mais).
- Python 3.11.9, pip, git 2.49, Node 22; pandas, numpy, scipy, matplotlib, pytest instalados. ruff, radon e statsmodels **não** (instalar só quando justificado — ruff/radon são necessários para as métricas estáticas).
- Textos integrais pagos (IEEE, ACM, Springer) **não garantidos**; arXiv acessível; acesso institucional será necessário.
- Desconhecidos na época: prazo, manual, orientador, perfil do executor, ferramenta de IA (esta já resolvida: D3).

## §12 Cronograma (semanas relativas — ajustar ao prazo real, D7)

| Etapa | Semanas | Depende de | Critério de conclusão |
|---|---|---|---|
| E1 Descoberta e planejamento | 1–2 | — | Decisões D1–D7 registradas |
| E2 Fundamentação | 2–6 | E1 | ≥ 15 estudos fichados; lacuna confirmada ou delimitação revista |
| E3 Protocolo | 4–8 | E1, E2 parcial | Protocolo revisado pelo orientador; referências passam 100% |
| E4 Piloto | 8–10 | E3 | Ajustes documentados; tempo-limite calibrado |
| E5 Congelamento | 10–11 | E4 | Tag criada **antes** da 1ª sessão principal |
| E6 Execução | 11–15 | E5 | Todas as execuções feitas ou registradas como desvio |
| E7 Análise | 15–17 | E6 | Pipeline reproduzível com um comando |
| E8 Redação | 12–21 | E2, E7 | Resultados só a partir de E7 |
| E9 Revisão e defesa | 21–24 | E8 | Coerência pergunta → método → resultados |

**Caminho crítico:** E1 → E3 (tarefas) → E4 → E6. A construção das tarefas é a etapa mais trabalhosa e arriscada.

**Regra geral (§13):** nenhuma etapa é concluída sem o artefato existir no repositório e o critério verificado (teste, revisão registrada, commit ou tag).

**Cortes de escopo previstos:** mínimo de 3 tipos de tarefa × 3 pares (9 pares).
