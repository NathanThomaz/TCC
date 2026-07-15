"""Cliente HTTP para a API pública da Remotive (https://remotive.com/api/remote-jobs).

API sem autenticação. Filtrar por categoria (`category=software-dev`) restringe o
resultado a vagas de tecnologia, evitando trazer vagas de outras áreas do site.
"""

import requests

from src.comum.configuracoes import REMOTIVE_BASE_URL, REMOTIVE_CATEGORIA

TIMEOUT_PADRAO = 30
CABECALHOS = {"User-Agent": "Mozilla/5.0 (compatible; TCC-pipeline/1.0)"}


def buscar_vagas(categoria: str = REMOTIVE_CATEGORIA) -> list:
    """Busca vagas remotas de tecnologia na Remotive."""
    parametros = {"category": categoria} if categoria else {}
    resposta = requests.get(REMOTIVE_BASE_URL, params=parametros, headers=CABECALHOS, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json().get("jobs", [])
