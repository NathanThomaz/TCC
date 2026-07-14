"""Cliente HTTP para a API pública da Adzuna (https://developer.adzuna.com).

Endpoints utilizados (Quadro 3 do Capítulo 3 — Metodologia):
- GET /v1/api/jobs/{pais}/search/{pagina}   -> lista de vagas paginada
- GET /v1/api/jobs/{pais}/categories        -> categorias de vagas disponíveis
- GET /v1/api/jobs/{pais}/histogram         -> distribuição salarial por categoria
"""

import requests

from src.comum.configuracoes import ADZUNA_APP_ID, ADZUNA_APP_KEY, ADZUNA_BASE_URL, ADZUNA_PAIS

TIMEOUT_PADRAO = 30


def _autenticacao() -> dict:
    return {"app_id": ADZUNA_APP_ID, "app_key": ADZUNA_APP_KEY}


def buscar_vagas(pagina: int = 1, resultados_por_pagina: int = 50, **filtros) -> dict:
    """Busca uma página de vagas de emprego para o país configurado."""
    url = f"{ADZUNA_BASE_URL}/{ADZUNA_PAIS}/search/{pagina}"
    parametros = {**_autenticacao(), "results_per_page": resultados_por_pagina, **filtros}
    resposta = requests.get(url, params=parametros, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()


def buscar_categorias() -> dict:
    """Lista as categorias de vagas disponíveis para o país configurado."""
    url = f"{ADZUNA_BASE_URL}/{ADZUNA_PAIS}/categories"
    resposta = requests.get(url, params=_autenticacao(), timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()


def buscar_histograma_salarial(**filtros) -> dict:
    """Retorna a distribuição salarial por categoria para o país configurado."""
    url = f"{ADZUNA_BASE_URL}/{ADZUNA_PAIS}/histogram"
    parametros = {**_autenticacao(), **filtros}
    resposta = requests.get(url, params=parametros, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()
