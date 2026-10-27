"""Dashboard final em HTML autocontido: apresentação, resumo, gráficos, análises, dados e limitações.

Todo número exibido vem de `data/processed/<fase>/execucoes.csv` e das tabelas geradas por
`pipeline.analisar`. Os textos interpretativos são neutros: descrevem a direção e a incerteza,
sem concluir. A interpretação fica para o texto do TCC. Os gráficos são SVG inline, sem
bibliotecas externas, e funcionam offline.
"""

from __future__ import annotations

import html
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from tcc_exp.analise import estatistica as est
from tcc_exp.analise import pipeline
from tcc_exp.config import Config

ROTULO = {"A": "A — sem IA", "B": "B — com IA"}
NOMES_TIPO = {"T1": "T1 · correção de defeito", "T2": "T2 · nova funcionalidade",
              "T3": "T3 · consulta SQL", "T4": "T4 · robustez da importação"}


# ------------------------------------------------------------------ formatação

def num(v, casas: int = 1, sufixo: str = "") -> str:
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return "—"
    texto = f"{v:,.{casas}f}".replace(",", "§").replace(".", ",").replace("§", ".")
    return texto + sufixo


def pct(v, casas: int = 0) -> str:
    return "—" if v is None or pd.isna(v) else num(100 * v, casas, "%")


def esc(t) -> str:
    return html.escape(str(t))


# ------------------------------------------------------------------ SVG

def _ticks(lo: float, hi: float, n: int = 5) -> list[float]:
    if not np.isfinite([lo, hi]).all():
        return [0.0, 1.0]
    if hi - lo < 1e-9:
        lo, hi = lo - 1, hi + 1
    bruto = (hi - lo) / n
    mag = 10 ** math.floor(math.log10(bruto))
    passo = next(m * mag for m in (1, 2, 2.5, 5, 10) if bruto <= m * mag)
    v = math.floor(lo / passo) * passo
    vals = []
    while v <= hi + passo * 1e-6:
        vals.append(round(v, 10))
        v += passo
    if vals[-1] < hi:
        vals.append(round(vals[-1] + passo, 10))
    return vals


def _escala(d0, d1, r0, r1):
    return lambda v: r0 + (v - d0) * (r1 - r0) / ((d1 - d0) or 1)


def _eixo_y(ticks, y, x0, x1, fmt) -> str:
    partes = []
    for t in ticks:
        partes.append(f'<line class="grade" x1="{x0}" x2="{x1}" y1="{y(t):.1f}" y2="{y(t):.1f}"/>'
                      f'<text class="eixo" x="{x0 - 8}" y="{y(t) + 4:.1f}" text-anchor="end">{fmt(t)}</text>')
    return "".join(partes)


def svg_pares(pares: pd.DataFrame, unidade: str, fmt) -> str:
    """Linhas pareadas: cada par liga o valor em A ao valor em B."""
    if pares.empty:
        return '<p class="vazio">Sem pares completos para esta métrica.</p>'
    w, h, m = 340, 280, dict(t=16, b=40, l=56, r=20)
    vals = pd.concat([pares["A"], pares["B"]])
    tk = _ticks(float(vals.min()), float(vals.max()))
    y = _escala(tk[0], tk[-1], h - m["b"], m["t"])
    xa, xb = m["l"] + 50, w - m["r"] - 50
    s = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="Valores pareados A e B ({unidade})">',
         _eixo_y(tk, y, m["l"], w - m["r"], fmt)]
    for _, r in pares.iterrows():
        s.append(f'<line class="liga" x1="{xa}" x2="{xb}" y1="{y(r["A"]):.1f}" y2="{y(r["B"]):.1f}"/>')
    for _, r in pares.iterrows():
        for cond, x in (("A", xa), ("B", xb)):
            dica = f'Par {r["par"]} ({r["tipo"]}) — {ROTULO[cond]}: {fmt(r[cond])} {unidade}'
            s.append(f'<circle class="pt c{cond}" cx="{x}" cy="{y(r[cond]):.1f}" r="5">'
                     f'<title>{esc(dica)}</title></circle>')
    s += [f'<text class="eixo" x="{xa}" y="{h - 14}" text-anchor="middle">{ROTULO["A"]}</text>',
          f'<text class="eixo" x="{xb}" y="{h - 14}" text-anchor="middle">{ROTULO["B"]}</text>', "</svg>"]
    return "".join(s)


