---
tipo: metodologia
fonte: docs/analise-poder.md; experiment/scripts/analise_poder.py
atualizado: 2026-10-28
tags: [tcc, metodologia, estatistica]
---

# Análise de Poder (simulação)

Fonte: [analise-poder.md](https://github.com/NathanThomaz/TCC/blob/main/docs/analise-poder.md) · gerado por `experiment/scripts/analise_poder.py` (semente 20261027, 2.000 simulações por célula). **Não usa dados do experimento.**

Poder = probabilidade de o teste de randomização bilateral rejeitar H0 quando as diferenças pareadas ~ Normal(d, 1).

## α = 0,05 (uma hipótese)

| d | 8 pares | 9 pares | 12 pares | 16 pares |
|---|---|---|---|---|
| 0,3 | 0,10 | 0,11 | 0,16 | 0,20 |
| 0,5 | 0,21 | 0,26 | 0,35 | 0,46 |
| 0,8 | 0,49 | 0,55 | 0,71 | 0,85 |
| 1,0 | 0,66 | 0,73 | 0,88 | 0,96 |
| 1,2 | 0,82 | 0,87 | 0,96 | 1,00 |
| 1,5 | 0,94 | 0,97 | 1,00 | 1,00 |

## α = 0,0167 (Holm, pior caso com 3 hipóteses)

| d | 8 pares | 9 pares | 12 pares | 16 pares |
|---|---|---|---|---|
| 0,3 | 0,04 | 0,03 | 0,07 | 0,10 |
| 0,5 | 0,10 | 0,10 | 0,20 | 0,28 |
| 0,8 | 0,25 | 0,31 | 0,51 | 0,68 |
| 1,0 | 0,38 | 0,48 | 0,73 | 0,88 |
| 1,2 | 0,56 | 0,67 | 0,87 | 0,97 |
| 1,5 | 0,78 | 0,87 | 0,98 | 1,00 |

## Leitura
- d = 0,5 é moderado; d = 1,0 = melhora média de um DP das diferenças entre gêmeas.
- Exemplo **hipotético** (DP de log-tempo = 0,40, a substituir pelo piloto): d = 1,0 ≈ razão de tempos 1,49× (~49% mais lento ou ~33% mais rápido).
- **Com 12 pares, só efeitos grandes têm boa chance de detecção.** Por isso: estimativas + IC primeiro; não significativo ≠ sem efeito.
- **Pendente:** após o piloto, recalcular com o DP observado e registrar a decisão sobre o nº de pares em [[Decisões Metodológicas]].
