"""Ingestão Bronze — coleta de dados geográficos e populacionais na API do IBGE.

Coleta estados, regiões, municípios e população estimada (por estado e por
município), adiciona metadados de rastreabilidade e grava os dados brutos em
JSON em dados/bronze/ibge/{data_ingestao}/.
"""

import json
import logging
from datetime import date

from src.comum.configuracoes import CAMPO_DATA_INGESTAO, CAMPO_ORIGEM, DADOS_BRONZE
from src.ingestao.cliente_ibge import (
    buscar_estados,
    buscar_municipios,
    buscar_populacao_estimada,
    buscar_regioes,
)

logger = logging.getLogger(__name__)


def _adicionar_metadados(registro: dict, data_ingestao: str, origem: str) -> dict:
    return {**registro, CAMPO_DATA_INGESTAO: data_ingestao, CAMPO_ORIGEM: origem}


def executar() -> None:
    """Coleta estados, regiões, municípios e população estimada do IBGE e grava a camada Bronze."""
    data_ingestao = date.today().isoformat()
    diretorio_saida = DADOS_BRONZE / "ibge" / data_ingestao
    diretorio_saida.mkdir(parents=True, exist_ok=True)

    estados = buscar_estados()
    (diretorio_saida / "estados.json").write_text(
        json.dumps(_adicionar_metadados({"estados": estados}, data_ingestao, "ibge"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info("Estados gravados: %s", len(estados))

    regioes = buscar_regioes()
    (diretorio_saida / "regioes.json").write_text(
        json.dumps(_adicionar_metadados({"regioes": regioes}, data_ingestao, "ibge"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info("Regiões gravadas: %s", len(regioes))

    municipios_por_uf = {}
    for estado in estados:
        uf = estado["sigla"]
        municipios_por_uf[uf] = buscar_municipios(uf)
    (diretorio_saida / "municipios.json").write_text(
        json.dumps(
            _adicionar_metadados({"municipios_por_uf": municipios_por_uf}, data_ingestao, "ibge"),
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    logger.info("Municípios gravados para %s UFs", len(municipios_por_uf))

    populacao_estados = buscar_populacao_estimada(nivel_geografico="N3")
    (diretorio_saida / "populacao_estados.json").write_text(
        json.dumps(
            _adicionar_metadados({"populacao": populacao_estados}, data_ingestao, "ibge"),
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    populacao_municipios = buscar_populacao_estimada(nivel_geografico="N6")
    (diretorio_saida / "populacao_municipios.json").write_text(
        json.dumps(
            _adicionar_metadados({"populacao": populacao_municipios}, data_ingestao, "ibge"),
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    logger.info("Ingestão IBGE concluída em %s", diretorio_saida)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