def svg_dispersao(df: pd.DataFrame) -> str:
    sub = df.dropna(subset=["t_1a_entrega_min", "taxa_ocultos_1a"])
    if sub.empty:
        return '<p class="vazio">Sem execuções com 1ª entrega avaliada.</p>'
    w, h, m = 680, 300, dict(t=16, b=44, l=56, r=20)
    tx = _ticks(0, float(sub["t_1a_entrega_min"].max()))
    x = _escala(tx[0], tx[-1], m["l"], w - m["r"])
    y = _escala(0, 100, h - m["b"], m["t"])
    s = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="Tempo até a 1ª entrega versus qualidade">',
         _eixo_y([0, 25, 50, 75, 100], y, m["l"], w - m["r"], lambda v: f"{v:.0f}%")]
    for t in tx:
        s.append(f'<text class="eixo" x="{x(t):.1f}" y="{h - m["b"] + 18}" text-anchor="middle">{num(t, 0)}</text>')
    s.append(f'<text class="eixo" x="{(m["l"] + w - m["r"]) / 2}" y="{h - 6}" text-anchor="middle">'
             'tempo ativo até a 1ª entrega (min)</text>')
    for _, r in sub.iterrows():
        dica = (f'{r["exec_id"]} · {r["tarefa_id"]} · {ROTULO[r["condicao"]]}: '
                f'{num(r["t_1a_entrega_min"])} min, {pct(r["taxa_ocultos_1a"])} dos ocultos')
        s.append(f'<circle class="pt c{r["condicao"]}" cx="{x(r["t_1a_entrega_min"]):.1f}" '
                 f'cy="{y(100 * r["taxa_ocultos_1a"]):.1f}" r="5.5"><title>{esc(dica)}</title></circle>')
    s.append("</svg>")
    return "".join(s)


