"""Contrato do mapa do sistema (JSON Schema Draft 2020-12).

O schema é um recurso do pacote, lido com importlib.resources: funciona tanto no
repositório (desenvolvimento) quanto depois de instalado.
"""

from __future__ import annotations

import copy
import json
from functools import lru_cache
from importlib import resources

VERSAO_MAPA = "0.2"
ARQUIVO_SCHEMA = "mapa-do-sistema.schema.json"


@lru_cache(maxsize=1)
def _schema_em_cache() -> dict:
    texto = resources.files(__package__).joinpath(ARQUIVO_SCHEMA).read_text(encoding="utf-8")
    return json.loads(texto)


def carregar_schema() -> dict:
    """Devolve uma cópia do schema; alterar o retorno não afeta chamadas seguintes."""
    return copy.deepcopy(_schema_em_cache())
