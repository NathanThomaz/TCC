"""Ingestão Bronze — coleta de vagas de emprego em Tecnologia na API Adzuna.

Executa a coleta paginada de vagas (restrita à categoria de TI), adiciona
metadados de rastreabilidade e grava os dados brutos em JSON, particionados
por data de ingestão, em dados/bronze/adzuna/{data_ingestao}/.

Também coleta o histograma de distribuição salarial da categoria de TI, usado
para enriquecer o indicador de salários por cargo/região na camada Gold.
"""

import json
import logging
from datetime import date

from src.comum.configuracoes import ADZUNA_CATEGORIA_ALVO, CAMPO_DATA_INGESTAO, CAMPO_ORIGEM, DADOS_BRONZE
from src.ingestao.cliente_adzuna import buscar_categorias, buscar_histograma_salarial, buscar_vagas

logger = logging.getLogger(__name__)

MAXIMO_PAGINAS = 20


def _adicionar_metadados(registro: dict, data_ingestao: str, origem: str) -> dict:
    return {**registro, CAMPO_DATA_INGESTAO: data_ingestao, CAMPO_ORIGEM: origem}


def executar(maximo_paginas: int = MAXIMO_PAGINAS, categoria: str = ADZUNA_CATEGORIA_ALVO) -> int:
    """Coleta vagas de TI, categorias e histograma salarial da Adzuna. Retorna o total de vagas gravadas."""
    data_ingestao = date.today().isoformat()
    diretorio_saida = DADOS_BRONZE / "adzuna" / data_ingestao
    diretorio_saida.mkdir(parents=True, exist_ok=True)

    total_vagas = 0
    for pagina in range(1, maximo_paginas + 1):
        resposta = buscar_vagas(pagina=pagina, category=categoria)
        vagas = resposta.get("results", [])
        if not vagas:
            logger.info("Página %s sem resultados, encerrando paginação.", pagina)
            break

        vagas_com_metadados = [_adicionar_metadados(v, data_ingestao, "adzuna") for v in vagas]
        caminho_arquivo = diretorio_saida / f"vagas_pagina_{pagina:03d}.json"
        caminho_arquivo.write_text(json.dumps(vagas_com_metadados, ensure_ascii=False, indent=2), encoding="utf-8")
        total_vagas += len(vagas_com_metadados)
        logger.info("Página %s: %s vagas gravadas em %s", pagina, len(vagas_com_metadados), caminho_arquivo)

    categorias = _adicionar_metadados({"categorias": buscar_categorias().get("results", [])}, data_ingestao, "adzuna")
    (diretorio_saida / "categorias.json").write_text(
        json.dumps(categorias, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    histograma = _adicionar_metadados(
        buscar_histograma_salarial(category=categoria), data_ingestao, "adzuna"
    )
    (diretorio_saida / "histograma_salarial.json").write_text(
        json.dumps(histograma, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    logger.info("Ingestão Adzuna concluída: %s vagas de '%s' em %s", total_vagas, categoria, diretorio_saida)
    return total_vagas


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
