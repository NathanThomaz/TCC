"""Fixtures da Forja: o mapa da padaria (válido) e ajudantes para mutá-lo em um único ponto."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

jsonschema = pytest.importorskip("jsonschema", reason="extra 'forja' não instalado: pip install -e \".[forja]\"")

from forja.contrato import carregar_schema  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
EXEMPLO_PADARIA = RAIZ / "docs" / "forja" / "exemplo-padaria.mapa.json"


@pytest.fixture(scope="session")
def _padaria_original() -> dict:
    return json.loads(EXEMPLO_PADARIA.read_text(encoding="utf-8"))


@pytest.fixture
def padaria(_padaria_original) -> dict:
    """Cópia independente do mapa da padaria; pode ser alterada pelo teste."""
    return copy.deepcopy(_padaria_original)


@pytest.fixture(scope="session")
def validador_estrutural():
    return jsonschema.Draft202012Validator(carregar_schema())


def indice(lista: list[dict], id_: str) -> int:
    return next(i for i, item in enumerate(lista) if item["id"] == id_)
