"""Cliente HTTP para a API pública da Jooble (https://jooble.org/api/about).

Segunda fonte de vagas do projeto, complementar à Adzuna, agregando anúncios de
múltiplos portais de emprego brasileiros (InfoJobs, Vagas.com, Gupy etc.).

Endpoint: POST https://jooble.org/api/{chave}
Corpo (JSON): {"keywords": ..., "location": ..., "page": ...}
Resposta (JSON): {"totalCount": N, "jobs": [{"id", "title", "location", "company",
"salary", "snippet", "source", "type", "link", "updated"}, ...]}

A chave gratuita tem limite baixo de requisições (500 no plano padrão) — use
com moderação (poucas páginas por execução).
"""

import requests

from src.comum.configuracoes import JOOBLE_API_KEY, JOOBLE_BASE_URL

TIMEOUT_PADRAO = 30


def buscar_vagas(pagina: int = 1, palavras_chave: str = "", localizacao: str = "") -> dict:
    """Busca uma página de vagas na Jooble para as palavras-chave e localização informadas."""
    url = f"{JOOBLE_BASE_URL}/{JOOBLE_API_KEY}"
    corpo = {"keywords": palavras_chave, "location": localizacao, "page": str(pagina)}
    resposta = requests.post(url, json=corpo, timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()
