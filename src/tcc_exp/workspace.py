"""Versionamento do workspace de cada execução com git (um snapshot por evento relevante)."""

from __future__ import annotations

import subprocess
from pathlib import Path

_IDENTIDADE = ["-c", "user.name=tcc-exp", "-c", "user.email=tcc-exp@localhost", "-c", "commit.gpgsign=false"]


class ErroGit(RuntimeError):
    pass


def _git(workspace: Path, *args: str) -> str:
    r = subprocess.run(
        ["git", *_IDENTIDADE, *args], cwd=workspace, capture_output=True, text=True, encoding="utf-8"
    )
    if r.returncode != 0:
        raise ErroGit(f"git {' '.join(args)} falhou: {r.stderr.strip()}")
    return r.stdout.strip()


def iniciar(workspace: Path) -> str:
    _git(workspace, "init", "-q")
    (workspace / ".gitignore").write_text("__pycache__/\n*.pyc\n.pytest_cache/\n", encoding="utf-8")
    return snapshot(workspace, "estado inicial")


def snapshot(workspace: Path, mensagem: str) -> str:
    _git(workspace, "add", "-A")
    _git(workspace, "commit", "-q", "--allow-empty", "-m", mensagem)
    return _git(workspace, "rev-parse", "HEAD")


def numstat(workspace: Path, de: str, ate: str) -> tuple[int, int]:
    """Linhas adicionadas e removidas entre dois commits (arquivos binários ignorados)."""
    saida = _git(workspace, "diff", "--numstat", de, ate)
    adic = rem = 0
    for linha in saida.splitlines():
        a, r, _ = linha.split("\t", 2)
        if a != "-":
            adic += int(a)
            rem += int(r)
    return adic, rem
