"""Procedimentos estatísticos do plano de análise (docs/protocolo-experimental.md, seção 9).

Desenho: N-de-1 randomizado por pares. Em cada par, o sorteio definiu qual gêmea
foi feita com IA, então, sob a hipótese nula estrita (nenhum efeito da condição),
trocar os rótulos dentro do par apenas inverte o sinal da diferença B − A. O teste
de randomização por inversão de sinais é, portanto, válido pelo próprio desenho,
sem suposição de normalidade.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

LIMITE_EXATO = 16  # até 2^16 permutações o teste é exato; acima disso, Monte Carlo


def diferencas_pareadas(df: pd.DataFrame, metrica: str, log: bool = False) -> pd.DataFrame:
    """Uma linha por par completo (A e B com valor), com a diferença B − A."""
    sub = df.dropna(subset=[metrica])
    tab = sub.pivot_table(index=["par", "tipo"], columns="condicao", values=metrica, aggfunc="first")
    tab = tab.dropna(subset=[c for c in ("A", "B") if c in tab.columns])
    if not {"A", "B"} <= set(tab.columns):
        return pd.DataFrame(columns=["par", "tipo", "A", "B", "dif"])
    tab = tab.reset_index()
    if log:
        if (tab[["A", "B"]] <= 0).any().any():
            raise ValueError(f"{metrica}: escala log exige valores positivos")
        tab["dif"] = np.log(tab["B"]) - np.log(tab["A"])
    else:
        tab["dif"] = tab["B"] - tab["A"]
    return tab[["par", "tipo", "A", "B", "dif"]]


def teste_randomizacao(dif, n_mc: int = 100_000, semente: int = 20261027) -> dict:
    """p bilateral para a média das diferenças, invertendo sinais dentro dos pares."""
    d = np.asarray(dif, dtype=float)
    n = len(d)
    if n == 0:
        return {"p": None, "metodo": None, "n_permutacoes": 0}
    obs = abs(d.mean())
    if n <= LIMITE_EXATO:
        bits = (np.arange(2**n)[:, None] >> np.arange(n)) & 1
        sinais = 1 - 2 * bits
        metodo = "exato"
    else:
        rng = np.random.default_rng(semente)
        sinais = rng.choice([-1, 1], size=(n_mc, n))
        metodo = "monte_carlo"
    perm = np.abs((sinais * d).mean(axis=1))
    p = float(np.mean(perm >= obs - 1e-12))
    return {"p": p, "metodo": metodo, "n_permutacoes": int(len(sinais))}


def hodges_lehmann(dif) -> float | None:
    """Mediana das médias de Walsh: estimador de deslocamento associado ao Wilcoxon pareado."""
    d = np.asarray(dif, dtype=float)
    if len(d) == 0:
        return None
    i, j = np.triu_indices(len(d))
    return float(np.median((d[i] + d[j]) / 2))


def bootstrap_ic(dif, func=np.median, n: int = 10_000, nivel: float = 0.95, semente: int = 20261027):
    d = np.asarray(dif, dtype=float)
    if len(d) < 2:
        return (None, None)
    rng = np.random.default_rng(semente)
    amostras = rng.choice(d, size=(n, len(d)), replace=True)
    est = np.apply_along_axis(func, 1, amostras)
    alfa = (1 - nivel) / 2
    return (float(np.quantile(est, alfa)), float(np.quantile(est, 1 - alfa)))


def wilcoxon(dif) -> dict:
    d = np.asarray(dif, dtype=float)
    if len(d) < 1 or np.allclose(d, 0):
        return {"estatistica": None, "p": None}
    r = stats.wilcoxon(d, zero_method="wilcox", alternative="two-sided")
    return {"estatistica": float(r.statistic), "p": float(r.pvalue)}


def holm(pvalores: dict[str, float | None]) -> dict[str, float | None]:
    """Correção de Holm-Bonferroni. Valores None (teste não realizado) ficam de fora."""
    validos = sorted(((p, k) for k, p in pvalores.items() if p is not None))
    m = len(validos)
    ajustados: dict[str, float | None] = {k: None for k in pvalores}
    acumulado = 0.0
    for i, (p, k) in enumerate(validos):
        acumulado = max(acumulado, min(1.0, (m - i) * p))
        ajustados[k] = acumulado
    return ajustados


def descritivas(df: pd.DataFrame, metrica: str) -> pd.DataFrame:
    g = df.dropna(subset=[metrica]).groupby("condicao")[metrica]
    tab = g.agg(n="count", media="mean", dp="std", mediana="median", minimo="min", maximo="max")
    tab["q1"] = g.quantile(0.25)
    tab["q3"] = g.quantile(0.75)
    return tab.reset_index()


def resumo_pareado(df: pd.DataFrame, metrica: str, log: bool = False) -> dict:
    pares = diferencas_pareadas(df, metrica, log=log)
    d = pares["dif"].to_numpy()
    hl = hodges_lehmann(d)
    ic = bootstrap_ic(d)
    res = {
        "metrica": metrica,
        "escala": "log" if log else "original",
        "n_pares": int(len(d)),
        "media_dif": float(d.mean()) if len(d) else None,
        "mediana_dif": float(np.median(d)) if len(d) else None,
        "hodges_lehmann": hl,
        "ic95_mediana_inf": ic[0],
        "ic95_mediana_sup": ic[1],
        "p_randomizacao": teste_randomizacao(d)["p"],
        "p_wilcoxon": wilcoxon(d)["p"],
        "pares_dif_positiva": int((d > 0).sum()),
        "pares_dif_negativa": int((d < 0).sum()),
        "pares_empate": int((d == 0).sum()),
    }
    if log and hl is not None:
        res["razao_B_A"] = float(np.exp(hl))
        res["razao_ic95_inf"] = float(np.exp(ic[0])) if ic[0] is not None else None
        res["razao_ic95_sup"] = float(np.exp(ic[1])) if ic[1] is not None else None
    return res
