"""Localização de diretórios e leitura da configuração do experimento."""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass
from pathlib import Path

RAIZ_PADRAO = Path(__file__).resolve().parents[2]
FASES = ("piloto", "principal")


class ErroConfiguracao(RuntimeError):
    """Configuração ausente ou inválida. A CLI mostra a mensagem e encerra."""


@dataclass(frozen=True)
class Config:
    raiz: Path
    fase: str
    experimento: dict
    dados_brutos: Path
    dados_processados: Path
    relatorios: Path
    tarefas: Path
    plano: Path
    workspaces: Path

    @property
    def base_dir(self) -> Path:
        """Diretório a partir do qual o campo `base` das tarefas é resolvido."""
        return self.raiz / "experiment"


def ler_dotenv(arquivo: Path) -> dict[str, str]:
    """Leitor mínimo de .env (CHAVE=valor, comentários com #)."""
    valores: dict[str, str] = {}
    if not arquivo.exists():
        return valores
    for linha in arquivo.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        valores[chave.strip()] = valor.strip().strip('"').strip("'")
    return valores


def carregar(raiz: Path | None = None, ambiente: dict[str, str] | None = None) -> Config:
    raiz = Path(raiz) if raiz else Path(os.environ.get("TCC_RAIZ", RAIZ_PADRAO))
    env = {**ler_dotenv(raiz / ".env"), **(ambiente if ambiente is not None else os.environ)}

    fase = env.get("TCC_FASE", "piloto")
    if fase not in FASES:
        raise ErroConfiguracao(f"TCC_FASE deve ser um de {FASES}, recebido: {fase!r}")

    arq = raiz / "experiment" / "config" / "experimento.toml"
    if not arq.exists():
        raise ErroConfiguracao(f"Arquivo de configuração não encontrado: {arq}")
    with open(arq, "rb") as f:
        experimento = tomllib.load(f)

    if "TCC_TAREFAS_DIR" in env:
        tarefas = Path(env["TCC_TAREFAS_DIR"])
    elif fase == "piloto":
        tarefas = raiz / "experiment" / "tasks" / "piloto"
    else:
        raise ErroConfiguracao(
            "Na fase principal, TCC_TAREFAS_DIR deve apontar para os pacotes selados "
            "(fora do repositório). Ver experiment/tasks/README.md."
        )

    plano = Path(env.get("TCC_PLANO", raiz / "experiment" / "randomization" / f"plano-{fase}.csv"))
    workspaces = Path(env.get("TCC_WORKSPACES", raiz.parent / "tcc-workspaces" / fase))

    return Config(
        raiz=raiz,
        fase=fase,
        experimento=experimento,
        dados_brutos=raiz / "data" / "raw" / fase,
        dados_processados=raiz / "data" / "processed" / fase,
        relatorios=raiz / "reports" / fase,
        tarefas=tarefas,
        plano=plano,
        workspaces=workspaces,
    )
