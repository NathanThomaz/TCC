"""DAG Bronze — coleta semanal de dados geográficos e populacionais da API do IBGE."""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

from src.ingestao.ingestao_ibge import executar as executar_ingestao_ibge

ARGUMENTOS_PADRAO = {
    "owner": "nathan.thomaz",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["nathanthomaz@gmail.com"],
}

with DAG(
    dag_id="dag_bronze_ibge",
    description="Ingestão Bronze de dados geográficos e populacionais da API do IBGE",
    default_args=ARGUMENTOS_PADRAO,
    schedule="@weekly",
    start_date=datetime(2026, 3, 1),
    catchup=False,
    tags=["bronze", "ibge"],
) as dag:

    coletar_dados_ibge = PythonOperator(
        task_id="coletar_dados_ibge",
        python_callable=executar_ingestao_ibge,
    )
