"""Cálculo das métricas de uma execução a partir dos seus eventos brutos.

As definições operacionais estão em docs/metricas.md. Qualquer alteração aqui
precisa ser refletida naquele documento.
"""

from __future__ import annotations

from tcc_exp.eventos import ts
from tcc_exp.sessao import indice, tempo_ativo


def _indices(eventos: list[dict], tipo: str) -> list[int]:
    return [i for i, e in enumerate(eventos) if e["tipo"] == tipo]


def _min(seg: float | None) -> float | None:
    return None if seg is None else round(seg / 60, 4)


def _defeitos(resultado: dict, severidade: dict[str, str]) -> dict[str, int]:
    aprovados = set(resultado.get("aprovados", []))
    contagem = {"critico": 0, "maior": 0, "menor": 0}
    for nome, sev in severidade.items():
        if nome not in aprovados:
            contagem[sev] += 1
    return contagem


def _estatica(eventos: list[dict], momento: str) -> dict | None:
    for e in eventos:
        if e["tipo"] == "analise_estatica" and e["payload"].get("momento") == momento:
            return e["payload"]["resultado"]
    return None


def _delta(ini: dict | None, fim: dict | None, ferramenta: str, campo: str) -> float | None:
    if not ini or not fim:
        return None
    a, b = ini.get(ferramenta, {}), fim.get(ferramenta, {})
    if not (a.get("disponivel") and b.get("disponivel")) or campo not in a or campo not in b:
        return None
    return b[campo] - a[campo]


def calcular(eventos: list[dict], severidade: dict[str, str], limite_min: float) -> dict:
    if not eventos or eventos[0]["tipo"] != "abertura":
        raise ValueError("A execução precisa começar com um evento de abertura")
    ab = eventos[0]["payload"]
    linha = {
        "exec_id": eventos[0]["exec_id"],
        "tarefa_id": ab.get("tarefa_id"),
        "par": ab.get("par"),
        "tipo": ab.get("tipo"),
        "condicao": ab.get("condicao"),
        "posicao": int(ab["posicao"]) if ab.get("posicao") is not None else None,
        "ordem_no_par": int(ab["ordem_no_par"]) if ab.get("ordem_no_par") is not None else None,
        "data_abertura": ts(eventos[0]).date().isoformat(),
    }

    i_ini = indice(eventos, "inicio")
    i_fim = indice(eventos, "fim")
    i_aborto = indice(eventos, "aborto")
    entregas = _indices(eventos, "entrega")
    avaliacoes = _indices(eventos, "avaliacao")
    devolutivas = _indices(eventos, "devolutiva")

    linha["abortada"] = i_aborto is not None
    linha["concluida"] = i_fim is not None
    if i_ini is None or i_fim is None:
        return linha  # execução incompleta ou abortada: só a identificação é registrada

    fim = eventos[i_fim]["payload"]
    motivo = fim.get("motivo")
    aceita = motivo == "aceita"
    t_total = tempo_ativo(eventos, i_ini, i_fim)

    linha["motivo_fim"] = motivo
    linha["aceita"] = aceita
    linha["t_leitura_min"] = _min(tempo_ativo(eventos, 0, i_ini))
    linha["t_total_min"] = _min(t_total)
    linha["t_1a_entrega_min"] = _min(tempo_ativo(eventos, i_ini, entregas[0])) if entregas else None
    # t_aceite: tempo até a entrega aceita. Execuções não aceitas são CENSURADAS:
    # na análise principal recebem o tempo-limite (regra definida em docs/metricas.md).
    linha["censurada"] = not aceita
    linha["t_aceite_min"] = _min(t_total) if aceita else float(limite_min)

    if avaliacoes:
        r1 = eventos[avaliacoes[0]]["payload"]["resultado"]
        rf = eventos[avaliacoes[-1]]["payload"]["resultado"]
        linha["taxa_ocultos_1a"] = r1["taxa"]
        linha["taxa_ocultos_final"] = rf["taxa"]
        for sev, n in _defeitos(r1, severidade).items():
            linha[f"defeitos_1a_{sev}"] = n
        for sev, n in _defeitos(rf, severidade).items():
            linha[f"defeitos_final_{sev}"] = n

    linha["ciclos"] = len(devolutivas)
    retrabalho = 0.0
    for i_dev in devolutivas:
        prox = next((j for j in entregas if j > i_dev), None)
        retrabalho += tempo_ativo(eventos, i_dev, prox if prox is not None else i_fim)
    linha["t_retrabalho_min"] = _min(retrabalho)

    linha["n_testes_publicos"] = len(_indices(eventos, "teste_publico"))
    linha["n_pausas"] = len(_indices(eventos, "pausa"))
    linha["churn_pos_1a_linhas"] = fim.get("churn_pos_1a_linhas")
    linha["tamanho_diff_linhas"] = fim.get("diff_total_linhas")

    ini_e, fim_e = _estatica(eventos, "inicial"), _estatica(eventos, "final")
    linha["delta_alertas_ruff"] = _delta(ini_e, fim_e, "ruff", "total")
    linha["delta_cc_soma"] = _delta(ini_e, fim_e, "radon_cc", "soma")

    if entregas:
        linha["confianca_1a"] = eventos[entregas[0]]["payload"].get("confianca")
    quest = [e for e in eventos if e["tipo"] == "questionario"]
    if quest:
        q = quest[-1]["payload"]
        linha["dificuldade_percebida"] = q.get("dificuldade")
        linha["esforco_mental"] = q.get("esforco")
        linha["utilidade_ia"] = q.get("utilidade_ia")

    perc = [e for e in eventos if e["tipo"] == "percepcao"]
    if perc:
        est = perc[-1]["payload"].get("estimativa_min")
        linha["percepcao_estimativa_min"] = est
        linha["percepcao_erro_min"] = round(est - t_total / 60, 4) if est is not None else None
    return linha
