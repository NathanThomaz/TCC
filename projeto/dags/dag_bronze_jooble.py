"""DAG Bronze — coleta semanal de vagas de tecnologia na API da Jooble.

Segunda fonte de vagas do projeto. Semanal (não diária) e com poucas páginas por
palavra-chave para preservar a cota gratuita de 500 requisições da chave. Não
dispara a DAG Silver diretamente — os arquivos ficam disponíveis para o próximo
processamento acionado por dag_bronze_adzuna (diária), evitando duas cargas
concorrentes da camada Silver no mesmo dia.
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

from src.ingestao.ingestao_jooble import executar as executar_ingestao_jooble

ARGUMENTOS_PADRAO = {
    "owner": "nathan.thomaz",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["nathanthomaz@gmail.com"],
}

with DAG(
    dag_id="dag_bronze_jooble",
    description="Ingestão Bronze das vagas de tecnologia da API Jooble",
    default_args=ARGUMENTOS_PADRAO,
    schedule="@weekly",
    start_date=datetime(2026, 3, 1),
    catchup=False,
    tags=["bronze", "jooble"],
) as dag:

    coletar_vagas_jooble = PythonOperator(
        task_id="coletar_vagas_jooble",
        python_callable=executar_ingestao_jooble,
    )
