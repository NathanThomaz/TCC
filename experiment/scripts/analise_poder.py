"""Análise de poder por simulação do desenho N-de-1 pareado (teste de randomização por inversão de sinais).

Não usa nenhum dado do experimento. As diferenças pareadas são simuladas como Normal(d, 1),
em que d é o efeito padronizado (média das diferenças ÷ desvio-padrão das diferenças).
O DP real das diferenças é desconhecido até o piloto, por isso o resultado é dado em d.

Uso: python experiment/scripts/analise_poder.py > docs/analise-poder.md
"""

import numpy as np

SEMENTE = 20261027
N_SIM = 2000
ALFAS = {"α = 0,05 (uma hipótese)": 0.05, "α = 0,0167 (Holm, pior caso com 3 hipóteses)": 0.05 / 3}
PARES = (8, 9, 12, 16)
EFEITOS = (0.3, 0.5, 0.8, 1.0, 1.2, 1.5)


def sinais(n, rng):
    if n <= 14:
        bits = (np.arange(2**n)[:, None] >> np.arange(n)) & 1
        return 1 - 2 * bits
    return rng.choice([-1, 1], size=(4000, n))


def poder(n, d, alfa, rng):
    s = sinais(n, rng).astype(float)
    rejeicoes = 0
    for _ in range(N_SIM // 200):
        dif = rng.normal(d, 1.0, size=(200, n))
        obs = np.abs(dif.mean(axis=1))
        perm = np.abs(dif @ s.T) / n                     # 200 × n_permutações
        p = (perm >= obs[:, None] - 1e-12).mean(axis=1)
        rejeicoes += int((p <= alfa).sum())
    return rejeicoes / N_SIM


def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    rng = np.random.default_rng(SEMENTE)
    print("# Análise de poder por simulação\n")
    print("> Gerado por `experiment/scripts/analise_poder.py` (semente "
          f"{SEMENTE}, {N_SIM} simulações por célula). **Não usa dados do experimento.**\n")
    print("Poder = probabilidade de o teste de randomização bilateral rejeitar H0 quando o efeito "
          "padronizado verdadeiro é *d* (diferenças pareadas ~ Normal(d, 1)).\n")
    for rotulo, alfa in ALFAS.items():
        print(f"## {rotulo}\n")
        print("| d | " + " | ".join(f"{n} pares" for n in PARES) + " |")
        print("|---|" + "---|" * len(PARES))
        for d in EFEITOS:
            linha = [f"{poder(n, d, alfa, rng):.2f}".replace(".", ",") for n in PARES]
            print(f"| {str(d).replace('.', ',')} | " + " | ".join(linha) + " |")
        print()
    print("## Como ler\n")
    print("- *d* = 0,5 é um efeito moderado; *d* = 1,0 significa que a melhora média equivale a um "
          "desvio-padrão das diferenças entre gêmeas.")
    print("- Exemplo **hipotético** para o tempo (escala log): se o DP das diferenças de log-tempo for "
          "0,40 (valor a substituir pela estimativa do piloto), *d* = 1,0 corresponde a uma razão de "
          "tempos de exp(0,40) ≈ 1,49×, ou seja, ~49% mais lento ou ~33% mais rápido.")
    print("- Consequência para o TCC: com 12 pares, apenas efeitos grandes têm boa chance de ser "
          "detectados. Por isso a análise prioriza estimativas e intervalos de confiança, e um "
          "resultado não significativo **não** pode ser lido como ausência de efeito.")
    print("- Após o piloto, recalcular com o DP observado e registrar a decisão sobre o número de pares "
          "em `docs/decisoes-metodologicas.md`.")


if __name__ == "__main__":
    main()
