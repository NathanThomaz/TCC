---
tipo: texto
fonte: thesis/README.md; thesis/capitulos/
atualizado: 2026-10-28
tags: [tcc, texto, capitulos]
---

# Capítulos do TCC

Fonte: [thesis/README.md](https://github.com/NathanThomaz/TCC/blob/main/thesis/README.md) · esqueleto ABNT genérico (NBR 14724, 6023, 10520) até chegar o manual da instituição (D7).

## Status

| Parte | Arquivo | Status | Pode escrever agora? | Pendências principais |
|---|---|---|---|---|
| Pré-textuais | — | ⏳ | Após o manual | Capa, folha de rosto, resumo, abstract, listas |
| 1 Introdução | `01-introducao.md` | Rascunho v0.1 | Sim | 1 `[CITAÇÃO NECESSÁRIA]` (expectativa de produtividade); `[VERIFICAR]` da lacuna |
| 2 Fundamentação | `02-fundamentacao-teorica.md` | Rascunho parcial | Sim (depende das fichas) | Fontes de LLM/Transformer/Codex, ISO 25010, McCabe, 14764, N-de-1, GQM |
| 3 Trabalhos relacionados | `03-trabalhos-relacionados.md` | Rascunho parcial | Sim (depende das fichas) | Quadro comparativo cheio de `[VERIFICAR]`; síntese após E2 |
| 4 Metodologia | `04-metodologia.md` | Rascunho v0.1 (futuro do indicativo) | Sim | §4.6 Procedimento, §4.8 Ameaças, §4.9 Ética ainda são marcadores; "Apêndice [X]" |
| 5 Resultados | `05-resultados.md` | 🔒 **Bloqueado** | **Não** | Só a partir de `reports/principal/` |
| 6 Discussão | `06-discussao.md` | 🔒 **Bloqueado** | **Não** | — |
| 7 Conclusão | `07-conclusao.md` | 🔒 **Bloqueado** | **Não** | — |
| Referências | `thesis/referencias.md` | Parcial | Só verificadas | Ver [[Referências Verificadas]] |
| Apêndices | — | ⏳ | — | Protocolo, enunciados (após coleta), instrumento |

## Regras de redação
1. Toda citação tem ficha em `pesquisa/fichas/` (ou status V-meta com "segundo o resumo").
2. Marcadores: `[VERIFICAR]` (não conferido no texto integral) e `[CITAÇÃO NECESSÁRIA]` (falta fonte). **Nenhum pode sobrar na entrega.**
3. Metodologia no **futuro** antes da coleta; no **passado** depois, relatando cada desvio.
4. Números de resultados **só** de `reports/principal/`, citando tabela/figura.
5. Uso de IA na elaboração declarado em [[Uso de IA no TCC]].

## Conteúdo dos rascunhos (resumo)
- **Cap. 1:** contextualização (evidência contraditória: Peng, Vaithilingam, Becker, Cui; qualidade: Perry, Borg, Liu), problema (rapidez ≠ produtividade, Forsgren), pergunta, H1–H4, objetivos a)–h), justificativa (prática, metodológica, acadêmica), delimitação.
- **Cap. 2:** 2.1 IA generativa e LLMs · 2.2 ferramentas de IA para programação (taxonomia por autonomia; Mozannar) · 2.3 produtividade (SPACE) · 2.4 qualidade (ISO 25010; Liu) · 2.5 manutenção · 2.6 experimentação em ES (Wohlin; N-de-1; GQM; diretrizes de relato).
- **Cap. 3:** 3.1 tempo e produtividade · 3.2 qualidade, segurança e manutenibilidade · 3.3 síntese e posicionamento (ciclo completo; se a lacuna não se confirmar, vira replicação).
- **Cap. 4:** pesquisa aplicada, quantitativa, explicativa; experimento controlado; N-de-1; 4 tipos × 3 pares; métricas; instrumento; análise (HL, bootstrap, randomização, Wilcoxon, Holm).
- **Caps. 5–7:** só a estrutura prevista (5.1–5.8, 6.1–6.5, 7.1–7.5).

Relacionadas: [[Roteiro da Defesa]] · [[Tema, Pergunta e Objetivos]] · [[Princípios de Integridade]]
