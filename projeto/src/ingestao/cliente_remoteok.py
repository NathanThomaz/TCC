"""Cliente HTTP para a API pública da RemoteOK (https://remoteok.com/api).

API sem autenticação, sem paginação (retorna a lista mais recente de vagas remotas
em uma única chamada). O primeiro item da resposta é sempre um aviso de termos de
uso, não uma vaga — deve ser descartado.
"""

import requests

from src.comum.configuracoes import REMOTEOK_BASE_URL

TIMEOUT_PADRAO = 30
CABECALHOS = {"User-Agent": "Mozilla/5.0 (compatible; TCC-pipeline/1.0)"}


def buscar_vagas() -> list:
    """Busca a lista mais recente de vagas remotas na RemoteOK."""
    resposta = requests.get(REMOTEOK_BASE_URL, headers=CABECALHOS, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    dados = resposta.json()
    return dados[1:] if dados and "legal" in dados[0] else dados
