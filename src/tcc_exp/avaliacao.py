"""Execução de testes (públicos e ocultos) com pytest e leitura do relatório JUnit XML."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ResultadoTestes:
    total_esperado: int | None
    aprovados: list[str] = field(default_factory=list)
    reprovados: list[str] = field(default_factory=list)
    codigo_saida: int = 0
    saida: str = ""

    @property
    def total(self) -> int:
        coletados = len(self.aprovados) + len(self.reprovados)
        return max(self.total_esperado or 0, coletados)

    @property
    def taxa(self) -> float:
        """Proporção aprovada. Testes que nem chegaram a ser coletados (erro de
        importação, por exemplo) contam como reprovados, via total_esperado."""
        return len(self.aprovados) / self.total if self.total else 0.0

    def como_dict(self) -> dict:
        return {
            "total": self.total,
            "aprovados": sorted(self.aprovados),
            "reprovados": sorted(self.reprovados),
            "nao_coletados": self.total - len(self.aprovados) - len(self.reprovados),
            "taxa": round(self.taxa, 6),
            "codigo_saida": self.codigo_saida,
        }


def _ler_junit(xml_path: Path) -> tuple[list[str], list[str]]:
    aprovados, reprovados = [], []
    if not xml_path.exists():
        return aprovados, reprovados
    for caso in ET.parse(xml_path).getroot().iter("testcase"):
        nome = caso.get("name", "")
        falhou = any(caso.find(t) is not None for t in ("failure", "error"))
        pulado = caso.find("skipped") is not None
        (reprovados if (falhou or pulado) else aprovados).append(nome)
    return aprovados, reprovados


def rodar_pytest(
    workspace: Path, testes: Path, total_esperado: int | None = None, timeout: int = 300
) -> ResultadoTestes:
    """Roda `testes` contra o código em `workspace` (que entra no PYTHONPATH).

    Os testes são copiados para um diretório temporário FORA do workspace, para que
    testes ocultos nunca fiquem visíveis no diretório de trabalho do executor.
    """
    with tempfile.TemporaryDirectory(prefix="tcc-testes-") as tmp:
        tmp = Path(tmp)
        copia = tmp / "testes"
        shutil.copytree(testes, copia, ignore=shutil.ignore_patterns("__pycache__"))
        xml_path = tmp / "junit.xml"
        env = {**os.environ, "PYTHONPATH": str(workspace), "PYTHONDONTWRITEBYTECODE": "1",
               "PYTHONIOENCODING": "utf-8"}  # no Windows, a saída padrão seria cp1252
        try:
            r = subprocess.run(
                [sys.executable, "-m", "pytest", str(copia), "-q", "-p", "no:cacheprovider",
                 "--rootdir", str(tmp), f"--junitxml={xml_path}"],
                cwd=workspace, env=env, capture_output=True, text=True, encoding="utf-8",
                errors="replace", timeout=timeout,
            )
            codigo, saida = r.returncode, (r.stdout + r.stderr)[-4000:]
        except subprocess.TimeoutExpired:
            codigo, saida = -1, f"Tempo-limite de {timeout}s excedido na execução dos testes"
        aprovados, reprovados = _ler_junit(xml_path)
    return ResultadoTestes(total_esperado, aprovados, reprovados, codigo, saida)


def devolutiva(resultado: ResultadoTestes, descricoes: dict[str, str]) -> str:
    """Relatório de defeitos padronizado: descreve o cenário, sem mostrar o código do teste."""
    falhas = sorted(set(descricoes) - set(resultado.aprovados))
    if not falhas:
        return "Todos os cenários de avaliação foram atendidos."
    linhas = [f"{len(falhas)} cenário(s) de avaliação não atendido(s):", ""]
    for i, nome in enumerate(falhas, 1):
        linhas.append(f"{i}. {descricoes.get(nome, 'cenário sem descrição (' + nome + ')')}")
    return "\n".join(linhas)
