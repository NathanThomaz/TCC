import pytest

from tcc_exp import ia, sorteio
from tcc_exp.config import ErroConfiguracao

PARES = [{"id": f"{t}-{k}", "tipo": t, "gemeas": [f"{t}-{k}a", f"{t}-{k}b"]}
         for t in ("T1", "T2", "T3", "T4") for k in (1, 2, 3)]


def test_plano_reprodutivel_e_balanceado():
    p1 = sorteio.gerar_plano(PARES, 42)
    assert p1 == sorteio.gerar_plano(PARES, 42)
    assert p1 != sorteio.gerar_plano(PARES, 43)
    assert len(p1) == 24
    # cada par tem exatamente uma execução A e uma B, uma em cada gêmea
    for par in PARES:
        linhas = [l for l in p1 if l["par"] == par["id"]]
        assert sorted(l["condicao"] for l in linhas) == ["A", "B"]
        assert sorted(l["tarefa_id"] for l in linhas) == sorted(par["gemeas"])
    # metade dos pares começa com B
    primeiros = [l for l in p1 if l["ordem_no_par"] == 1]
    assert sum(l["condicao"] == "B" for l in primeiros) == 6
    # pares consecutivos não repetem o tipo
    tipos = [l["tipo"] for l in primeiros]
    assert all(a != b for a, b in zip(tipos, tipos[1:]))


def test_salvar_e_ler_plano(tmp_path):
    arq = tmp_path / "plano.csv"
    linhas = sorteio.gerar_plano(PARES[:2], 1)
    sorteio.salvar(linhas, arq, 1)
    lido = sorteio.ler_plano(arq)
    assert [l["exec_id"] for l in lido] == [l["exec_id"] for l in linhas]
    assert (tmp_path / "plano.sha256").exists()
    assert b"\r\n" not in arq.read_bytes()


def test_condicao_A_exige_confirmacao():
    with pytest.raises(ErroConfiguracao):
        ia.metadados_condicao("A", {})
    assert ia.metadados_condicao("A", {}, confirmo_sem_ia=True)["ia_desativada_confirmada"]


def test_condicao_B_exige_ferramenta_configurada():
    with pytest.raises(ErroConfiguracao, match="D3"):
        ia.metadados_condicao("B", {"ferramenta_ia": {"nome": ""}})
    exp = {"ferramenta_ia": {"nome": "Ferramenta X", "fornecedor": "F", "modalidade": "agente",
                             "modelo": "modelo-1"}}
    meta = ia.metadados_condicao("B", exp, modelo_observado="modelo-2")
    assert meta["modelo_diverge_da_config"] is True
