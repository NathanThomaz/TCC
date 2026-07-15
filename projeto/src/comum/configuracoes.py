"""Configurações centrais do pipeline: caminhos de dados e variáveis de ambiente."""

import os
from pathlib import Path

from dotenv import load_dotenv

RAIZ_PROJETO = Path(__file__).resolve().parents[2]

load_dotenv(RAIZ_PROJETO / ".env")

# --- Camadas da Arquitetura Medalhão ---
DADOS_BRONZE = RAIZ_PROJETO / "dados" / "bronze"
DADOS_SILVER = RAIZ_PROJETO / "dados" / "silver"
DADOS_GOLD = RAIZ_PROJETO / "dados" / "gold"

# --- API Adzuna ---
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")
ADZUNA_PAIS = os.getenv("ADZUNA_PAIS", "br")
ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs"
ADZUNA_CATEGORIA_ALVO = os.getenv("ADZUNA_CATEGORIA_ALVO", "it-jobs")

# --- API Jooble ---
JOOBLE_API_KEY = os.getenv("JOOBLE_API_KEY", "")
JOOBLE_BASE_URL = "https://jooble.org/api"
JOOBLE_PALAVRAS_CHAVE = os.getenv("JOOBLE_PALAVRAS_CHAVE", "tecnologia da informação")
JOOBLE_LOCALIZACAO = os.getenv("JOOBLE_LOCALIZACAO", "Brasil")

# --- APIs de vagas remotas (sem autenticação) ---
REMOTEOK_BASE_URL = "https://remoteok.com/api"
REMOTIVE_BASE_URL = "https://remotive.com/api/remote-jobs"
REMOTIVE_CATEGORIA = os.getenv("REMOTIVE_CATEGORIA", "software-dev")
ARBEITNOW_BASE_URL = "https://www.arbeitnow.com/api/job-board-api"

# --- API IBGE ---
IBGE_BASE_URL = os.getenv("IBGE_BASE_URL", "https://servicodados.ibge.gov.br/api")

# --- Metadados de rastreabilidade da camada Bronze ---
CAMPO_DATA_INGESTAO = "_data_ingestao"
CAMPO_ORIGEM = "_origem"
