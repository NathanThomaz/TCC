"""DAG Bronze — coleta diária de vagas de emprego na API Adzuna.

Ao final, dispara a DAG dag_silver_tratamento para reprocessar a camada Silver.
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator

from src.ingestao.ingestao_adzuna import executar as executar_ingestao_adzuna

ARGUMENTOS_PADRAO = {
    "owner": "nathan.thomaz",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["nathanthomaz@gmail.com"],
}

with DAG(
    dag_id="dag_bronze_adzuna",
    description="Ingestão Bronze das vagas de emprego da API Adzuna",
    default_args=ARGUMENTOS_PADRAO,
    schedule="@daily",
    start_date=datetime(2026, 3, 1),
    catchup=False,
    tags=["bronze", "adzuna"],
) as dag:

    coletar_vagas_adzuna = PythonOperator(
        task_id="coletar_vagas_adzuna",
        python_callable=executar_ingestao_adzuna,
    )

    disparar_dag_silver = TriggerDagRunOperator(
        task_id="disparar_dag_silver_tratamento",
        trigger_dag_id="dag_silver_tratamento",
    )

    coletar_vagas_adzuna >> disparar_dag_silver
