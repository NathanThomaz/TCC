"""Camada Gold — modelo dimensional (Star Schema) do mercado de trabalho em tecnologia.

Grão da fato: uma vaga de TI publicada em uma das cinco fontes (Adzuna, Jooble,
RemoteOK, Remotive, Arbeitnow).

- fato_vagas                    : métricas por vaga (salários, anos de experiência, contagem) + chaves para as dimensões
- dim_tempo                     : calendário de publicação das vagas
- dim_localizacao               : município, UF, região, população (IBGE) e escopo nacional/internacional
- dim_empresa                   : empresas anunciantes
- dim_categoria                 : cargo/área da vaga, classificado a partir do título
- dim_habilidade                : habilidades técnicas catalogadas, por grupo
- dim_fonte                     : fonte de ingestão e portal de origem da vaga
- dim_senioridade                : nível de senioridade classificado a partir do título
- dim_modalidade                 : remoto, híbrido, presencial ou não informado
- ponte_vaga_habilidade          : relação N:N entre vagas e habilidades
- benchmark_salarial_categoria   : distribuição salarial de referência da Adzuna (histograma)
"""

import json
import logging

import pandas as pd

from src.comum.configuracoes import ADZUNA_CATEGORIA_ALVO, DADOS_BRONZE, DADOS_GOLD, DADOS_SILVER
from src.comum.empresas_verificadas import EMPRESAS_VERIFICADAS
from src.comum.normalizacao_empresa import chave_agrupamento_empresa

logger = logging.getLogger(__name__)

CATEGORIA_POR_HABILIDADE = {
    # Linguagens
    "python": "linguagem", "java": "linguagem", "javascript": "linguagem", "typescript": "linguagem",
    "php": "linguagem", "ruby": "linguagem", "golang": "linguagem", "go": "linguagem", "rust": "linguagem",
    "c#": "linguagem", "c++": "linguagem", "kotlin": "linguagem", "swift": "linguagem", "scala": "linguagem",
    "dart": "linguagem", "elixir": "linguagem", "abap": "linguagem", "delphi": "linguagem",
    # Frontend / frameworks
    "react": "framework", "angular": "framework", "vue": "framework", "next.js": "framework",
    "nuxt": "framework", "svelte": "framework", "html": "framework", "css": "framework", "sass": "framework",
    "tailwind": "framework", "bootstrap": "framework", "jquery": "framework",
    "node.js": "framework", "node": "framework", "express": "framework", "django": "framework",
    "flask": "framework", "fastapi": "framework", "spring boot": "framework", "spring": "framework",
    "laravel": "framework", "rails": "framework", ".net": "framework", "asp.net": "framework", "nestjs": "framework",
    # Mobile
    "android": "mobile", "ios": "mobile", "flutter": "mobile", "react native": "mobile", "xamarin": "mobile",
    # Banco de dados
    "sql": "banco_de_dados", "mysql": "banco_de_dados", "postgresql": "banco_de_dados", "postgres": "banco_de_dados",
    "oracle": "banco_de_dados", "sql server": "banco_de_dados", "mongodb": "banco_de_dados", "redis": "banco_de_dados",
    "cassandra": "banco_de_dados", "dynamodb": "banco_de_dados", "elasticsearch": "banco_de_dados",
    "firebase": "banco_de_dados", "sqlite": "banco_de_dados", "nosql": "banco_de_dados",
    # Cloud / infraestrutura
    "aws": "cloud", "azure": "cloud", "gcp": "cloud", "google cloud": "cloud",
    "docker": "ferramenta", "kubernetes": "ferramenta", "k8s": "ferramenta", "terraform": "ferramenta",
    "ansible": "ferramenta", "jenkins": "ferramenta", "gitlab ci": "ferramenta", "github actions": "ferramenta",
    "ci/cd": "ferramenta", "linux": "ferramenta", "nginx": "ferramenta", "apache": "ferramenta",
    # Dados / BI / IA
    "power bi": "dados_e_ia", "tableau": "dados_e_ia", "looker": "dados_e_ia", "qlik": "dados_e_ia",
    "spark": "dados_e_ia", "pyspark": "dados_e_ia", "hadoop": "dados_e_ia", "airflow": "dados_e_ia",
    "dbt": "dados_e_ia", "kafka": "dados_e_ia", "databricks": "dados_e_ia", "snowflake": "dados_e_ia",
    "machine learning": "dados_e_ia", "deep learning": "dados_e_ia", "data science": "dados_e_ia",
    "etl": "dados_e_ia", "big data": "dados_e_ia", "inteligencia artificial": "dados_e_ia",
    # Metodologias / ferramentas gerais
    "git": "ferramenta", "github": "ferramenta", "gitlab": "ferramenta", "bitbucket": "ferramenta",
    "jira": "ferramenta", "confluence": "ferramenta", "scrum": "metodologia", "kanban": "metodologia",
    "agile": "metodologia",
    # Segurança
    "cybersecurity": "seguranca", "pentest": "seguranca", "iso 27001": "seguranca", "firewall": "seguranca",
    # Testes
    "selenium": "teste", "cypress": "teste", "junit": "teste", "pytest": "teste", "tdd": "teste", "bdd": "teste",
    # ERP / CRM
    "sap": "erp_crm", "salesforce": "erp_crm", "totvs": "erp_crm", "protheus": "erp_crm", "dynamics": "erp_crm",
}

