---
tipo: pesquisa
etapa: E2
status: não iniciada
fonte: pesquisa/estrategia-busca.md; docs/plano-execucao.md §8
atualizado: 2026-10-28
tags: [tcc, pesquisa, revisao]
---

# Estratégia de Busca (E2)

Fonte: [estrategia-busca.md](https://github.com/NathanThomaz/TCC/blob/main/pesquisa/estrategia-busca.md)

**Tipo:** revisão **estruturada** com *snowballing*, inspirada em Kitchenham & Charters (2007, **a verificar**). Não é revisão sistemática completa.

**Situação (28/10/2026):** nenhuma busca executada; tabela de registro vazia; nenhuma ficha além do modelo (`pesquisa/fichas/_modelo.md`).

## Pergunta orientadora
Que evidência empírica existe sobre o efeito de assistentes de IA generativa no tempo, na qualidade funcional, na manutenibilidade e no esforço de validação e retrabalho em tarefas de desenvolvimento e manutenção de software?

## String (v1)
```
("generative AI" OR "large language model" OR LLM OR Copilot OR "AI assistant"
 OR "coding assistant" OR "AI pair programmer" OR "coding agent")
AND
("developer productivity" OR "task completion time" OR "code quality" OR maintainability
 OR defect* OR rework OR "code review" OR debugging)
AND
(experiment OR "controlled study" OR randomized OR "user study" OR "empirical study")
```
Adaptar por base e **registrar a string exata usada**.

## Bases (registrar data, string, filtros e nº de resultados no repo)
ACM DL · IEEE Xplore · Scopus (se houver acesso) · arXiv cs.SE (rotular preprint) · Google Scholar (*snowballing*). Período: 2021–2026 (+ clássicos metodológicos).

## Critérios
- **Inclusão (todos):** I1 estudo empírico · I2 assistente de IA generativa para programação · I3 mede tempo, produtividade, qualidade, manutenibilidade, defeitos, segurança ou esforço de validação · I4 inglês ou português.
- **Exclusão (qualquer):** E1 opinião sem dados · E2 marketing de fornecedor · E3 método não descrito · E4 duplicata (fica a revisada por pares).
- Literatura cinzenta (DORA, GitClear, METR) só como **contexto**, rotulada.

## Estudos-semente
A1–A3 e A5–A8 de [[Referências Verificadas]].

## Entregáveis e critério de conclusão
- `pesquisa/fichas/` com **≥ 15 estudos** fichados (texto integral), usando o [[Modelo - Ficha de Leitura]].
- `pesquisa/revisao-literatura.md` (ainda não existe): síntese que **confirme ou refute a lacuna** (ciclo entrega → avaliação oculta → retrabalho).
- `referencias.bib` só com verificadas.
- Depende de **acesso institucional** para textos pagos (D7).

Relacionadas: [[Etapas do Projeto]] · [[Capítulos do TCC]]
