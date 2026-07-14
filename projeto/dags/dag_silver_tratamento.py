"""DAG Silver — limpeza das vagas e integração com dados geográficos do IBGE.

Disparada por dag_bronze_adzuna. Ao final, dispara a DAG dag_gold_analitico.
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator

from src.tratamento.tratamento_localidades import executar as executar_tratamento_localidades
from src.tratamento.tratamento_vagas import executar as executar_tratamento_vagas

ARGUMENTOS_PADRAO = {
    "owner": "nathan.thomaz",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["nathanthomaz@gmail.com"],
}

with DAG(
    dag_id="dag_silver_tratamento",
    description="Limpeza das vagas e integração com dados geográficos do IBGE (camada Silver)",
    default_args=ARGUMENTOS_PADRAO,
    schedule=None,
    start_date=datetime(2026, 3, 1),
    catchup=False,
    tags=["silver"],
) as dag:

    tratar_vagas = PythonOperator(
        task_id="tratar_vagas",
        python_callable=executar_tratamento_vagas,
    )

    integrar_localidades = PythonOperator(
        task_id="integrar_localidades",
        python_callable=executar_tratamento_localidades,
    )

    disparar_dag_gold = TriggerDagRunOperator(
        task_id="disparar_dag_gold_analitico",
        trigger_dag_id="dag_gold_analitico",
    )

    tratar_vagas >> integrar_localidades >> disparar_dag_gold