def svg_linha_do_tempo(df: pd.DataFrame) -> str:
    sub = df.dropna(subset=["t_total_min", "posicao"]).sort_values("posicao")
    if sub.empty:
        return '<p class="vazio">Sem execuções concluídas.</p>'
    w, h, m = 680, 260, dict(t=16, b=44, l=56, r=20)
    n = int(sub["posicao"].max())
    x = _escala(0.5, n + 0.5, m["l"], w - m["r"])
    ty = _ticks(0, float(sub["t_total_min"].max()))
    y = _escala(ty[0], ty[-1], h - m["b"], m["t"])
    s = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="Tempo total por posição na sequência">',
         _eixo_y(ty, y, m["l"], w - m["r"], lambda v: num(v, 0))]
    passo = max(1, n // 12)
    for p in range(1, n + 1, passo):
        s.append(f'<text class="eixo" x="{x(p):.1f}" y="{h - m["b"] + 18}" text-anchor="middle">{p}</text>')
    s.append(f'<text class="eixo" x="{(m["l"] + w - m["r"]) / 2}" y="{h - 6}" text-anchor="middle">'
             'posição da execução na sequência</text>')
    for _, r in sub.iterrows():
        oco = "" if r.get("aceita", True) else " oco"
        dica = (f'#{int(r["posicao"])} {r["exec_id"]} · {r["tarefa_id"]} · {ROTULO[r["condicao"]]}: '
                f'{num(r["t_total_min"])} min{"" if r.get("aceita", True) else " (não aceita)"}')
        s.append(f'<circle class="pt c{r["condicao"]}{oco}" cx="{x(r["posicao"]):.1f}" '
                 f'cy="{y(r["t_total_min"]):.1f}" r="5.5"><title>{esc(dica)}</title></circle>')
    s.append("</svg>")
    return "".join(s)


def svg_efeitos(linhas: list[dict]) -> str:
    """Estimativa pontual e IC 95% de cada métrica primária, cada linha com a própria escala."""
    w, alt, m = 680, 74, dict(l=250, r=90)
    s = [f'<svg viewBox="0 0 {w} {alt * len(linhas) + 10}" role="img" aria-label="Efeitos estimados">']
    for i, li in enumerate(linhas):
        y0 = i * alt + 30
        s.append(f'<text class="rot" x="0" y="{y0 + 4}">{esc(li["rotulo"])}</text>')
        if li["est"] is None or li["inf"] is None:
            s.append(f'<text class="eixo" x="{m["l"]}" y="{y0 + 4}">dados insuficientes</text>')
            continue
        lo = min(li["inf"], li["est"], li["ref"])
        hi = max(li["sup"], li["est"], li["ref"])
        folga = (hi - lo) * 0.15 or 1
        x = _escala(lo - folga, hi + folga, m["l"], w - m["r"])
        s += [f'<line class="ref" x1="{x(li["ref"]):.1f}" x2="{x(li["ref"]):.1f}" y1="{y0 - 18}" y2="{y0 + 18}"/>',
              f'<text class="eixo" x="{x(li["ref"]):.1f}" y="{y0 + 32}" text-anchor="middle">{li["fmt"](li["ref"])}</text>',
              f'<line class="ic" x1="{x(li["inf"]):.1f}" x2="{x(li["sup"]):.1f}" y1="{y0}" y2="{y0}"/>',
              f'<circle class="est" cx="{x(li["est"]):.1f}" cy="{y0}" r="6"><title>'
              f'{esc(li["rotulo"])}: {li["fmt"](li["est"])} (IC 95%: {li["fmt"](li["inf"])} a '
              f'{li["fmt"](li["sup"])})</title></circle>',
              f'<text class="val" x="{w - m["r"] + 10}" y="{y0 + 4}">{li["fmt"](li["est"])}</text>']
    s.append("</svg>")
    return "".join(s)


def svg_barras_tipo(tab: pd.DataFrame, fmt, legenda: str) -> str:
    if tab.empty:
        return '<p class="vazio">Sem dados por tipo.</p>'
    w, alt, m = 340, 34, dict(l=150, r=56, t=8)
    h = alt * len(tab) + m["t"] + 26
    lim = max(abs(tab["valor"]).max(), 1e-9) * 1.15
    x = _escala(-lim, lim, m["l"], w - m["r"])
    s = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{esc(legenda)}">',
         f'<line class="ref" x1="{x(0):.1f}" x2="{x(0):.1f}" y1="{m["t"]}" y2="{h - 22}"/>']
    for i, (_, r) in enumerate(tab.iterrows()):
        y0 = m["t"] + i * alt
        x0, x1 = sorted((x(0), x(r["valor"])))
        s += [f'<text class="rot" x="0" y="{y0 + 19}">{esc(NOMES_TIPO.get(r["tipo"], r["tipo"]))}</text>',
              f'<rect class="barra" x="{x0:.1f}" y="{y0 + 6}" width="{max(x1 - x0, 1):.1f}" height="18" rx="3">'
              f'<title>{esc(r["tipo"])}: {fmt(r["valor"])} ({int(r["n_pares"])} par(es))</title></rect>',
              f'<text class="val" x="{w - m["r"] + 6}" y="{y0 + 19}">{fmt(r["valor"])}</text>']
    s += [f'<text class="eixo" x="{x(0):.1f}" y="{h - 6}" text-anchor="middle">{esc(legenda)}</text>', "</svg>"]
    return "".join(s)


# ------------------------------------------------------------------ montagem

def _tabela(df: pd.DataFrame, colunas: dict[str, str], fmts: dict | None = None) -> str:
    fmts = fmts or {}
    cab = "".join(f"<th>{esc(r)}</th>" for r in colunas.values())
    linhas = []
    for _, r in df.iterrows():
        cel = []
        for c in colunas:
            v = r.get(c)
            cel.append(f"<td>{esc(fmts[c](v) if c in fmts else ('—' if pd.isna(v) else v))}</td>")
        linhas.append("<tr>" + "".join(cel) + "</tr>")
    return f'<div class="rolagem"><table><thead><tr>{cab}</tr></thead><tbody>{"".join(linhas)}</tbody></table></div>'


