"""DAG Bronze — coleta semanal de vagas remotas de tecnologia (RemoteOK, Remotive, Arbeitnow).

Três fontes públicas sem autenticação, agrupadas em uma única DAG por serem do
mesmo "nível" (vagas remotas/globais, baixo volume, sem risco de cota) — evita
espalhar DAGs quase idênticas para fontes de menor prioridade que Adzuna/Jooble.
Não dispara a DAG Silver diretamente (mesmo motivo de dag_bronze_jooble): os
arquivos ficam disponíveis para o próximo processamento acionado por
dag_bronze_adzuna (diária).
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

from src.ingestao.ingestao_arbeitnow import executar as executar_ingestao_arbeitnow
from src.ingestao.ingestao_remoteok import executar as executar_ingestao_remoteok
from src.ingestao.ingestao_remotive import executar as executar_ingestao_remotive

ARGUMENTOS_PADRAO = {
    "owner": "nathan.thomaz",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["nathanthomaz@gmail.com"],
}

with DAG(
    dag_id="dag_bronze_fontes_remotas",
    description="Ingestão Bronze de vagas remotas de tecnologia (RemoteOK, Remotive, Arbeitnow)",
    default_args=ARGUMENTOS_PADRAO,
    schedule="@weekly",
    start_date=datetime(2026, 3, 1),
    catchup=False,
    tags=["bronze", "remoteok", "remotive", "arbeitnow"],
) as dag:

    coletar_remoteok = PythonOperator(
        task_id="coletar_vagas_remoteok",
        python_callable=executar_ingestao_remoteok,
    )

    coletar_remotive = PythonOperator(
        task_id="coletar_vagas_remotive",
        python_callable=executar_ingestao_remotive,
    )

    coletar_arbeitnow = PythonOperator(
        task_id="coletar_vagas_arbeitnow",
        python_callable=executar_ingestao_arbeitnow,
    )
