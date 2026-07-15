"""Ingestão Bronze — coleta de vagas remotas de tecnologia na RemoteOK.

Fonte sem autenticação e sem paginação: uma chamada retorna a lista mais recente
de vagas (site 100% de vagas remotas, a maioria de tecnologia).
"""

import json
import logging
from datetime import date

from src.comum.configuracoes import CAMPO_DATA_INGESTAO, CAMPO_ORIGEM, DADOS_BRONZE
from src.ingestao.cliente_remoteok import buscar_vagas

logger = logging.getLogger(__name__)


def _adicionar_metadados(registro: dict, data_ingestao: str, origem: str) -> dict:
    return {**registro, CAMPO_DATA_INGESTAO: data_ingestao, CAMPO_ORIGEM: origem}


def executar() -> int:
    """Coleta vagas remotas da RemoteOK e grava a camada Bronze. Retorna o total de vagas gravadas."""
    data_ingestao = date.today().isoformat()
    diretorio_saida = DADOS_BRONZE / "remoteok" / data_ingestao
    diretorio_saida.mkdir(parents=True, exist_ok=True)

    vagas = buscar_vagas()
    vagas_com_metadados = [_adicionar_metadados(v, data_ingestao, "remoteok") for v in vagas]

    caminho_arquivo = diretorio_saida / "vagas.json"
    caminho_arquivo.write_text(json.dumps(vagas_com_metadados, ensure_ascii=False, indent=2), encoding="utf-8")

    logger.info("Ingestão RemoteOK concluída: %s vagas em %s", len(vagas_com_metadados), caminho_arquivo)
    return len(vagas_com_metadados)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
