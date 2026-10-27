"""Plano de randomização das execuções.

Para cada par de tarefas gêmeas:
  1. sorteia qual gêmea é feita com IA (B) e qual sem (A);
  2. sorteia a ordem dentro do par, com exatamente metade dos pares começando por B;
  3. sorteia a ordem dos pares, evitando dois pares seguidos do mesmo tipo.
O plano e a semente são versionados ANTES da primeira sessão.
"""

from __future__ import annotations

import csv
import hashlib
import random
import tomllib
from pathlib import Path

CAMPOS = ["posicao", "exec_id", "par", "tipo", "tarefa_id", "condicao", "ordem_no_par", "b_primeiro"]


def ler_pares(arquivo: Path) -> list[dict]:
    with open(arquivo, "rb") as f:
        pares = tomllib.load(f)["par"]
    for p in pares:
        if len(p["gemeas"]) != 2:
            raise ValueError(f"O par {p['id']} deve ter exatamente 2 gêmeas")
    return pares


def _ordenar_pares(pares: list[dict], rng: random.Random, tentativas: int = 10_000) -> list[dict]:
    for _ in range(tentativas):
        ordem = pares[:]
        rng.shuffle(ordem)
        if all(a["tipo"] != b["tipo"] for a, b in zip(ordem, ordem[1:])):
            return ordem
    return ordem  # impossível intercalar (ex.: um único tipo); fica a última permutação


def gerar_plano(pares: list[dict], semente: int) -> list[dict]:
    rng = random.Random(semente)
    ordem_pares = _ordenar_pares(pares, rng)
    n = len(ordem_pares)
    b_primeiro = set(rng.sample(range(n), n // 2))
    linhas = []
    pos = 0
    for k, par in enumerate(ordem_pares):
        gemeas = par["gemeas"][:]
        rng.shuffle(gemeas)
        com_ia, sem_ia = gemeas  # a primeira gêmea embaralhada recebe IA
        execucoes = [(com_ia, "B"), (sem_ia, "A")]
        if k not in b_primeiro:
            execucoes.reverse()
        for ordem, (tarefa, cond) in enumerate(execucoes, 1):
            pos += 1
            linhas.append({
                "posicao": pos,
                "exec_id": f"X{pos:02d}",
                "par": par["id"],
                "tipo": par["tipo"],
                "tarefa_id": tarefa,
                "condicao": cond,
                "ordem_no_par": ordem,
                "b_primeiro": int(k in b_primeiro),
            })
    return linhas


def salvar(linhas: list[dict], arquivo: Path, semente: int) -> str:
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    with open(arquivo, "w", encoding="utf-8", newline="") as f:
        f.write(f"# semente={semente}\n")
        w = csv.DictWriter(f, fieldnames=CAMPOS, lineterminator="\n")  # LF: hash estável no git
        w.writeheader()
        w.writerows(linhas)
    digest = hashlib.sha256(arquivo.read_bytes()).hexdigest()
    arquivo.with_suffix(".sha256").write_bytes(f"{digest}  {arquivo.name}\n".encode("utf-8"))
    return digest


def ler_plano(arquivo: Path) -> list[dict]:
    if not arquivo.exists():
        raise FileNotFoundError(f"Plano de randomização não encontrado: {arquivo}")
    linhas = [l for l in arquivo.read_text(encoding="utf-8").splitlines() if not l.startswith("#")]
    return list(csv.DictReader(linhas))


def buscar(plano: list[dict], exec_id: str) -> dict:
    for linha in plano:
        if linha["exec_id"] == exec_id:
            return linha
    raise KeyError(f"exec_id {exec_id!r} não está no plano")
