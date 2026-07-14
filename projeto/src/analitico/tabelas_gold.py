"""Camada Gold — modelo dimensional (Star Schema) do mercado de trabalho em tecnologia.

Grão da fato: uma vaga de TI publicada na Adzuna.

- fato_vagas                    : métricas por vaga (salários, contagem) + chaves para as dimensões
- dim_tempo                     : calendário de publicação das vagas
- dim_localizacao               : município, UF, região e população estimada (IBGE)
- dim_empresa                   : empresas anunciantes
- dim_categoria                 : cargo/área da vaga, classificado a partir do título
- dim_habilidade                : habilidades técnicas catalogadas, por grupo
- ponte_vaga_habilidade          : relação N:N entre vagas e habilidades
- benchmark_salarial_categoria   : distribuição salarial de referência da Adzuna (histograma)
"""

import json
import logging

import pandas as pd

from src.comum.configuracoes import ADZUNA_CATEGORIA_ALVO, DADOS_GOLD, DADOS_BRONZE, DADOS_SILVER

logger = logging.getLogger(__name__)

CATEGORIA_POR_HABILIDADE = {
    "python": "linguagem", "java": "linguagem", "javascript": "linguagem",
    "typescript": "linguagem", "c#": "linguagem", "c++": "linguagem", "go": "linguagem",
    "scala": "linguagem",
    "sql": "banco_de_dados", "nosql": "banco_de_dados", "postgresql": "banco_de_dados",
    "mongodb": "banco_de_dados",
    "aws": "cloud", "azure": "cloud", "gcp": "cloud",
    "docker": "ferramenta", "kubernetes": "ferramenta", "git": "ferramenta",
    "linux": "ferramenta", "hadoop": "ferramenta", "spark": "ferramenta",
    "airflow": "ferramenta", "power bi": "ferramenta", "tableau": "ferramenta",
    "react": "framework", "angular": "framework", "vue": "framework",
    "scrum": "metodologia",
    "machine learning": "disciplina", "data science": "disciplina", "etl": "disciplina",
}

NOMES_MESES = {
    1: "janeiro", 2: "fevereiro", 3: "março", 4: "abril", 5: "maio", 6: "junho",
    7: "julho", 8: "agosto", 9: "setembro", 10: "outubro", 11: "novembro", 12: "dezembro",
}


def _carregar_vagas_geolocalizadas() -> pd.DataFrame:
    caminho = DADOS_SILVER / "localidades" / "vagas_geolocalizadas.parquet"
    if not caminho.exists():
        raise FileNotFoundError(f"{caminho} não encontrado — execute src.tratamento.tratamento_localidades antes.")
    vagas = pd.read_parquet(caminho)

    # Preenche atributos de localização ausentes com um "membro desconhecido" explícito,
    # em vez de deixar nulos soltos nas dimensões (boa prática de modelagem dimensional).
    vagas["municipio"] = vagas["municipio"].fillna("Não informado")
    vagas["uf"] = vagas["uf"].fillna("NI")
    vagas["nome_estado"] = vagas["nome_estado"].fillna("Não informado")
    vagas["regiao"] = vagas["regiao"].fillna("Não informado")
    return vagas


def _data_publicacao_normalizada(vagas: pd.DataFrame) -> pd.Series:
    datas = pd.to_datetime(vagas["data_publicacao"])
    if datas.dt.tz is not None:
        datas = datas.dt.tz_convert(None)
    return datas.dt.normalize()


def construir_dim_tempo(vagas: pd.DataFrame) -> pd.DataFrame:
    datas_unicas = _data_publicacao_normalizada(vagas).drop_duplicates().reset_index(drop=True)
    dim = pd.DataFrame({"data": datas_unicas})
    dim["id_tempo"] = dim["data"].dt.strftime("%Y%m%d").astype(int)
    dim["ano"] = dim["data"].dt.year
    dim["mes"] = dim["data"].dt.month
    dim["nome_mes"] = dim["mes"].map(NOMES_MESES)
    dim["trimestre"] = dim["data"].dt.quarter
    dim["ano_mes"] = dim["data"].dt.to_period("M").astype(str)
    return dim[["id_tempo", "data", "ano", "mes", "nome_mes", "trimestre", "ano_mes"]].sort_values("id_tempo").reset_index(drop=True)


def construir_dim_localizacao(vagas: pd.DataFrame) -> pd.DataFrame:
    dim = vagas[["municipio", "uf", "nome_estado", "regiao", "populacao"]].drop_duplicates().reset_index(drop=True)
    dim.insert(0, "id_localizacao", dim.index + 1)
    dim["vagas_por_100k_hab"] = None  # calculado após a fato, ver enriquecer_dim_localizacao()
    return dim


def enriquecer_dim_localizacao(dim_localizacao: pd.DataFrame, fato_vagas: pd.DataFrame) -> pd.DataFrame:
    """Adiciona o indicador vagas_por_100k_hab (KPI de distribuição geográfica) à dimensão."""
    total_por_localizacao = fato_vagas.groupby("id_localizacao").size().rename("total_vagas")
    dim = dim_localizacao.drop(columns=["vagas_por_100k_hab"]).merge(
        total_por_localizacao, on="id_localizacao", how="left"
    )
    dim["total_vagas"] = dim["total_vagas"].fillna(0).astype(int)
    dim["vagas_por_100k_hab"] = (dim["total_vagas"] / dim["populacao"]) * 100_000
    return dim


