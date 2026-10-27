"""Métricas estruturais (alertas do ruff, complexidade ciclomática do radon).

Se as ferramentas não estiverem instaladas, o resultado diz isso explicitamente
("disponivel": False). Nenhum valor é estimado ou preenchido por padrão.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

EXCLUIR = ["testes_publicos", "tests", ".git"]


def _disponivel(modulo: str) -> bool:
    return importlib.util.find_spec(modulo) is not None


def ruff(workspace: Path) -> dict:
    if not _disponivel("ruff"):
        return {"disponivel": False}
    r = subprocess.run(
        [sys.executable, "-m", "ruff", "check", ".", "--output-format", "json", "--no-cache",
         "--exclude", ",".join(EXCLUIR), "--select", "E,F,W,B,C90,SIM"],
        cwd=workspace, capture_output=True, text=True, encoding="utf-8",
    )
    try:
        achados = json.loads(r.stdout or "[]")
    except json.JSONDecodeError:
        return {"disponivel": True, "erro": r.stderr.strip()[:500]}
    por_regra: dict[str, int] = {}
    for a in achados:
        por_regra[a["code"]] = por_regra.get(a["code"], 0) + 1
    return {"disponivel": True, "total": len(achados), "por_regra": por_regra}


def radon_cc(workspace: Path) -> dict:
    if not _disponivel("radon"):
        return {"disponivel": False}
    r = subprocess.run(
        [sys.executable, "-m", "radon", "cc", "-j", "-e", ",".join(f"*{e}*" for e in EXCLUIR), "."],
        cwd=workspace, capture_output=True, text=True, encoding="utf-8",
    )
    try:
        dados = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        return {"disponivel": True, "erro": r.stderr.strip()[:500]}
    blocos = {}
    for arquivo, itens in dados.items():
        if isinstance(itens, dict):  # radon devolve {"error": ...} para arquivos que não compilam
            continue
        for b in itens:
            blocos[f"{Path(arquivo).as_posix()}::{b['name']}"] = b["complexity"]
    valores = list(blocos.values())
    return {
        "disponivel": True,
        "blocos": blocos,
        "soma": sum(valores),
        "media": round(sum(valores) / len(valores), 4) if valores else 0.0,
        "maximo": max(valores) if valores else 0,
    }


def analisar(workspace: Path) -> dict:
    return {"ruff": ruff(workspace), "radon_cc": radon_cc(workspace)}
