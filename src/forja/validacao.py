"""Validação completa do mapa: estrutural (forma) e, se ela passar, semântica (coerência)."""

from __future__ import annotations

import json
from pathlib import Path

from .erros import ErroValidacao, ordenar
from .estrutural import validar_estrutura
from .semantica import validar_semantica


def validar(mapa) -> list[ErroValidacao]:
    """Erros e avisos em ordem determinística.

    A camada semântica só roda se a estrutural não tiver erros, para não gerar
    erros em cascata sobre um mapa malformado.
    """
    estruturais = validar_estrutura(mapa)
    if any(e.severidade == "erro" for e in estruturais):
        return ordenar(estruturais)
    return ordenar(estruturais + validar_semantica(mapa))


def validar_arquivo(caminho: str | Path) -> list[ErroValidacao]:
    """Lê e valida um arquivo. Erros de leitura ou de JSON propagam (OSError, json.JSONDecodeError)."""
    return validar(json.loads(Path(caminho).read_text(encoding="utf-8")))


def tem_erros(erros: list[ErroValidacao]) -> bool:
    return any(e.severidade == "erro" for e in erros)
