# Estratégia de busca bibliográfica

Tipo: **revisão estruturada** com *snowballing*, inspirada nas diretrizes de Kitchenham e Charters (2007, **a verificar**). Não é uma revisão sistemática completa.

## Pergunta orientadora
Que evidência empírica existe sobre o efeito de assistentes de IA generativa no tempo, na qualidade funcional, na manutenibilidade e no esforço de validação e retrabalho em tarefas de desenvolvimento e manutenção de software?

## String de busca (versão 1)

```
("generative AI" OR "large language model" OR LLM OR Copilot OR "AI assistant"
 OR "coding assistant" OR "AI pair programmer" OR "coding agent")
AND
("developer productivity" OR "task completion time" OR "code quality" OR maintainability
 OR defect* OR rework OR "code review" OR debugging)
AND
(experiment OR "controlled study" OR randomized OR "user study" OR "empirical study")
```

Adaptar a sintaxe de cada base e registrar a string exata usada.

## Bases e registro

| Base | Data | String exata | Filtros | Nº de resultados | Observações |
|---|---|---|---|---|---|
| ACM Digital Library | | | 2021–2026 | | |
| IEEE Xplore | | | 2021–2026 | | |
| Scopus (se houver acesso) | | | 2021–2026 | | |
| arXiv (cs.SE) | | | 2021–2026 | | Preprint: rotular como tal |
| Google Scholar (*snowballing*) | | | — | | Citações dos estudos-semente |

## Critérios

**Inclusão (todos):**
- I1: estudo empírico (experimento, estudo com usuários, estudo de campo, estudo de repositório ou benchmark com avaliação de código);
- I2: envolve assistente de IA generativa para programação;
- I3: mede tempo, produtividade, qualidade, manutenibilidade, defeitos, segurança ou esforço de validação;
- I4: em inglês ou português.

**Exclusão (qualquer):**
- E1: opinião ou editorial sem dados;
- E2: material de marketing de fornecedor;
- E3: método não descrito;
- E4: duplicata (fica a versão revisada por pares).

Literatura cinzenta (relatórios DORA, GitClear, METR) entra **somente como contexto**, rotulada como tal.

## Estudos-semente
A1–A3 e A5–A8 de [referencias-verificadas.md](referencias-verificadas.md).

## Ficha de leitura
Modelo em [fichas/_modelo.md](fichas/_modelo.md), com uma ficha por estudo.
