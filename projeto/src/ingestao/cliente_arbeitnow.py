"""Cliente HTTP para a API pública da Arbeitnow (https://arbeitnow.com/api/job-board-api).

API sem autenticação, paginada (~100 vagas por página, campo `links.next` indica se
há próxima página).
"""

import requests

from src.comum.configuracoes import ARBEITNOW_BASE_URL

TIMEOUT_PADRAO = 30


def buscar_vagas(pagina: int = 1) -> dict:
    """Busca uma página de vagas na Arbeitnow. Retorna a resposta completa (data + links)."""
    parametros = {"page": pagina}
    resposta = requests.get(ARBEITNOW_BASE_URL, params=parametros, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()