def construir_dim_empresa(vagas: pd.DataFrame) -> pd.DataFrame:
    dim = vagas[["empresa"]].drop_duplicates().reset_index(drop=True).rename(columns={"empresa": "nome_empresa"})
    dim.insert(0, "id_empresa", dim.index + 1)
    return dim


def construir_dim_categoria(vagas: pd.DataFrame) -> pd.DataFrame:
    dim = vagas[["categoria"]].drop_duplicates().reset_index(drop=True)
    dim.insert(0, "id_categoria", dim.index + 1)
    return dim


def construir_dim_habilidade(vagas: pd.DataFrame) -> pd.DataFrame:
    habilidades = (
        vagas[["habilidades"]]
        .explode("habilidades")
        .dropna(subset=["habilidades"])
        .rename(columns={"habilidades": "habilidade"})
        .drop_duplicates()
        .reset_index(drop=True)
    )
    habilidades["categoria_skill"] = habilidades["habilidade"].map(CATEGORIA_POR_HABILIDADE).fillna("outra")
    habilidades.insert(0, "id_habilidade", habilidades.index + 1)
    return habilidades


def construir_fato_vagas(
    vagas: pd.DataFrame,
    dim_localizacao: pd.DataFrame,
    dim_empresa: pd.DataFrame,
    dim_categoria: pd.DataFrame,
) -> pd.DataFrame:
    fato = vagas.copy()
    fato["data"] = _data_publicacao_normalizada(fato)
    fato["id_tempo"] = fato["data"].dt.strftime("%Y%m%d").astype(int)

    fato = fato.merge(
        dim_localizacao[["id_localizacao", "municipio", "uf", "nome_estado", "regiao", "populacao"]],
        on=["municipio", "uf", "nome_estado", "regiao", "populacao"],
        how="left",
    )
    fato = fato.rename(columns={"empresa": "nome_empresa"}).merge(
        dim_empresa[["id_empresa", "nome_empresa"]], on="nome_empresa", how="left"
    )
    fato = fato.merge(dim_categoria[["id_categoria", "categoria"]], on="categoria", how="left")

    fato["salario_medio"] = fato[["salario_min", "salario_max"]].mean(axis=1, skipna=True)
    fato["quantidade"] = 1

    return fato[
        [
            "id_vaga", "id_tempo", "id_localizacao", "id_empresa", "id_categoria",
            "titulo", "salario_min", "salario_max", "salario_medio", "quantidade",
        ]
    ]


def construir_ponte_vaga_habilidade(vagas: pd.DataFrame, dim_habilidade: pd.DataFrame) -> pd.DataFrame:
    ponte = (
        vagas[["id_vaga", "habilidades"]]
        .explode("habilidades")
        .dropna(subset=["habilidades"])
        .rename(columns={"habilidades": "habilidade"})
    )
    ponte = ponte.merge(dim_habilidade[["id_habilidade", "habilidade"]], on="habilidade", how="left")
    return ponte[["id_vaga", "id_habilidade"]].reset_index(drop=True)


def construir_benchmark_salarial_categoria(categoria: str = ADZUNA_CATEGORIA_ALVO) -> pd.DataFrame:
    """Distribuição salarial de referência da Adzuna (independente do grão da fato_vagas)."""
    arquivos = sorted((DADOS_BRONZE / "adzuna").glob("*/histograma_salarial.json"))
    if not arquivos:
        logger.warning("Nenhum histograma salarial encontrado em Bronze; tabela de benchmark ficará vazia.")
        return pd.DataFrame(columns=["categoria", "faixa_salarial_min", "quantidade_vagas"])

    conteudo = json.loads(arquivos[-1].read_text(encoding="utf-8"))
    histograma = conteudo.get("histogram", {})
    linhas = [
        {"categoria": categoria, "faixa_salarial_min": int(faixa), "quantidade_vagas": quantidade}
        for faixa, quantidade in histograma.items()
    ]
    return pd.DataFrame(linhas).sort_values("faixa_salarial_min").reset_index(drop=True)


def executar() -> dict:
    """Constrói e grava o modelo dimensional completo (fato + dimensões) da camada Gold."""
    vagas = _carregar_vagas_geolocalizadas()

    dim_tempo = construir_dim_tempo(vagas)
    dim_localizacao = construir_dim_localizacao(vagas)
    dim_empresa = construir_dim_empresa(vagas)
    dim_categoria = construir_dim_categoria(vagas)
    dim_habilidade = construir_dim_habilidade(vagas)

    fato_vagas = construir_fato_vagas(vagas, dim_localizacao, dim_empresa, dim_categoria)
    dim_localizacao = enriquecer_dim_localizacao(dim_localizacao, fato_vagas)
    ponte_vaga_habilidade = construir_ponte_vaga_habilidade(vagas, dim_habilidade)
    benchmark_salarial_categoria = construir_benchmark_salarial_categoria()

    tabelas = {
        "dim_tempo": dim_tempo,
        "dim_localizacao": dim_localizacao,
        "dim_empresa": dim_empresa,
        "dim_categoria": dim_categoria,
        "dim_habilidade": dim_habilidade,
        "fato_vagas": fato_vagas,
        "ponte_vaga_habilidade": ponte_vaga_habilidade,
        "benchmark_salarial_categoria": benchmark_salarial_categoria,
    }

    for nome, df in tabelas.items():
        destino = DADOS_GOLD / nome
        destino.mkdir(parents=True, exist_ok=True)
        df.to_parquet(destino / f"{nome}.parquet", index=False)
        logger.info("Tabela Gold '%s' gravada com %s registros", nome, len(df))

    return tabelas


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
