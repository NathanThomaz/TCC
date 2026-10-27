"""Gerador de execuções SINTÉTICAS — somente para testes e para a demonstração do dashboard.

ATENÇÃO: os dados produzidos aqui são inventados. Toda execução sai com `sintetico=True`
no evento de abertura. O pipeline se recusa a gerar relatório em reports/ com esses dados,
e o dashboard exibe uma faixa de aviso em todas as seções.

O conjunto de demonstração é gerado com EFEITO NULO: as duas condições vêm da mesma
distribuição. Ele não sugere nenhum resultado para o experimento real.
"""

from __future__ import annotations

import random
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
    posicao: int = 1,
    ordem_no_par: int = 1,
    churn: int = 4,
    diff_total: int = 10,
) -> None:
    t = inicio
    reg = lambda tipo_ev, payload=None: ev.registrar(arquivo, exec_id, tipo_ev, payload, agora=t)  # noqa: E731
    reg("abertura", {"tarefa_id": tarefa_id, "par": par, "tipo": tipo, "condicao": condicao,
                     "posicao": posicao, "ordem_no_par": ordem_no_par, "commit_inicial": "0" * 40,
                     "sintetico": True})
    t += timedelta(minutes=3)
    reg("inicio")
    t += timedelta(minutes=minutos_ate_1a_entrega)
    reg("entrega", {"numero": 1, "commit": "1" * 40})
    reg("avaliacao", {"numero": 1, "resultado": {"aprovados": aprovados_1a, "reprovados": [],
                                                 "total": total, "taxa": len(aprovados_1a) / total}})
    for k, m in enumerate(minutos_correcao or [], start=2):
        reg("devolutiva", {"numero": k - 1, "texto": "sintético"})
        t += timedelta(minutes=m)
        reg("entrega", {"numero": k, "commit": str(k % 10) * 40})
        ultima = k == len(minutos_correcao) + 1
        reg("avaliacao", {"numero": k, "resultado": {"aprovados": [], "reprovados": [], "total": total,
                                                     "taxa": 1.0 if (aceita and ultima) else 0.8}})
    reg("fim", {"motivo": "aceita" if aceita else "rejeitada", "churn_pos_1a_linhas": churn,
                "diff_total_linhas": diff_total})


def gerar_conjunto_demo(destino: Path, tarefas_por_tipo: dict[str, tuple[str, str]],
                        ocultos: dict[str, list[str]], pares_por_tipo: int = 3, semente: int = 7) -> int:
    """Gera um conjunto completo (4 tipos × N pares) com efeito nulo. Retorna o nº de execuções."""
    rng = random.Random(semente)
    n = 0
    inicio = T0
    for k in range(pares_por_tipo):
        for tipo, (ga, gb) in tarefas_por_tipo.items():
            par = f"{tipo}-{k + 1}"
            b_primeiro = rng.random() < 0.5
            ordem = [("B", gb), ("A", ga)] if b_primeiro else [("A", ga), ("B", gb)]
            for ordem_no_par, (cond, tarefa) in enumerate(ordem, 1):
                n += 1
                nomes = ocultos[tarefa]
                t1 = rng.lognormvariate(3.3, 0.35)                    # mesma distribuição em A e B
                aprov = [x for x in nomes if rng.random() < 0.7]
                correcoes = [] if len(aprov) == len(nomes) else [rng.uniform(3, 15)
                                                                for _ in range(rng.choice([1, 2]))]
                aceita = not correcoes or rng.random() < 0.85
                gerar_execucao(destino / f"D{n:02d}.jsonl", f"D{n:02d}", par, tipo, tarefa, cond,
                               t1, aprov, len(nomes), correcoes, aceita, inicio=inicio, posicao=n,
                               ordem_no_par=ordem_no_par, churn=rng.randint(0, 40) if correcoes else 0,
                               diff_total=rng.randint(4, 60))
                inicio += timedelta(hours=3)
    return n
