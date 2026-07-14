"""Cliente HTTP para as APIs públicas do IBGE (https://servicodados.ibge.gov.br/api/docs).

Endpoints utilizados (Quadro 4 do Capítulo 3 — Metodologia):
- GET /v1/localidades/estados                                   -> lista de estados brasileiros
- GET /v1/localidades/estados/{uf}/municipios                    -> municípios de uma UF
- GET /v1/localidades/regioes                                    -> lista de regiões
- GET /v3/agregados/6579/periodos/-1/variaveis/9324               -> população estimada por
                                                                     município (tabela SIDRA 6579,
                                                                     variável 9324)
"""

import requests

from src.comum.configuracoes import IBGE_BASE_URL

TIMEOUT_PADRAO = 30

AGREGADO_POPULACAO_ESTIMADA = 6579
VARIAVEL_POPULACAO_ESTIMADA = 9324


def buscar_estados() -> list:
    """Lista todos os estados brasileiros, com sigla, nome e região."""
    url = f"{IBGE_BASE_URL}/v1/localidades/estados"
    resposta = requests.get(url, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()


def buscar_regioes() -> list:
    """Lista as macrorregiões do Brasil."""
    url = f"{IBGE_BASE_URL}/v1/localidades/regioes"
    resposta = requests.get(url, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()


def buscar_municipios(uf: str) -> list:
    """Lista os municípios de uma Unidade Federativa (ex.: 'RS', 'SP')."""
    url = f"{IBGE_BASE_URL}/v1/localidades/estados/{uf}/municipios"
    resposta = requests.get(url, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()


def buscar_populacao_estimada(nivel_geografico: str = "N3") -> dict:
    """Retorna a população estimada mais recente (tabela SIDRA 6579).

    nivel_geografico: 'N1' (Brasil), 'N2' (regiões), 'N3' (estados) ou 'N6' (municípios).
    """
    url = (
        f"{IBGE_BASE_URL}/v3/agregados/{AGREGADO_POPULACAO_ESTIMADA}"
        f"/periodos/-1/variaveis/{VARIAVEL_POPULACAO_ESTIMADA}"
    )
    parametros = {"localidades": f"{nivel_geografico}[all]"}
    resposta = requests.get(url, params=parametros, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()