NOMES_MESES = {
    1: "janeiro", 2: "fevereiro", 3: "março", 4: "abril", 5: "maio", 6: "junho",
    7: "julho", 8: "agosto", 9: "setembro", 10: "outubro", 11: "novembro", 12: "dezembro",
}

ORDEM_SENIORIDADE = {
    "estágio/trainee": 0, "júnior": 1, "pleno": 2, "sênior": 3, "especialista": 4, "não informado": -1,
}


def _carregar_vagas_geolocalizadas() -> pd.DataFrame:
    caminho = DADOS_SILVER / "localidades" / "vagas_geolocalizadas.parquet"
    if not caminho.exists():
        raise FileNotFoundError(f"{caminho} não encontrado — execute src.tratamento.tratamento_localidades antes.")
    vagas = pd.read_parquet(caminho)
    vagas["chave_agrupamento_empresa"] = vagas["empresa"].apply(chave_agrupamento_empresa)
    return vagas


def _data_publicacao_normalizada(vagas: pd.DataFrame) -> pd.Series:
    datas = pd.to_datetime(vagas["data_publicacao"])
    if datas.dt.tz is not None:
        datas = datas.dt.tz_convert(None)
    return datas.dt.normalize()


def construir_dim_tempo(vagas: pd.DataFrame) -> pd.DataFrame:
    """Gera um calendário contínuo (sem lacunas) entre a menor e a maior data de
    publicação. Uma tabela de datas do Power BI exige um registro para cada dia
    corrido no intervalo — não apenas os dias em que houve vaga publicada."""
    datas_publicacao = _data_publicacao_normalizada(vagas)
    calendario = pd.date_range(datas_publicacao.min(), datas_publicacao.max(), freq="D")
    dim = pd.DataFrame({"data": calendario})
    dim["id_tempo"] = dim["data"].dt.strftime("%Y%m%d").astype(int)
    dim["ano"] = dim["data"].dt.year
    dim["mes"] = dim["data"].dt.month
    dim["nome_mes"] = dim["mes"].map(NOMES_MESES)
    dim["trimestre"] = dim["data"].dt.quarter
    dim["ano_mes"] = dim["data"].dt.to_period("M").astype(str)
    return dim[["id_tempo", "data", "ano", "mes", "nome_mes", "trimestre", "ano_mes"]].sort_values("id_tempo").reset_index(drop=True)


def construir_dim_localizacao(vagas: pd.DataFrame) -> pd.DataFrame:
    dim = vagas[["municipio", "uf", "nome_estado", "regiao", "pais", "populacao"]].drop_duplicates().reset_index(drop=True)
    dim.insert(0, "id_localizacao", dim.index + 1)
    dim["vagas_por_100k_hab"] = None  # calculado após a fato, ver enriquecer_dim_localizacao()
    return dim


def enriquecer_dim_localizacao(dim_localizacao: pd.DataFrame, fato_vagas: pd.DataFrame) -> pd.DataFrame:
    """Adiciona o indicador vagas_por_100k_hab (KPI de distribuição geográfica) à dimensão.

    Só faz sentido para localizações brasileiras com população conhecida — vagas
    internacionais ou sem UF identificada ficam com o indicador nulo."""
    total_por_localizacao = fato_vagas.groupby("id_localizacao").size().rename("total_vagas")
    dim = dim_localizacao.drop(columns=["vagas_por_100k_hab"]).merge(
        total_por_localizacao, on="id_localizacao", how="left"
    )
    dim["total_vagas"] = dim["total_vagas"].fillna(0).astype(int)
    dim["vagas_por_100k_hab"] = (dim["total_vagas"] / dim["populacao"]) * 100_000
    return dim


def construir_dim_empresa(vagas: pd.DataFrame) -> pd.DataFrame:
    """Agrupa grafias quase-idênticas do mesmo nome de empresa (ver
    src.comum.normalizacao_empresa) e escolhe, como nome de exibição, a grafia
    mais frequente dentro de cada grupo."""
    contagem = (
        vagas.groupby(["chave_agrupamento_empresa", "empresa"])
        .agg(ocorrencias=("empresa", "size"), empresa_identificada=("empresa_identificada", "first"))
        .reset_index()
    )
    canonicos = (
        contagem.sort_values("ocorrencias", ascending=False)
        .drop_duplicates("chave_agrupamento_empresa")
        .rename(columns={"empresa": "nome_empresa"})
        .reset_index(drop=True)
    )
    dim = canonicos[["chave_agrupamento_empresa", "nome_empresa", "empresa_identificada"]].reset_index(drop=True)
    dim.insert(0, "id_empresa", dim.index + 1)
    return aplicar_verificacao_cnpj(dim)


