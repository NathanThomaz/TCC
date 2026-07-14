"""Camada Silver — limpeza, padronização e enriquecimento das vagas de TI da Adzuna.

Regras aplicadas (Capítulo 3, seção 3.4.2):
- remoção de registros duplicados por chave de negócio (id_vaga)
- exclusão de registros com campos obrigatórios nulos
- validação de domínio (datas válidas, salários não negativos)
- normalização de strings (trim, minúsculas, remoção de espaços duplicados)
- extração de habilidades técnicas a partir da descrição da vaga
- classificação do cargo a partir do título da vaga (a categoria bruta da Adzuna
  é constante quando a coleta já é filtrada por category=it-jobs, então não serve
  como dimensão analítica por si só)
"""

import json
import logging
import re
import unicodedata

import pandas as pd

from src.comum.configuracoes import DADOS_BRONZE, DADOS_SILVER

logger = logging.getLogger(__name__)

CAMPOS_OBRIGATORIOS = ["id_vaga", "titulo", "empresa", "data_publicacao"]

HABILIDADES_CONHECIDAS = [
    "python", "java", "javascript", "typescript", "sql", "nosql", "aws", "azure",
    "gcp", "docker", "kubernetes", "react", "angular", "vue", "spark", "airflow",
    "power bi", "tableau", "linux", "git", "scrum", "machine learning", "data science",
    "etl", "hadoop", "postgresql", "mongodb", "c#", "c++", "go", "scala",
]

# Classificação de cargo a partir de palavras-chave no título da vaga, avaliada em
# ordem — a primeira categoria cujo termo aparecer no título é atribuída à vaga.
# As palavras-chave são comparadas sem acentuação (ver _remover_acentos), por isso
# são escritas aqui já sem acentos.
CARGOS_POR_PALAVRA_CHAVE = [
    ("dados e analytics", [
        "dados", "data engineer", "data scientist", "analytics", "bi ", "business intelligence",
        "inteligencia de negocios", "inteligencia de dados",
    ]),
    ("infraestrutura e cloud", [
        "devops", "sre", "infraestrutura", "infra", "cloud", "redes", "sysadmin", "administrador de sistemas",
    ]),
    ("segurança da informação", ["seguranca", "security", "cyber", "soc "]),
    ("suporte técnico", [
        "suporte", "helpdesk", "help desk", "service desk", "atendimento tecnico",
        "tecnico de informatica", "tecnico de ti", "tecnico de instalacao", "tecnico de manutencao",
        "tecnico de telecomunicacoes",
    ]),
    ("qualidade e testes", ["qa ", "quality", "teste", "tester"]),
    ("gestão de ti", [
        "gerente", "coordenador", "gestor", "head de", "lider tecnico", "tech lead", "lider de implantacao",
    ]),
    ("arquitetura de soluções", ["arquiteto", "architect"]),
    ("produto e agilidade", ["product owner", "scrum master", "produto"]),
    ("desenvolvimento", [
        "desenvolvedor", "developer", "programador", "engenheiro de software", "software engineer",
        "front-end", "frontend", "front end", "back-end", "backend", "back end", "full stack", "fullstack",
        "mobile", "engenheiro de aplicacoes",
    ]),
    ("design de produto", ["designer", "ui/ux", "ux/ui", "design de produto"]),
    ("consultoria e sistemas erp", ["consultor sap", "consultor erp", "salesforce", "sap ", "erp "]),
]


def _normalizar_string(valor) -> str:
    if not isinstance(valor, str):
        return ""
    return re.sub(r"\s+", " ", valor).strip().lower()


def _remover_acentos(texto: str) -> str:
    """Remove acentuação para permitir comparação de palavras-chave insensível a acentos."""
    return "".join(caractere for caractere in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(caractere))


def _extrair_habilidades(descricao: str) -> list:
    texto = _remover_acentos(_normalizar_string(descricao))
    return sorted({habilidade for habilidade in HABILIDADES_CONHECIDAS if habilidade in texto})


def _classificar_cargo(titulo: str) -> str:
    texto = _remover_acentos(_normalizar_string(titulo))
    for cargo, palavras_chave in CARGOS_POR_PALAVRA_CHAVE:
        if any(palavra in texto for palavra in palavras_chave):
            return cargo
    return "outros"


def _carregar_bronze_adzuna() -> pd.DataFrame:
    registros = []
    diretorio_adzuna = DADOS_BRONZE / "adzuna"
    for arquivo in diretorio_adzuna.glob("*/vagas_pagina_*.json"):
        registros.extend(json.loads(arquivo.read_text(encoding="utf-8")))

    if not registros:
        logger.warning("Nenhum arquivo de vagas encontrado em %s", diretorio_adzuna)
        return pd.DataFrame()

    linhas = []
    for registro in registros:
        localizacao = registro.get("location", {}) or {}
        categoria = registro.get("category", {}) or {}
        empresa = registro.get("company", {}) or {}
        titulo = _normalizar_string(registro.get("title"))
        linhas.append(
            {
                "id_vaga": registro.get("id"),
                "titulo": titulo,
                "empresa": _normalizar_string(empresa.get("display_name")),
                "localizacao_bruta": localizacao.get("display_name"),
                "salario_min": registro.get("salary_min"),
                "salario_max": registro.get("salary_max"),
                "data_publicacao": registro.get("created"),
                "categoria_adzuna": _normalizar_string(categoria.get("label")),
                "categoria": _classificar_cargo(titulo),
                "descricao": registro.get("description", ""),
                "habilidades": _extrair_habilidades(registro.get("description", "")),
            }
        )

    return pd.DataFrame(linhas)


def executar() -> pd.DataFrame:
    """Executa o tratamento Silver das vagas e grava o resultado em Parquet."""
    df = _carregar_bronze_adzuna()
    if df.empty:
        return df

    antes = len(df)
    df = df.drop_duplicates(subset="id_vaga")
    df = df.dropna(subset=CAMPOS_OBRIGATORIOS)

    df["data_publicacao"] = pd.to_datetime(df["data_publicacao"], errors="coerce")
    df = df.dropna(subset=["data_publicacao"])

    for coluna_salario in ["salario_min", "salario_max"]:
        df[coluna_salario] = pd.to_numeric(df[coluna_salario], errors="coerce")
        df.loc[df[coluna_salario] < 0, coluna_salario] = pd.NA

    logger.info("Tratamento Silver de vagas: %s -> %s registros", antes, len(df))
    logger.info("Distribuição de cargos: %s", df["categoria"].value_counts().to_dict())

    destino = DADOS_SILVER / "vagas"
    destino.mkdir(parents=True, exist_ok=True)
    df.to_parquet(destino / "vagas.parquet", index=False)
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
