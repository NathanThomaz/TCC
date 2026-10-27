"""Gerador de execuções SINTÉTICAS para testar o pipeline de análise.

ATENÇÃO: estes dados são inventados, apenas para validar o código. Eles saem com
`sintetico=True` no evento de abertura, e o pipeline se recusa a gerar relatório em
reports/ quando encontra essa marca.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from tcc_exp import eventos as ev

T0 = datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc)  # data claramente fictícia


def gerar_execucao(
    arquivo: Path,
    exec_id: str,
    par: str,
    tipo: str,
    tarefa_id: str,
    condicao: str,
    minutos_ate_1a_entrega: float,
    aprovados_1a: list[str],
    total: int,
    minutos_correcao: list[float] | None = None,
    aceita: bool = True,
    inicio: datetime = T0,
) -> None:
    t = inicio
    reg = lambda tipo_ev, payload=None: ev.registrar(arquivo, exec_id, tipo_ev, payload, agora=t)  # noqa: E731
    reg("abertura", {"tarefa_id": tarefa_id, "par": par, "tipo": tipo, "condicao": condicao,
                     "posicao": 1, "ordem_no_par": 1, "commit_inicial": "0" * 40, "sintetico": True})
    t += timedelta(minutes=3)
    reg("inicio")
    t += timedelta(minutes=minutos_ate_1a_entrega)
    reg("entrega", {"numero": 1, "commit": "1" * 40})
    reg("avaliacao", {"numero": 1, "resultado": {"aprovados": aprovados_1a, "reprovados": [],
                                                 "total": total, "taxa": len(aprovados_1a) / total}})
    for k, m in enumerate(minutos_correcao or [], start=2):
        reg("devolutiva", {"numero": k - 1, "texto": "sintético"})
        t += timedelta(minutes=m)
        reg("entrega", {"numero": k, "commit": str(k) * 40})
        reg("avaliacao", {"numero": k, "resultado": {"aprovados": [], "reprovados": [], "total": total,
                                                     "taxa": 1.0 if aceita else 0.8}})
    reg("fim", {"motivo": "aceita" if aceita else "rejeitada", "churn_pos_1a_linhas": 4,
                "diff_total_linhas": 10})
