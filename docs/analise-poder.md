# Análise de poder por simulação

> Gerado por `experiment/scripts/analise_poder.py` (semente 20261027, 2000 simulações por célula). **Não usa dados do experimento.**

Poder = probabilidade de o teste de randomização bilateral rejeitar H0 quando o efeito padronizado verdadeiro é *d* (diferenças pareadas ~ Normal(d, 1)).

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

## Como ler

- *d* = 0,5 é um efeito moderado; *d* = 1,0 significa que a melhora média equivale a um desvio-padrão das diferenças entre gêmeas.
- Exemplo **hipotético** para o tempo (escala log): se o DP das diferenças de log-tempo for 0,40 (valor a substituir pela estimativa do piloto), *d* = 1,0 corresponde a uma razão de tempos de exp(0,40) ≈ 1,49×, ou seja, ~49% mais lento ou ~33% mais rápido.
- Consequência para o TCC: com 12 pares, apenas efeitos grandes têm boa chance de ser detectados. Por isso a análise prioriza estimativas e intervalos de confiança, e um resultado não significativo **não** pode ser lido como ausência de efeito.
- Após o piloto, recalcular com o DP observado e registrar a decisão sobre o número de pares em `docs/decisoes-metodologicas.md`.
