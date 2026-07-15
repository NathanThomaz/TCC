"""Camada Silver — integração das vagas tratadas com dados geográficos do IBGE.

Associa cada vaga ao seu município/UF/região a partir do texto de localização
retornado pelas fontes, agrega população estimada por UF (regras da seção 3.4.2
do Capítulo 3), e classifica cada vaga como nacional ou internacional.

A Adzuna já filtra por Brasil na origem (country=br), então qualquer vaga dessa
fonte é sempre classificada como nacional, mesmo quando a UF não é identificada.
A Jooble não tem esse filtro — para ela, uma vaga só é nacional quando a UF é
identificada, ou quando "brasil"/"brazil" aparece no título/descrição (comum em
vagas remotas anunciadas por agências internacionais para candidatos no Brasil).
"""

import json
import logging
import re

import pandas as pd

from src.comum.configuracoes import DADOS_BRONZE, DADOS_SILVER

logger = logging.getLogger(__name__)

MARCADOR_BRASIL_NO_TEXTO = re.compile(r"\bbrasil\b|\bbrazil\b")


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
                "nome_estado_normalizado": _normalizar(e["nome"]),
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


def _tentar_localizar_no_brasil(localizacao_bruta: str, estados: pd.DataFrame, municipios: pd.DataFrame):
    """Tenta casar qualquer trecho do texto de localização com um município ou
    estado conhecido — não assume mais que o formato é sempre "cidade, estado"."""
    if not isinstance(localizacao_bruta, str) or not localizacao_bruta:
        return None, None

    partes = [_normalizar(p) for p in localizacao_bruta.split(",")]
    for parte in partes:
        correspondencia = municipios.loc[municipios["nome_municipio_normalizado"] == parte]
        if not correspondencia.empty:
            linha = correspondencia.iloc[0]
            return linha["nome_municipio"], linha["uf"]

    for parte in partes:
        correspondencia = estados.loc[estados["nome_estado_normalizado"] == parte]
        if not correspondencia.empty:
            return None, correspondencia.iloc[0]["uf"]

    return None, None


def _classificar_localizacao(linha: pd.Series, estados: pd.DataFrame, municipios: pd.DataFrame) -> pd.Series:
    municipio, uf = _tentar_localizar_no_brasil(linha["localizacao_bruta"], estados, municipios)
    if uf is not None:
        return pd.Series({"municipio": municipio, "uf": uf, "pais": "Brasil"})

    if linha.get("fonte") == "adzuna":
        # A Adzuna já filtra por country=br na origem: UF desconhecida, mas país é sempre Brasil.
        return pd.Series({"municipio": None, "uf": None, "pais": "Brasil"})

    texto_vaga = f"{linha.get('titulo', '')} {linha.get('descricao', '')} {linha.get('localizacao_bruta', '')}"
    if MARCADOR_BRASIL_NO_TEXTO.search(_normalizar(texto_vaga)):
        return pd.Series({"municipio": None, "uf": None, "pais": "Brasil"})

    return pd.Series({"municipio": None, "uf": None, "pais": "Internacional"})


def executar() -> pd.DataFrame:
    """Enriquece as vagas tratadas com município, UF, região, população e escopo
    nacional/internacional, gravando o resultado em Parquet."""
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

    classificacao = vagas.apply(lambda linha: _classificar_localizacao(linha, estados, municipios), axis=1)
    vagas = pd.concat([vagas, classificacao], axis=1)

    # Marcadores explícitos por UF (em vez de deixar nulo) para não misturar
    # "Brasil sem UF identificada" (NI) com "fora do Brasil" (XX) na dimensão.
    sem_uf_brasil = vagas["uf"].isna() & (vagas["pais"] == "Brasil")
    sem_uf_internacional = vagas["uf"].isna() & (vagas["pais"] == "Internacional")
    vagas.loc[sem_uf_brasil, "uf"] = "NI"
    vagas.loc[sem_uf_internacional, "uf"] = "XX"

    vagas_geolocalizadas = vagas.merge(
        estados_com_populacao[["uf", "nome_estado", "regiao", "populacao"]], on="uf", how="left"
    )

    # "Não informado" cobre vagas brasileiras sem UF identificada; "Internacional"
    # é um membro explícito da dimensão, não um valor faltante.
    vagas_geolocalizadas.loc[vagas_geolocalizadas["uf"] == "XX", "nome_estado"] = "Internacional"
    vagas_geolocalizadas.loc[vagas_geolocalizadas["uf"] == "XX", "regiao"] = "Internacional"
    vagas_geolocalizadas["nome_estado"] = vagas_geolocalizadas["nome_estado"].fillna("Não informado")
    vagas_geolocalizadas["regiao"] = vagas_geolocalizadas["regiao"].fillna("Não informado")
    vagas_geolocalizadas["municipio"] = vagas_geolocalizadas["municipio"].fillna("Não informado")

    total = len(vagas_geolocalizadas)
    com_uf = (~vagas_geolocalizadas["uf"].isin(["NI", "XX"])).sum()
    internacionais = (vagas_geolocalizadas["uf"] == "XX").sum()
    logger.info(
        "Geolocalização: %s/%s com UF identificada, %s internacionais, %s nacionais sem UF",
        com_uf, total, internacionais, total - com_uf - internacionais,
    )

    destino = DADOS_SILVER / "localidades"
    destino.mkdir(parents=True, exist_ok=True)
    vagas_geolocalizadas.to_parquet(destino / "vagas_geolocalizadas.parquet", index=False)
    return vagas_geolocalizadas


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
