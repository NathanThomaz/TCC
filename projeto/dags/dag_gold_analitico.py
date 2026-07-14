"""DAG Gold — construção do modelo dimensional e avaliação da qualidade dos dados.

Disparada por dag_silver_tratamento ao final do reprocessamento da camada Silver.
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

from src.analitico.tabelas_gold import executar as executar_tabelas_gold
from src.qualidade.metricas import gerar_relatorio as gerar_relatorio_qualidade

ARGUMENTOS_PADRAO = {
    "owner": "nathan.thomaz",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["nathanthomaz@gmail.com"],
}

with DAG(
    dag_id="dag_gold_analitico",
    description="Construção do modelo dimensional (fato + dimensões) e métricas de qualidade da camada Gold",
    default_args=ARGUMENTOS_PADRAO,
    schedule=None,
    start_date=datetime(2026, 3, 1),
    catchup=False,
    tags=["gold"],
) as dag:

    construir_tabelas_gold = PythonOperator(
        task_id="construir_tabelas_gold",
        python_callable=executar_tabelas_gold,
    )

    avaliar_qualidade_dos_dados = PythonOperator(
        task_id="avaliar_qualidade_dos_dados",
        python_callable=gerar_relatorio_qualidade,
    )

    construir_tabelas_gold >> avaliar_qualidade_dos_dados
