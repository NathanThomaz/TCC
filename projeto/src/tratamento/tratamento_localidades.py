"""Camada Silver — integração das vagas tratadas com dados geográficos do IBGE.

Associa cada vaga ao seu município/UF/região a partir do texto de localização
retornado pela Adzuna, e agrega população estimada por UF (regras da seção
3.4.2 do Capítulo 3: "integração com dados geográficos do IBGE").
"""

import json
import logging
import re

import pandas as pd

from src.comum.configuracoes import DADOS_BRONZE, DADOS_SILVER

logger = logging.getLogger(__name__)


def _normalizar(texto: str) -> str:
    if not isinstance(texto, str):
        return ""
    texto = texto.strip().lower()
    return re.sub(r"\s+", " ", texto)


def _arquivo_mais_recente(padrao: str):
    arquivos = sorted((DADOS_BRONZE / "ibge").glob(padrao))
    if not arquivos:
        raise FileNotFoundError(f"Nenhum arquivo Bronze do IBGE encontrado para o padrão '{padrao}'")
    return arquivos[-1]


def _carregar_estados() -> pd.DataFrame:
    conteudo = json.loads(_arquivo_mais_recente("*/estados.json").read_text(encoding="utf-8"))
    estados = conteudo["estados"]
    return pd.DataFrame(
        [
            {
                "id_estado": str(e["id"]),
                "uf": e["sigla"],
                "nome_estado": e["nome"],
                "regiao": e["regiao"]["nome"],
            }
            for e in estados
        ]
    )


def _carregar_municipios() -> pd.DataFrame:
    conteudo = json.loads(_arquivo_mais_recente("*/municipios.json").read_text(encoding="utf-8"))
    linhas = [
        {"uf": uf, "nome_municipio": m["nome"], "nome_municipio_normalizado": _normalizar(m["nome"])}
        for uf, municipios in conteudo["municipios_por_uf"].items()
        for m in municipios
    ]
    return pd.DataFrame(linhas)


def _carregar_populacao_por_estado() -> pd.DataFrame:
    conteudo = json.loads(_arquivo_mais_recente("*/populacao_estados.json").read_text(encoding="utf-8"))
    series = conteudo["populacao"][0]["resultados"][0]["series"]
    linhas = []
    for item in series:
        localidade = item["localidade"]
        ultimo_ano = max(item["serie"].keys())
        valor = item["serie"][ultimo_ano]
        linhas.append({"id_estado": str(localidade["id"]), "populacao": pd.to_numeric(valor, errors="coerce")})
    return pd.DataFrame(linhas)


def _inferir_localizacao(localizacao_bruta: str, estados: pd.DataFrame, municipios: pd.DataFrame) -> pd.Series:
    """Tenta inferir o município/UF a partir do texto de localização retornado pela Adzuna.

    Estratégia: casa o primeiro trecho (antes da vírgula) com um município conhecido,
    obtendo município e UF juntos; se não encontrar, casa o último trecho com o nome
    do estado (localização só ao nível de UF, sem município).
    """
    if not isinstance(localizacao_bruta, str) or not localizacao_bruta:
        return pd.Series({"municipio": None, "uf": None})

    partes = [p.strip() for p in localizacao_bruta.split(",")]

    nome_municipio_normalizado = _normalizar(partes[0])
    correspondencia_municipio = municipios.loc[
        municipios["nome_municipio_normalizado"] == nome_municipio_normalizado
    ]
    if not correspondencia_municipio.empty:
        linha = correspondencia_municipio.iloc[0]
        return pd.Series({"municipio": linha["nome_municipio"], "uf": linha["uf"]})

    nome_estado_normalizado = _normalizar(partes[-1])
    correspondencia_estado = estados.loc[estados["nome_estado"].apply(_normalizar) == nome_estado_normalizado]
    if not correspondencia_estado.empty:
        return pd.Series({"municipio": None, "uf": correspondencia_estado.iloc[0]["uf"]})

    return pd.Series({"municipio": None, "uf": None})


def executar() -> pd.DataFrame:
    """Enriquece as vagas tratadas com município, UF, região e população, gravando o resultado em Parquet."""
    caminho_vagas = DADOS_SILVER / "vagas" / "vagas.parquet"
    if not caminho_vagas.exists():
        raise FileNotFoundError(
            f"{caminho_vagas} não encontrado — execute src.tratamento.tratamento_vagas antes."
        )

    vagas = pd.read_parquet(caminho_vagas)
    estados = _carregar_estados()
    municipios = _carregar_municipios()
    populacao = _carregar_populacao_por_estado()

    estados_com_populacao = estados.merge(populacao, on="id_estado", how="left")

    localizacao_inferida = vagas["localizacao_bruta"].apply(
        lambda loc: _inferir_localizacao(loc, estados, municipios)
    )
    vagas = pd.concat([vagas, localizacao_inferida], axis=1)

    vagas_geolocalizadas = vagas.merge(
        estados_com_populacao[["uf", "nome_estado", "regiao", "populacao"]], on="uf", how="left"
    )

    nao_localizadas = vagas_geolocalizadas["uf"].isna().sum()
    if nao_localizadas:
        logger.warning("%s vaga(s) sem UF inferida a partir da localização bruta.", nao_localizadas)

    destino = DADOS_SILVER / "localidades"
    destino.mkdir(parents=True, exist_ok=True)
    vagas_geolocalizadas.to_parquet(destino / "vagas_geolocalizadas.parquet", index=False)
    return vagas_geolocalizadas


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