def _kpi(rotulo: str, valor: str, detalhe: str = "") -> str:
    return (f'<div class="kpi"><div class="kpi-rot">{esc(rotulo)}</div><div class="kpi-val">{esc(valor)}</div>'
            f'<div class="kpi-det">{esc(detalhe)}</div></div>')


def _mediana(df, cond, col):
    s = df.loc[df["condicao"] == cond, col].dropna() if col in df else pd.Series(dtype=float)
    return float(s.median()) if len(s) else None


def _frase_efeito(li: dict) -> str:
    """Descrição neutra: direção da estimativa e se o IC inclui o valor de referência."""
    if li["est"] is None or li["inf"] is None:
        return f"{li['rotulo']}: pares insuficientes para estimar."
    inclui = li["inf"] <= li["ref"] <= li["sup"]
    return (f"{li['rotulo']}: estimativa {li['fmt'](li['est'])} (IC 95% {li['fmt'](li['inf'])} a "
            f"{li['fmt'](li['sup'])}); o intervalo {'inclui' if inclui else 'não inclui'} "
            f"{li['fmt'](li['ref'])}, o valor de ausência de diferença. p (randomização, Holm) = "
            f"{num(li.get('p'), 3) if li.get('p') is not None else '—'}.")


def gerar(cfg: Config, saida: Path | None = None) -> Path:
    saida = saida or cfg.relatorios
    pipeline.analisar(cfg, saida)  # mesmas regras de elegibilidade e de proteção contra dados sintéticos
    df_todos = pd.read_csv(cfg.dados_processados / "execucoes.csv")
    df, exclusoes = pipeline._elegiveis(df_todos)
    comp = pd.read_csv(saida / "tables" / "comparacoes_pareadas.csv")
    sintetico = bool(df_todos.get("sintetico", pd.Series([False])).fillna(False).any())
    exp = cfg.experimento
    ap = exp.get("apresentacao", {})
    ferr = exp.get("ferramenta_ia", {})

    def linha(metrica, tipo="primaria"):
        r = comp[(comp["metrica"] == metrica) & (comp["tipo_analise"].str.startswith(tipo))]
        return r.iloc[0].to_dict() if len(r) else {}

    # ---- efeitos primários
    r1, r2, r3 = linha("t_aceite_min"), linha("taxa_ocultos_1a"), linha("t_retrabalho_min")

    def val(d, k):
        v = d.get(k)
        return None if v is None or pd.isna(v) else float(v)

    efeitos = [
        dict(rotulo="H1 · tempo até aceite (razão B/A)", est=val(r1, "razao_B_A"), inf=val(r1, "razao_ic95_inf"),
             sup=val(r1, "razao_ic95_sup"), ref=1.0, fmt=lambda v: num(v, 2) + "×",
             p=val(r1, "p_randomizacao_holm")),
        dict(rotulo="H2 · ocultos na 1ª entrega (B − A)", est=val(r2, "hodges_lehmann"),
             inf=val(r2, "ic95_mediana_inf"), sup=val(r2, "ic95_mediana_sup"), ref=0.0,
             fmt=lambda v: num(100 * v, 1, " p.p."), p=val(r2, "p_randomizacao_holm")),
        dict(rotulo="H3 · retrabalho (B − A, min)", est=val(r3, "hodges_lehmann"),
             inf=val(r3, "ic95_mediana_inf"), sup=val(r3, "ic95_mediana_sup"), ref=0.0,
             fmt=lambda v: num(v, 1, " min"), p=val(r3, "p_randomizacao_holm")),
    ]

    # ---- KPIs
    n_pares = int(df.groupby("par")["condicao"].nunique().eq(2).sum()) if len(df) else 0
    aceitas = {c: int(df.loc[df["condicao"] == c, "aceita"].fillna(False).astype(bool).sum())
               if "aceita" in df else 0 for c in "AB"}
    totais = {c: int((df["condicao"] == c).sum()) for c in "AB"}
    kpis = "".join([
        _kpi("Execuções", f"{len(df)} / {len(df_todos)}", "elegíveis / registradas"),
        _kpi("Pares completos", str(n_pares), "A e B na mesma dupla de tarefas"),
        _kpi("Mediana do tempo até aceite", f"{num(_mediana(df, 'A', 't_aceite_min'))} → "
             f"{num(_mediana(df, 'B', 't_aceite_min'))} min", "A → B"),
        _kpi("Ocultos na 1ª entrega (mediana)", f"{pct(_mediana(df, 'A', 'taxa_ocultos_1a'))} → "
             f"{pct(_mediana(df, 'B', 'taxa_ocultos_1a'))}", "A → B"),
        _kpi("Retrabalho (mediana)", f"{num(_mediana(df, 'A', 't_retrabalho_min'))} → "
             f"{num(_mediana(df, 'B', 't_retrabalho_min'))} min", "A → B"),
        _kpi("Entregas aceitas", f"{aceitas['A']}/{totais['A']} · {aceitas['B']}/{totais['B']}", "A · B"),
    ])

    # ---- gráficos pareados
    graf_pares = []
    for metrica, titulo, unid, fmt in (
        ("t_aceite_min", "H1 · Tempo até a entrega aceita", "min", lambda v: num(v, 0)),
        ("taxa_ocultos_1a", "H2 · Testes ocultos aprovados na 1ª entrega", "", lambda v: pct(v)),
        ("t_retrabalho_min", "H3 · Tempo de retrabalho após devolutivas", "min", lambda v: num(v, 0)),
    ):
        p = est.diferencas_pareadas(df, metrica) if metrica in df else pd.DataFrame()
        graf_pares.append(f'<figure class="cartao"><figcaption>{esc(titulo)}</figcaption>'
                          f'{svg_pares(p, unid, fmt)}</figure>')

    # ---- H4 por tipo
    h4 = []
    for metrica, log, fmt, titulo, leg in (
        ("t_aceite_min", True, lambda v: num(100 * (math.exp(v) - 1), 0, "%"),
         "H4 · Variação do tempo até aceite (B vs A), mediana por tipo", "variação do tempo B vs A"),
        ("taxa_ocultos_1a", False, lambda v: num(100 * v, 0, " p.p."),
         "H4 · Diferença de ocultos na 1ª entrega (B − A), mediana por tipo", "diferença de ocultos B − A"),
    ):
        if metrica in df:
            p = est.diferencas_pareadas(df, metrica, log=log)
            t = p.groupby("tipo")["dif"].agg(valor="median", n_pares="count").reset_index()
            h4.append(f'<figure class="cartao"><figcaption>{esc(titulo)}</figcaption>'
                      f'{svg_barras_tipo(t, fmt, leg)}</figure>')

    tab_comp = _tabela(comp, {
        "rotulo": "Métrica", "tipo_analise": "Análise", "n_pares": "Pares", "mediana_dif": "Mediana B−A",
        "hodges_lehmann": "Hodges-Lehmann", "ic95_mediana_inf": "IC95 inf", "ic95_mediana_sup": "IC95 sup",
        "p_randomizacao": "p rand.", "p_randomizacao_holm": "p Holm", "p_wilcoxon": "p Wilcoxon"},
        {k: (lambda v: num(v, 3)) for k in ("mediana_dif", "hodges_lehmann", "ic95_mediana_inf",
                                             "ic95_mediana_sup", "p_randomizacao", "p_randomizacao_holm",
                                             "p_wilcoxon")})
    desc = pd.read_csv(saida / "tables" / "descritivas.csv")
    tab_desc = _tabela(desc, {"metrica": "Métrica", "condicao": "Cond.", "n": "n", "mediana": "Mediana",
                              "q1": "Q1", "q3": "Q3", "media": "Média", "dp": "DP", "minimo": "Mín", "maximo": "Máx"},
                       {k: (lambda v: num(v, 2)) for k in ("mediana", "q1", "q3", "media", "dp", "minimo", "maximo")})
    cols_exec = {"exec_id": "Execução", "posicao": "Pos.", "par": "Par", "tipo": "Tipo", "tarefa_id": "Tarefa",
                 "condicao": "Cond.", "t_1a_entrega_min": "1ª entrega (min)", "t_aceite_min": "Aceite (min)",
                 "taxa_ocultos_1a": "Ocultos 1ª", "ciclos": "Ciclos", "t_retrabalho_min": "Retrabalho (min)",
                 "motivo_fim": "Fim"}
    tab_exec = _tabela(df_todos.sort_values("posicao") if "posicao" in df_todos else df_todos,
                       {k: v for k, v in cols_exec.items() if k in df_todos},
                       {"t_1a_entrega_min": lambda v: num(v), "t_aceite_min": lambda v: num(v),
                        "t_retrabalho_min": lambda v: num(v), "taxa_ocultos_1a": pct})

    aviso = ('<div class="aviso">DEMONSTRAÇÃO COM DADOS SINTÉTICOS. Estes números foram gerados '
             'por computador com efeito nulo, apenas para mostrar o formato do dashboard. '
             '<strong>Não são resultados do experimento.</strong></div>') if sintetico else ""
    ferramenta = (f'{esc(ferr.get("nome"))} ({esc(ferr.get("modalidade"))}, modelo {esc(ferr.get("modelo"))})'
                  if ferr.get("nome") else "a definir (decisão D3)")
    gerado = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y %H:%M")

    corpo = f"""
<header class="topo">
  <div class="marca">TCC · Sistemas de Informação</div>
  <nav>
    <a href="#apresentacao">Apresentação</a><a href="#resumo">Resumo</a><a href="#graficos">Gráficos</a>
    <a href="#analises">Análises</a><a href="#dados">Dados</a><a href="#limitacoes">Limitações</a>
  </nav>
</header>
<main>
{aviso}
<section id="apresentacao" class="capa">
  <p class="sobre">{esc(ap.get("curso", ""))}{" · " + esc(ap["instituicao"]) if ap.get("instituicao") else ""}</p>
  <h1>{esc(ap.get("titulo", "Relatório do experimento"))}</h1>
  <p class="autor">{esc(ap.get("autor", ""))}{" · Orientação: " + esc(ap["orientador"]) if ap.get("orientador") else ""}</p>
  <div class="grade2">
    <div class="cartao"><h3>Pergunta de pesquisa</h3><p>{esc(ap.get("pergunta", ""))}</p></div>
    <div class="cartao"><h3>Hipóteses (bilaterais)</h3><ul>
      <li><b>H1</b>: a IA altera o tempo até a entrega aceita.</li>
      <li><b>H2</b>: a IA altera a qualidade funcional da 1ª entrega (testes ocultos).</li>
      <li><b>H3</b>: a IA altera o retrabalho após a devolutiva.</li>
      <li><b>H4</b> (exploratória): o efeito varia por tipo de tarefa.</li></ul></div>
    <div class="cartao"><h3>Desenho</h3><p>Caso único randomizado (N-de-1): o mesmo executor realiza pares
      de tarefas gêmeas, uma <span class="tag cA">sem IA</span> e outra <span class="tag cB">com IA</span>. Em cada par,
      a gêmea e a ordem são sorteadas. Análise por teste de randomização exato, Hodges-Lehmann, IC 95% bootstrap e correção de Holm.</p></div>
    <div class="cartao"><h3>Condições</h3><p><b>A</b>: sem qualquer assistência de IA.<br><b>B</b>: {ferramenta}.<br>
      Fase: <b>{esc(cfg.fase)}</b> · protocolo {esc(exp["experimento"]["protocolo_versao"])} ·
      tempo-limite {exp["experimento"]["limite_minutos"]} min.</p></div>
  </div>
</section>

<section id="resumo">
  <h2>Resumo</h2>
  <div class="kpis">{kpis}</div>
  <div class="cartao"><h3>Efeitos estimados (H1–H3)</h3>
    {svg_efeitos(efeitos)}
    <ul class="frases">{"".join(f"<li>{esc(_frase_efeito(e))}</li>" for e in efeitos)}</ul>
    <p class="nota">Leitura: ponto = estimativa; linha = IC 95%; tracejado = ausência de diferença.
    "Não significativo" não significa "sem efeito". Com poucos pares, só efeitos grandes são detectáveis
    (ver docs/analise-poder.md).</p></div>
</section>

<section id="graficos">
  <h2>Gráficos</h2>
  <p class="legenda"><span class="tag cA">A — sem IA</span> <span class="tag cB">B — com IA</span>
    Passe o mouse sobre os pontos para ver os valores.</p>
  <div class="grade3">{"".join(graf_pares)}</div>
  <figure class="cartao"><figcaption>Velocidade × qualidade: tempo até a 1ª entrega e proporção de testes ocultos aprovados</figcaption>
    {svg_dispersao(df)}</figure>
  <figure class="cartao"><figcaption>Efeito de aprendizagem: tempo total por posição na sequência (pontos vazados = não aceitas)</figcaption>
    {svg_linha_do_tempo(df)}</figure>
  <div class="grade2">{"".join(h4)}</div>
  <p class="nota">H4 é exploratória: com poucos pares por tipo, as medianas por tipo são descritivas e não sustentam teste formal.</p>
</section>

<section id="analises">
  <h2>Análises</h2>
  <div class="cartao"><h3>Comparações pareadas (diferença B − A)</h3>{tab_comp}
    <p class="nota">Primárias com correção de Holm; secundárias são exploratórias (sem correção).
    Para o tempo até aceite, a diferença está em escala log (razão B/A no Resumo).</p></div>
  <div class="cartao"><h3>Estatísticas descritivas por condição</h3>{tab_desc}</div>
</section>

<section id="dados">
  <h2>Dados e qualidade dos dados</h2>
  <div class="cartao"><h3>Exclusões</h3>
    {"<ul>" + "".join(f"<li>{esc(m)}</li>" for m in exclusoes) + "</ul>" if exclusoes else "<p>Nenhuma execução excluída.</p>"}</div>
  <div class="cartao"><h3>Execuções</h3>{tab_exec}</div>
  <p class="nota">Fonte: {esc(cfg.dados_processados.relative_to(cfg.raiz).as_posix() if cfg.dados_processados.is_relative_to(cfg.raiz) else cfg.dados_processados)}/execucoes.csv,
    derivado de data/raw (eventos com cadeia de hash). Tabelas completas em tables/.</p>
</section>

<section id="limitacoes">
  <h2>Limitações e validade</h2>
  <div class="grade2">
    <div class="cartao"><h3>Externa</h3><p>Um único executor, uma aplicação de pequeno porte, uma ferramenta de IA e um período.
      Os resultados não se generalizam para outros desenvolvedores, linguagens ou ferramentas.</p></div>
    <div class="cartao"><h3>Interna</h3><p>Sem cegamento do executor; aprendizagem ao longo da coleta (ver gráfico por posição);
      possíveis diferenças residuais entre gêmeas, neutralizadas pelo sorteio.</p></div>
    <div class="cartao"><h3>Constructo</h3><p>A qualidade é medida por testes ocultos derivados dos requisitos escritos,
      e vale tanto quanto a cobertura deles. Tempo ativo depende do registro de pausas.</p></div>
    <div class="cartao"><h3>Conclusão</h3><p>Amostra pequena: baixo poder para efeitos moderados. Por isso o foco está em estimativas e intervalos.</p></div>
  </div>
</section>
</main>
<footer>Gerado por <code>exp dashboard</code> em {gerado}. Os números vêm exclusivamente dos dados registrados;
este painel não interpreta resultados.</footer>
"""
    pagina = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard do experimento — {esc(cfg.fase)}</title><style>{CSS}</style></head><body>{corpo}</body></html>"""
    arq = saida / "dashboard.html"
    arq.write_text(pagina, encoding="utf-8")
    return arq


CSS = """
:root{--fundo:#f6f5f2;--sup:#fcfcfb;--tinta:#0b0b0b;--tinta2:#52514e;--grade:#e4e3df;--borda:#dddcd6;
--cA:#2a78d6;--cB:#eb6834;--neutro:#8a8984;--aviso-f:#fff4e5;--aviso-t:#7a3e00;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--fundo:#121211;--sup:#1a1a19;--tinta:#f0efec;--tinta2:#c3c2b7;
--grade:#2d2d2b;--borda:#34342f;--cA:#3987e5;--cB:#d95926;--neutro:#8d8c86;--aviso-f:#3a2508;--aviso-t:#ffd8a8;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--tinta);
font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.topo{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px 24px;align-items:center;
padding:10px max(16px,4vw);background:var(--sup);border-bottom:1px solid var(--borda)}
.marca{font-weight:600}nav{display:flex;flex-wrap:wrap;gap:4px 16px}nav a{color:var(--tinta2);text-decoration:none}
nav a:hover{color:var(--tinta)}main{max-width:1180px;margin:0 auto;padding:8px max(16px,4vw) 40px}
section{padding-top:24px;scroll-margin-top:60px}h1{font-size:clamp(22px,3vw,32px);line-height:1.2;margin:4px 0 8px}
h2{font-size:22px;margin:8px 0 14px}h3{font-size:15px;margin:0 0 8px}
.sobre,.autor{color:var(--tinta2);margin:0}.autor{margin-bottom:18px}
.cartao{background:var(--sup);border:1px solid var(--borda);border-radius:10px;padding:16px;margin:0 0 16px;min-width:0}
figure.cartao{margin:0 0 16px}figcaption{font-weight:600;margin-bottom:8px}
.grade2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.grade3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
.kpi{background:var(--sup);border:1px solid var(--borda);border-radius:10px;padding:12px 14px}
.kpi-rot{color:var(--tinta2);font-size:13px}.kpi-val{font-size:22px;font-weight:600;margin:2px 0}
.kpi-det{color:var(--tinta2);font-size:12px}
svg{width:100%;height:auto;display:block}
svg text{fill:var(--tinta2);font-size:12px}svg .rot{fill:var(--tinta);font-size:12.5px}svg .val{fill:var(--tinta);font-weight:600}
.grade{stroke:var(--grade);stroke-width:1}.liga{stroke:var(--neutro);stroke-width:1.5;opacity:.7}
.pt{stroke:var(--sup);stroke-width:2}.pt:hover{stroke:var(--tinta)}.cA{fill:var(--cA)}.cB{fill:var(--cB)}
.pt.oco{fill:var(--sup);stroke-width:2.5}.pt.oco.cA{stroke:var(--cA)}.pt.oco.cB{stroke:var(--cB)}
.ref{stroke:var(--tinta2);stroke-dasharray:4 4;stroke-width:1}.ic{stroke:var(--tinta);stroke-width:2;stroke-linecap:round}
.est{fill:var(--tinta);stroke:var(--sup);stroke-width:2}.barra{fill:var(--neutro)}.barra:hover{fill:var(--tinta2)}
.tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12.5px;color:#fff;background:var(--neutro)}
.tag.cA{background:var(--cA)}.tag.cB{background:var(--cB)}
.legenda{color:var(--tinta2)}.nota{color:var(--tinta2);font-size:13px}.frases{padding-left:18px}.vazio{color:var(--tinta2)}
.aviso{margin:16px 0 0;padding:12px 16px;border-radius:10px;background:var(--aviso-f);color:var(--aviso-t);
border:1px solid currentColor;font-weight:500}
.rolagem{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:6px 8px;border-bottom:1px solid var(--grade);text-align:left;white-space:nowrap}
th{color:var(--tinta2);font-weight:600}footer{max-width:1180px;margin:0 auto;padding:16px max(16px,4vw) 32px;color:var(--tinta2);font-size:13px}
@media print{.topo{position:static}.cartao,.kpi{break-inside:avoid}}
"""
