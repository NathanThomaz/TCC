"""Etapas reproduzíveis: `processar` (raw → processed) e `analisar` (processed → reports).

Regras de integridade:
- data/raw nunca é modificado aqui;
- toda exclusão de execução é listada no relatório, com o motivo;
- o relatório não interpreta os números. A interpretação é feita no texto do TCC.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from tcc_exp import eventos as ev
from tcc_exp import metricas, sorteio, tarefas
from tcc_exp.analise import estatistica as est
from tcc_exp.analise import graficos
from tcc_exp.config import Config

# (coluna, escala log?, rótulo) — as três primeiras são as variáveis primárias de H1–H3.
PRIMARIAS = [
    ("t_aceite_min", True, "H1 — tempo até a entrega aceita (min)"),
    ("taxa_ocultos_1a", False, "H2 — testes ocultos aprovados na 1ª entrega (proporção)"),
    ("t_retrabalho_min", False, "H3 — tempo de retrabalho após devolutivas (min)"),
]
SECUNDARIAS = [
    ("t_1a_entrega_min", "Tempo até a 1ª entrega (min)"),
    ("t_leitura_min", "Tempo de leitura do enunciado (min)"),
    ("ciclos", "Rodadas de devolutiva"),
    ("defeitos_1a_critico", "Defeitos críticos na 1ª entrega"),
    ("defeitos_1a_maior", "Defeitos maiores na 1ª entrega"),
    ("defeitos_1a_menor", "Defeitos menores na 1ª entrega"),
    ("taxa_ocultos_final", "Testes ocultos aprovados na entrega final (proporção)"),
    ("churn_pos_1a_linhas", "Linhas alteradas após a 1ª entrega"),
    ("tamanho_diff_linhas", "Tamanho do diff final (linhas)"),
    ("delta_alertas_ruff", "Δ alertas do linter"),
    ("delta_cc_soma", "Δ complexidade ciclomática (soma)"),
    ("n_testes_publicos", "Execuções dos testes públicos"),
    ("percepcao_erro_min", "Erro de percepção de tempo (estimado − real, min)"),
]


def processar(cfg: Config) -> Path:
    sessoes = sorted((cfg.dados_brutos / "sessoes").glob("*.jsonl"))
    limite = cfg.experimento["experimento"]["limite_minutos"]
    plano = sorteio.ler_plano(cfg.plano) if cfg.plano.exists() else []
    linhas, integridade = [], {}
    for arq in sessoes:
        evs = ev.ler(arq)
        problemas = ev.verificar_cadeia(arq)
        if not evs:
            continue
        ab = evs[0]["payload"]
        t = tarefas.carregar(cfg.tarefas, ab["tarefa_id"], cfg.base_dir)
        linha = metricas.calcular(evs, t.severidade, limite)
        linha["sintetico"] = bool(ab.get("sintetico", False))
        linha["integridade_ok"] = not problemas
        if plano:
            try:
                p = sorteio.buscar(plano, linha["exec_id"])
                linha["conforme_plano"] = (
                    p["tarefa_id"] == linha["tarefa_id"] and p["condicao"] == linha["condicao"]
                )
            except KeyError:
                linha["conforme_plano"] = False
        integridade[arq.name] = problemas
        linhas.append(linha)

    cfg.dados_processados.mkdir(parents=True, exist_ok=True)
    saida = cfg.dados_processados / "execucoes.csv"
    pd.DataFrame(linhas).to_csv(saida, index=False)
    (cfg.dados_processados / "integridade.json").write_text(
        json.dumps({"gerado_em": datetime.now(timezone.utc).isoformat(), "arquivos": integridade},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return saida


def _elegiveis(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Mantém execuções concluídas, íntegras e conformes ao plano. Devolve os motivos de exclusão."""
    motivos = []
    ok = pd.Series(True, index=df.index)
    for coluna, motivo in (("abortada", "abortada"), ("integridade_ok", "cadeia de eventos violada"),
                           ("conforme_plano", "fora do plano de randomização")):
        if coluna not in df:
            continue
        ruim = df[coluna] == True if coluna == "abortada" else df[coluna] == False  # noqa: E712
        for _, r in df[ruim & ok].iterrows():
            motivos.append(f"{r['exec_id']} ({r['tarefa_id']}, cond. {r['condicao']}): {motivo}")
        ok &= ~ruim
    if "concluida" in df:
        for _, r in df[ok & (df["concluida"] != True)].iterrows():  # noqa: E712
            motivos.append(f"{r['exec_id']} ({r['tarefa_id']}, cond. {r['condicao']}): não concluída")
        ok &= df["concluida"] == True  # noqa: E712
    return df[ok].copy(), motivos


def _fmt(v, casas: int = 3) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return "—"
    if isinstance(v, float):
        return f"{v:.{casas}f}"
    return str(v)


def _tabela_md(df: pd.DataFrame) -> str:
    cab = "| " + " | ".join(df.columns) + " |"
    sep = "|" + "---|" * len(df.columns)
    corpo = ["| " + " | ".join(_fmt(v) for v in r) + " |" for r in df.itertuples(index=False)]
    return "\n".join([cab, sep, *corpo])


