"""Ingestão Bronze — coleta de vagas de tecnologia na Arbeitnow.

Fonte sem autenticação, paginada. Coleta um número limitado de páginas por
execução (a maioria das vagas é europeia, então um volume grande traria pouco
ganho de cobertura para o mercado brasileiro).
"""

import json
import logging
from datetime import date

from src.comum.configuracoes import CAMPO_DATA_INGESTAO, CAMPO_ORIGEM, DADOS_BRONZE
from src.ingestao.cliente_arbeitnow import buscar_vagas

logger = logging.getLogger(__name__)

MAXIMO_PAGINAS = 5


def _adicionar_metadados(registro: dict, data_ingestao: str, origem: str) -> dict:
    return {**registro, CAMPO_DATA_INGESTAO: data_ingestao, CAMPO_ORIGEM: origem}


def executar(maximo_paginas: int = MAXIMO_PAGINAS) -> int:
    """Coleta vagas de tecnologia da Arbeitnow e grava a camada Bronze."""
    data_ingestao = date.today().isoformat()
    diretorio_saida = DADOS_BRONZE / "arbeitnow" / data_ingestao
    diretorio_saida.mkdir(parents=True, exist_ok=True)

    total_vagas = 0
    for pagina in range(1, maximo_paginas + 1):
        resposta = buscar_vagas(pagina=pagina)
        vagas = resposta.get("data", [])
        if not vagas:
            logger.info("Página %s sem resultados, encerrando paginação.", pagina)
            break

        vagas_com_metadados = [_adicionar_metadados(v, data_ingestao, "arbeitnow") for v in vagas]
        caminho_arquivo = diretorio_saida / f"vagas_pagina_{pagina:03d}.json"
        caminho_arquivo.write_text(json.dumps(vagas_com_metadados, ensure_ascii=False, indent=2), encoding="utf-8")
        total_vagas += len(vagas_com_metadados)

        if not resposta.get("links", {}).get("next"):
            logger.info("Última página alcançada (%s).", pagina)
            break

    logger.info("Ingestão Arbeitnow concluída: %s vagas em %s", total_vagas, diretorio_saida)
    return total_vagas


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
