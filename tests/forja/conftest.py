"""Fixtures da Forja: o mapa da padaria (válido) e ajudantes para mutá-lo em um único ponto."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

jsonschema = pytest.importorskip("jsonschema", reason="extra 'forja' não instalado: pip install -e \".[forja]\"")

from forja.contrato import carregar_schema  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
EXEMPLO_PADARIA = RAIZ / "tests" / "forja" / "dados" / "exemplo-padaria.mapa.json"


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


def resolver_ponteiro(documento, caminho: str):
    """Segue um JSON Pointer (RFC 6901) no documento; KeyError/IndexError se não existir."""
    alvo = documento
    if not caminho:
        return alvo
    for token in caminho.split("/")[1:]:
        token = token.replace("~1", "/").replace("~0", "~")
        alvo = alvo[int(token)] if isinstance(alvo, list) else alvo[token]
    return alvo


def validar_e_conferir(mapa: dict) -> list:
    """Valida e confere as garantias gerais de qualquer resultado:
    código no catálogo, severidade do catálogo, caminho existente no mapa e ordem determinística."""
    from forja.erros import CATALOGO, PREFIXO_ESQUEMA, ordenar
    from forja.validacao import validar

    erros = validar(mapa)
    for e in erros:
        if e.codigo.startswith(PREFIXO_ESQUEMA):
            assert e.camada == "estrutural" and e.severidade == "erro"
        else:
            assert e.codigo in CATALOGO, e.codigo
            assert e.severidade == CATALOGO[e.codigo][0], e
        assert e.mensagem, e
        resolver_ponteiro(mapa, e.caminho)  # o caminho aponta para algo que existe no mapa
    assert erros == ordenar(erros)
    assert validar(copy.deepcopy(mapa)) == erros  # determinístico
    return erros