def analisar(cfg: Config, saida: Path | None = None) -> Path:
    saida = saida or cfg.relatorios
    arq = cfg.dados_processados / "execucoes.csv"
    df_todos = pd.read_csv(arq)
    sintetico = bool(df_todos.get("sintetico", pd.Series([False])).any())
    if sintetico and saida.resolve() == cfg.relatorios.resolve():
        raise RuntimeError(
            "Dados sintéticos não podem gerar relatório em reports/. Passe outro diretório de saída."
        )
    df, exclusoes = _elegiveis(df_todos)
    tabelas, figuras = saida / "tables", saida / "figures"
    tabelas.mkdir(parents=True, exist_ok=True)

    resumos, descr = [], []
    for metrica, log, rotulo in PRIMARIAS:
        if metrica not in df:
            continue
        r = est.resumo_pareado(df, metrica, log=log)
        r["rotulo"] = rotulo
        r["tipo_analise"] = "primaria"
        resumos.append(r)
        descr.append(est.descritivas(df, metrica).assign(metrica=metrica))
        pares = est.diferencas_pareadas(df, metrica)
        if len(pares):
            graficos.pares(pares, rotulo, metrica, figuras / f"pares_{metrica}.png")
    ajust = est.holm({r["metrica"]: r["p_randomizacao"] for r in resumos})
    for r in resumos:
        r["p_randomizacao_holm"] = ajust[r["metrica"]]

    for metrica, rotulo in SECUNDARIAS:
        if metrica not in df or df[metrica].dropna().empty:
            continue
        r = est.resumo_pareado(df, metrica)
        r["rotulo"] = rotulo
        r["tipo_analise"] = "secundaria (exploratória, sem correção)"
        resumos.append(r)
        descr.append(est.descritivas(df, metrica).assign(metrica=metrica))

    # Sensibilidade para H1: exclui os pares em que houve censura.
    if "censurada" in df:
        pares_cens = set(df.loc[df["censurada"] == True, "par"])  # noqa: E712
        sens = df[~df["par"].isin(pares_cens)]
        r = est.resumo_pareado(sens, "t_aceite_min", log=True)
        r["rotulo"] = "Sensibilidade H1 — sem pares com censura"
        r["tipo_analise"] = "sensibilidade"
        resumos.append(r)

    # H4 (exploratória): mediana das diferenças por tipo de tarefa.
    h4 = []
    for metrica, log in (("t_aceite_min", True), ("taxa_ocultos_1a", False)):
        if metrica in df:
            p = est.diferencas_pareadas(df, metrica, log=log)
            for tipo, g in p.groupby("tipo"):
                h4.append({"metrica": metrica, "tipo": tipo, "n_pares": len(g),
                           "mediana_dif": float(g["dif"].median())})

    tab_res = pd.DataFrame(resumos)
    tab_desc = pd.concat(descr, ignore_index=True) if descr else pd.DataFrame()
    tab_h4 = pd.DataFrame(h4)
    tab_res.to_csv(tabelas / "comparacoes_pareadas.csv", index=False)
    tab_desc.to_csv(tabelas / "descritivas.csv", index=False)
    tab_h4.to_csv(tabelas / "h4_por_tipo.csv", index=False)
    if {"t_1a_entrega_min", "taxa_ocultos_1a"} <= set(df.columns):
        graficos.tempo_vs_qualidade(df, figuras / "tempo_vs_qualidade.png")

    rel = saida / "relatorio-experimento.md"
    rel.write_text(_relatorio(cfg, df_todos, df, exclusoes, tab_res, tab_desc, tab_h4, sintetico),
                   encoding="utf-8")
    return rel


def _relatorio(cfg, df_todos, df, exclusoes, tab_res, tab_desc, tab_h4, sintetico) -> str:
    n_pares = df.groupby("par")["condicao"].nunique().eq(2).sum() if len(df) else 0
    partes = []
    if sintetico:
        partes.append("> **DADOS SINTÉTICOS. ESTE RELATÓRIO NÃO CONTÉM RESULTADOS DO EXPERIMENTO.**\n")
    partes += [
        f"# Relatório do experimento — fase {cfg.fase}",
        "",
        f"Gerado automaticamente em {datetime.now(timezone.utc).isoformat(timespec='seconds')} "
        f"por `exp analisar`, a partir de `{cfg.dados_processados.relative_to(cfg.raiz).as_posix()}"
        "/execucoes.csv`. Este arquivo apresenta números, sem interpretação.",
        "",
        f"- Execuções registradas: {len(df_todos)}",
        f"- Execuções elegíveis: {len(df)}",
        f"- Pares completos (A e B): {n_pares}",
        "",
        "## Exclusões",
        "",
        *([f"- {m}" for m in exclusoes] or ["Nenhuma."]),
        "",
    ]
    if n_pares < 2:
        partes += ["## Aviso", "", "Menos de 2 pares completos: comparações pareadas não calculadas.", ""]
    cols = ["rotulo", "tipo_analise", "n_pares", "mediana_dif", "hodges_lehmann",
            "ic95_mediana_inf", "ic95_mediana_sup", "p_randomizacao", "p_randomizacao_holm", "p_wilcoxon"]
    if len(tab_res):
        partes += [
            "## Comparações pareadas (diferença B − A)",
            "",
            "Diferenças positivas significam valores maiores em B (com IA). Para `t_aceite_min`, a "
            "diferença está em escala log. A razão B/A correspondente é dada abaixo.",
            "",
            _tabela_md(tab_res[[c for c in cols if c in tab_res.columns]]),
            "",
        ]
        if "razao_B_A" in tab_res:
            raz = tab_res.dropna(subset=["razao_B_A"])[["rotulo", "razao_B_A", "razao_ic95_inf", "razao_ic95_sup"]]
            partes += ["### Razão de tempos B/A (exp do estimador de Hodges-Lehmann)", "", _tabela_md(raz), ""]
    if len(tab_desc):
        partes += ["## Estatísticas descritivas por condição", "", _tabela_md(tab_desc), ""]
    if len(tab_h4):
        partes += ["## H4 (exploratória): mediana das diferenças por tipo de tarefa", "", _tabela_md(tab_h4), ""]
    partes += ["## Figuras", "", "Ver `figures/`.", ""]
    return "\n".join(partes)
