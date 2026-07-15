"""Ingestão Bronze — coleta de vagas de tecnologia na API da Jooble.

Segunda fonte de vagas do projeto (complementar à Adzuna). A cota gratuita da
Jooble é de apenas 500 requisições totais, então a coleta é deliberadamente
conservadora: poucas palavras-chave, poucas páginas por execução.

O parâmetro de localização da API não filtra corretamente por Brasil (testado:
"Brasil", "Brazil", "BR" e nomes de cidade retornam ~0 resultados) — por isso a
busca é feita sem filtro de localização, e a classificação nacional/internacional
é resolvida depois, na camada Silver (ver tratamento_localidades.py), a partir do
texto de localização de cada vaga retornada.
"""

import json
import logging
from datetime import date

from src.comum.configuracoes import CAMPO_DATA_INGESTAO, CAMPO_ORIGEM, DADOS_BRONZE
from src.ingestao.cliente_jooble import buscar_vagas

logger = logging.getLogger(__name__)

PALAVRAS_CHAVE_PADRAO = ["tecnologia", "desenvolvedor", "programador", "dados", "software", "sistemas"]
MAXIMO_PAGINAS_POR_PALAVRA = 2


def _adicionar_metadados(registro: dict, data_ingestao: str, origem: str) -> dict:
    return {**registro, CAMPO_DATA_INGESTAO: data_ingestao, CAMPO_ORIGEM: origem}


def executar(
    palavras_chave: list = None,
    maximo_paginas_por_palavra: int = MAXIMO_PAGINAS_POR_PALAVRA,
) -> int:
    """Coleta vagas de tecnologia na Jooble para cada palavra-chave e grava a camada Bronze."""
    palavras_chave = palavras_chave or PALAVRAS_CHAVE_PADRAO
    data_ingestao = date.today().isoformat()
    diretorio_saida = DADOS_BRONZE / "jooble" / data_ingestao
    diretorio_saida.mkdir(parents=True, exist_ok=True)

    total_vagas = 0
    ids_vistos = set()
    for palavra in palavras_chave:
        vagas_da_palavra = []
        for pagina in range(1, maximo_paginas_por_palavra + 1):
            resposta = buscar_vagas(pagina=pagina, palavras_chave=palavra, localizacao="")
            vagas = resposta.get("jobs", [])
            if not vagas:
                logger.info("'%s' página %s sem resultados, encerrando.", palavra, pagina)
                break

            novas = [v for v in vagas if v.get("id") not in ids_vistos]
            ids_vistos.update(v.get("id") for v in novas)
            vagas_da_palavra.extend(novas)

        if vagas_da_palavra:
            vagas_com_metadados = [_adicionar_metadados(v, data_ingestao, "jooble") for v in vagas_da_palavra]
            caminho_arquivo = diretorio_saida / f"vagas_{palavra.replace(' ', '_')}.json"
            caminho_arquivo.write_text(
                json.dumps(vagas_com_metadados, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            total_vagas += len(vagas_com_metadados)
            logger.info("'%s': %s vagas novas gravadas em %s", palavra, len(vagas_com_metadados), caminho_arquivo)

    logger.info("Ingestão Jooble concluída: %s vagas únicas em %s", total_vagas, diretorio_saida)
    return total_vagas


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
