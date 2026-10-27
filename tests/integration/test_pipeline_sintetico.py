"""Pipeline de análise com dados SINTÉTICOS (somente validação de código)."""

import pandas as pd
import pytest

from tcc_exp import config
from tcc_exp.analise import pipeline
from tests.fixtures.sinteticos import gerar_execucao

OCULTOS_P1A = ["test_frete_cobrado_quando_cupom_reduz_abaixo_do_limite",
               "test_total_persistido_inclui_frete_quando_cupom_reduz",
               "test_frete_gratis_exatamente_no_limite_apos_cupom"]


@pytest.fixture
def dados_sinteticos(projeto):
    cfg = config.carregar()
    cfg.plano.unlink()  # execuções sintéticas não pertencem a nenhum plano sorteado
    sessoes = cfg.dados_brutos / "sessoes"
    n = 0
    for k in range(6):
        par, tipo = f"S{k}", "T1" if k % 2 else "T3"
        for cond, tarefa, minutos, aprov, corr in (
            ("A", "P1a", 30 + k, OCULTOS_P1A, [5]),
            ("B", "P1b", 20 + k, OCULTOS_P1A[:1], [8, 4]),
        ):
            n += 1
            gerar_execucao(sessoes / f"Z{n:02d}.jsonl", f"Z{n:02d}", par, tipo, tarefa, cond,
                           minutos, aprov, 5, minutos_correcao=corr)
    return cfg


def test_relatorio_sintetico_e_marcado_e_nao_vai_para_reports(dados_sinteticos, tmp_path):
    cfg = dados_sinteticos
    pipeline.processar(cfg)
    df = pd.read_csv(cfg.dados_processados / "execucoes.csv")
    assert len(df) == 12 and df["sintetico"].all()

    with pytest.raises(RuntimeError, match="sintéticos"):
        pipeline.analisar(cfg)

    rel = pipeline.analisar(cfg, saida=tmp_path / "saida")
    texto = rel.read_text(encoding="utf-8")
    assert texto.startswith("> **DADOS SINTÉTICOS")
    assert "Pares completos (A e B): 6" in texto
    comp = pd.read_csv(tmp_path / "saida" / "tables" / "comparacoes_pareadas.csv")
    h1 = comp[comp["metrica"] == "t_aceite_min"].iloc[0]
    assert h1["n_pares"] == 6 and h1["p_randomizacao"] == pytest.approx(2 / 64)
    assert (tmp_path / "saida" / "figures" / "pares_t_aceite_min.png").exists()


def test_execucoes_fora_do_plano_sao_excluidas(projeto, tmp_path):
    cfg = config.carregar()
    gerar_execucao(cfg.dados_brutos / "sessoes" / "Z99.jsonl", "Z99", "S0", "T1", "P1a", "A",
                   30, OCULTOS_P1A, 5)
    pipeline.processar(cfg)
    texto = pipeline.analisar(cfg, saida=tmp_path / "s").read_text(encoding="utf-8")
    assert "Z99 (P1a, cond. A): fora do plano de randomização" in texto
