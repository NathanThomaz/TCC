"""Figuras estáticas para o texto do TCC (PNG). Cores: A = slot categórico 1, B = slot 2."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

COR = {"A": "#2a78d6", "B": "#eb6834"}
ROTULO = {"A": "A — sem IA", "B": "B — com IA"}
TINTA, TINTA_2, GRADE, FUNDO = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"


def _estilo(ax, titulo: str, ylabel: str) -> None:
    ax.set_facecolor(FUNDO)
    ax.set_title(titulo, loc="left", color=TINTA, fontsize=11)
    ax.set_ylabel(ylabel, color=TINTA_2)
    ax.tick_params(colors=TINTA_2)
    ax.grid(axis="y", color=GRADE, linewidth=0.8)
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    for lado in ("left", "bottom"):
        ax.spines[lado].set_color(GRADE)


def pares(tab_pares: pd.DataFrame, titulo: str, ylabel: str, saida: Path) -> Path:
    """Gráfico de linhas pareadas: cada par liga o valor em A ao valor em B."""
    fig, ax = plt.subplots(figsize=(5, 4), facecolor=FUNDO)
    for _, r in tab_pares.iterrows():
        ax.plot([0, 1], [r["A"], r["B"]], color=TINTA_2, linewidth=1, alpha=0.6, zorder=1)
    for x, cond in enumerate(("A", "B")):
        ax.scatter([x] * len(tab_pares), tab_pares[cond], s=40, color=COR[cond],
                   edgecolor=FUNDO, linewidth=2, zorder=2, label=ROTULO[cond])
    ax.set_xticks([0, 1], [ROTULO["A"], ROTULO["B"]])
    ax.set_xlim(-0.4, 1.4)
    _estilo(ax, titulo, ylabel)
    ax.legend(frameon=False, loc="best", fontsize=8)
    fig.tight_layout()
    saida.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(saida, dpi=200)
    plt.close(fig)
    return saida


def tempo_vs_qualidade(df: pd.DataFrame, saida: Path) -> Path:
    fig, ax = plt.subplots(figsize=(5.5, 4), facecolor=FUNDO)
    for cond in ("A", "B"):
        sub = df[df["condicao"] == cond].dropna(subset=["t_1a_entrega_min", "taxa_ocultos_1a"])
        ax.scatter(sub["t_1a_entrega_min"], sub["taxa_ocultos_1a"] * 100, s=40, color=COR[cond],
                   edgecolor=FUNDO, linewidth=2, label=ROTULO[cond])
    _estilo(ax, "Tempo até a 1ª entrega × qualidade da 1ª entrega", "Testes ocultos aprovados (%)")
    ax.set_xlabel("Tempo ativo até a 1ª entrega (min)", color=TINTA_2)
    ax.set_ylim(-5, 105)
    ax.legend(frameon=False, fontsize=8)
    fig.tight_layout()
    saida.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(saida, dpi=200)
    plt.close(fig)
    return saida