def aplicar_verificacao_cnpj(dim_empresa: pd.DataFrame) -> pd.DataFrame:
    """Preenche CNPJ, razão social, situação cadastral, porte e CNAE para as
    empresas com verificação manual junto à Receita Federal (ver
    src/comum/empresas_verificadas.py). Nula para as demais: nenhuma fonte de
    vagas retorna CNPJ, então não é possível validar automaticamente todas."""
    verificadas = pd.DataFrame.from_dict(EMPRESAS_VERIFICADAS, orient="index").reset_index()
    verificadas = verificadas.rename(columns={"index": "chave_agrupamento_empresa"})
    verificadas["cnpj_verificado"] = True

    dim = dim_empresa.merge(verificadas, on="chave_agrupamento_empresa", how="left")
    dim["cnpj_verificado"] = dim["cnpj_verificado"].fillna(False)
    logger.info(
        "Empresas com CNPJ verificado na Receita Federal: %s de %s",
        int(dim["cnpj_verificado"].sum()), len(dim),
    )
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


def construir_dim_fonte(vagas: pd.DataFrame) -> pd.DataFrame:
    dim = vagas[["fonte", "portal_origem"]].drop_duplicates().reset_index(drop=True)
    dim.insert(0, "id_fonte", dim.index + 1)
    return dim


def construir_dim_senioridade(vagas: pd.DataFrame) -> pd.DataFrame:
    dim = vagas[["senioridade"]].drop_duplicates().reset_index(drop=True)
    dim.insert(0, "id_senioridade", dim.index + 1)
    dim["ordem"] = dim["senioridade"].map(ORDEM_SENIORIDADE).fillna(-1).astype(int)
    return dim


def construir_dim_modalidade(vagas: pd.DataFrame) -> pd.DataFrame:
    dim = vagas[["modalidade"]].drop_duplicates().reset_index(drop=True)
    dim.insert(0, "id_modalidade", dim.index + 1)
    return dim


def construir_fato_vagas(
    vagas: pd.DataFrame,
    dim_localizacao: pd.DataFrame,
    dim_empresa: pd.DataFrame,
    dim_categoria: pd.DataFrame,
    dim_fonte: pd.DataFrame,
    dim_senioridade: pd.DataFrame,
    dim_modalidade: pd.DataFrame,
) -> pd.DataFrame:
    fato = vagas.copy()
    fato["data"] = _data_publicacao_normalizada(fato)
    fato["id_tempo"] = fato["data"].dt.strftime("%Y%m%d").astype(int)

    fato = fato.merge(
        dim_localizacao[["id_localizacao", "municipio", "uf", "nome_estado", "regiao", "pais", "populacao"]],
        on=["municipio", "uf", "nome_estado", "regiao", "pais", "populacao"],
        how="left",
    )
    fato = fato.merge(
        dim_empresa[["id_empresa", "chave_agrupamento_empresa"]], on="chave_agrupamento_empresa", how="left"
    )
    fato = fato.merge(dim_categoria[["id_categoria", "categoria"]], on="categoria", how="left")
    fato = fato.merge(dim_fonte[["id_fonte", "fonte", "portal_origem"]], on=["fonte", "portal_origem"], how="left")
    fato = fato.merge(dim_senioridade[["id_senioridade", "senioridade"]], on="senioridade", how="left")
    fato = fato.merge(dim_modalidade[["id_modalidade", "modalidade"]], on="modalidade", how="left")

    fato["salario_medio"] = fato[["salario_min", "salario_max"]].mean(axis=1, skipna=True)
    fato["quantidade"] = 1

    return fato[
        [
            "id_vaga", "id_tempo", "id_localizacao", "id_empresa", "id_categoria", "id_fonte",
            "id_senioridade", "id_modalidade",
            "titulo", "salario_min", "salario_max", "salario_medio", "anos_experiencia_min", "quantidade",
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
    """Distribuição salarial de referência da Adzuna (independente do grão da fato_vagas).

    Só usa a Adzuna: é a única fonte 100% Brasil com valores em uma moeda única (BRL)."""
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
    dim_fonte = construir_dim_fonte(vagas)
    dim_senioridade = construir_dim_senioridade(vagas)
    dim_modalidade = construir_dim_modalidade(vagas)

    fato_vagas = construir_fato_vagas(
        vagas, dim_localizacao, dim_empresa, dim_categoria, dim_fonte, dim_senioridade, dim_modalidade
    )
    dim_localizacao = enriquecer_dim_localizacao(dim_localizacao, fato_vagas)
    ponte_vaga_habilidade = construir_ponte_vaga_habilidade(vagas, dim_habilidade)
    benchmark_salarial_categoria = construir_benchmark_salarial_categoria()

    tabelas = {
        "dim_tempo": dim_tempo,
        "dim_localizacao": dim_localizacao,
        "dim_empresa": dim_empresa,
        "dim_categoria": dim_categoria,
        "dim_habilidade": dim_habilidade,
        "dim_fonte": dim_fonte,
        "dim_senioridade": dim_senioridade,
        "dim_modalidade": dim_modalidade,
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
