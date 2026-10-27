"""Dashboard: geração com dados SINTÉTICOS (somente validação de código) e proteções."""

import pytest

from tcc_exp import cli, config
from tcc_exp.analise import dashboard


def test_demo_dashboard_gera_html_com_aviso(projeto, tmp_path):
    saida = tmp_path / "demo"
    assert cli.main(["demo-dashboard", "--saida", str(saida)]) == 0
    html = (saida / "dashboard.html").read_text(encoding="utf-8")
    assert "DEMONSTRAÇÃO COM DADOS SINTÉTICOS" in html
    for secao in ("apresentacao", "resumo", "graficos", "analises", "dados", "limitacoes"):
        assert f'id="{secao}"' in html
    assert html.count("<svg") >= 7
    assert "Pares completos" in html and ">12<" in html


def test_demo_nao_pode_ser_gravado_em_reports(projeto):
    assert cli.main(["demo-dashboard", "--saida", str(projeto / "reports" / "x")]) == 1
    assert not (projeto / "reports" / "x").exists()


def test_dashboard_real_sem_pares_nao_quebra(projeto, tmp_path):
    cfg = config.carregar()
    linha = (projeto / "experiment/randomization/plano-piloto.csv").read_text().splitlines()
    exec_a = next(l.split(",")[1] for l in linha[2:] if l.split(",")[5] == "A")
    assert cli.main(["abrir", exec_a, "--confirmo-sem-ia"]) == 0
    assert cli.main(["iniciar", exec_a]) == 0
    assert cli.main(["encerrar-limite", exec_a]) == 0
    assert cli.main(["processar"]) == 0
    html = dashboard.gerar(cfg).read_text(encoding="utf-8")
    assert "DADOS SINTÉTICOS" not in html
    assert "dados insuficientes" in html


@pytest.mark.parametrize("v,esperado", [(1234.5, "1.234,5"), (None, "—"), (0.0, "0,0")])
def test_formato_brasileiro(v, esperado):
    assert dashboard.num(v) == esperado
