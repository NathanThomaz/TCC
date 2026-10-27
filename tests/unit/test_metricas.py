from tcc_exp import eventos as ev
from tcc_exp import metricas
from tests.fixtures.sinteticos import gerar_execucao

SEV = {"a": "critico", "b": "maior", "c": "menor", "d": "menor"}


def test_metricas_com_retrabalho(tmp_path):
    arq = tmp_path / "s.jsonl"
    gerar_execucao(arq, "X01", "S1", "T1", "P1a", "B", 20, ["a", "c"], 4, minutos_correcao=[7, 3])
    m = metricas.calcular(ev.ler(arq), SEV, limite_min=90)
    assert m["t_leitura_min"] == 3
    assert m["t_1a_entrega_min"] == 20
    assert m["t_total_min"] == 30
    assert m["t_aceite_min"] == 30 and m["aceita"] and not m["censurada"]
    assert m["taxa_ocultos_1a"] == 0.5
    assert (m["defeitos_1a_critico"], m["defeitos_1a_maior"], m["defeitos_1a_menor"]) == (0, 1, 1)
    assert m["ciclos"] == 2
    assert m["t_retrabalho_min"] == 10
    assert m["churn_pos_1a_linhas"] == 4


def test_execucao_nao_aceita_e_censurada_no_limite(tmp_path):
    arq = tmp_path / "s.jsonl"
    gerar_execucao(arq, "X02", "S1", "T1", "P1b", "A", 40, [], 4, minutos_correcao=[5, 5], aceita=False)
    m = metricas.calcular(ev.ler(arq), SEV, limite_min=90)
    assert m["censurada"] and not m["aceita"]
    assert m["t_aceite_min"] == 90.0
    assert m["defeitos_1a_critico"] == 1


def test_execucao_abortada_so_tem_identificacao(tmp_path):
    arq = tmp_path / "s.jsonl"
    ev.registrar(arq, "X03", "abertura", {"tarefa_id": "P1a", "condicao": "B", "par": "P1"})
    ev.registrar(arq, "X03", "inicio")
    ev.registrar(arq, "X03", "aborto", {"motivo": "API indisponível"})
    m = metricas.calcular(ev.ler(arq), SEV, limite_min=90)
    assert m["abortada"] and not m["concluida"]
    assert "t_aceite_min" not in m
