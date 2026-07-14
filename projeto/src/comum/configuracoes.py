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

# --- API IBGE ---
IBGE_BASE_URL = os.getenv("IBGE_BASE_URL", "https://servicodados.ibge.gov.br/api")

# --- Metadados de rastreabilidade da camada Bronze ---
CAMPO_DATA_INGESTAO = "_data_ingestao"
CAMPO_ORIGEM = "_origem"
