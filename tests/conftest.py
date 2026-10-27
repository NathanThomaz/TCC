import shutil
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]


@pytest.fixture
def projeto(tmp_path, monkeypatch):
    """Cópia mínima do projeto em diretório temporário (config, aplicação-base, tarefas-piloto, plano).

    Nada é gravado em data/ ou reports/ do repositório real.
    """
    raiz = tmp_path / "projeto"
    for rel in ("experiment/config", "experiment/base-system", "experiment/tasks/piloto",
                "experiment/randomization"):
        shutil.copytree(RAIZ / rel, raiz / rel, ignore=shutil.ignore_patterns("__pycache__"))
    monkeypatch.setenv("TCC_RAIZ", str(raiz))
    monkeypatch.setenv("TCC_FASE", "piloto")
    monkeypatch.setenv("TCC_WORKSPACES", str(tmp_path / "ws"))
    for var in ("TCC_TAREFAS_DIR", "TCC_PLANO"):
        monkeypatch.delenv(var, raising=False)
    return raiz
