import numpy as np
import pandas as pd
import pytest

from tcc_exp.analise import estatistica as est


def test_randomizacao_exata_caso_conhecido():
    # 3 diferenças positivas: só as permutações (+,+,+) e (−,−,−) têm |média| máxima → p = 2/8
    r = est.teste_randomizacao([1.0, 2.0, 3.0])
    assert r["metodo"] == "exato" and r["n_permutacoes"] == 8
    assert r["p"] == pytest.approx(0.25)


def test_randomizacao_sem_efeito_tem_p_alto():
    assert est.teste_randomizacao([1, -1, 2, -2, 0.5, -0.5])["p"] == pytest.approx(1.0)


def test_randomizacao_monte_carlo_para_n_grande():
    r = est.teste_randomizacao(np.ones(20), n_mc=20_000)
    assert r["metodo"] == "monte_carlo"
    assert r["p"] < 0.001


def test_hodges_lehmann():
    assert est.hodges_lehmann([1, 2, 3]) == pytest.approx(2.0)
    assert est.hodges_lehmann([]) is None


def test_holm():
    aj = est.holm({"a": 0.01, "b": 0.04, "c": 0.03, "d": None})
    assert aj["a"] == pytest.approx(0.03)
    assert aj["c"] == pytest.approx(0.06)
    assert aj["b"] == pytest.approx(0.06)  # monotonicidade
    assert aj["d"] is None


def test_diferencas_pareadas_log_e_pares_incompletos():
    df = pd.DataFrame({
        "par": ["P1", "P1", "P2", "P3", "P3"],
        "tipo": ["T1"] * 5,
        "condicao": ["A", "B", "A", "A", "B"],
        "t": [20.0, 10.0, 30.0, 40.0, 40.0],
    })
    p = est.diferencas_pareadas(df, "t", log=True)
    assert list(p["par"]) == ["P1", "P3"]  # P2 sem B é descartado
    assert p["dif"].iloc[0] == pytest.approx(np.log(0.5))


def test_bootstrap_ic_contem_mediana():
    d = np.array([1.0, 2, 3, 4, 5, 6])
    inf, sup = est.bootstrap_ic(d)
    assert inf <= np.median(d) <= sup
