from datetime import datetime, timedelta, timezone

import pytest

from tcc_exp import eventos as ev
from tcc_exp import sessao

T0 = datetime(2030, 1, 1, tzinfo=timezone.utc)


def _reg(arq, tipo, minuto, payload=None):
    return ev.registrar(arq, "X01", tipo, payload, agora=T0 + timedelta(minutes=minuto))


def test_cadeia_de_hash_detecta_edicao(tmp_path):
    arq = tmp_path / "s.jsonl"
    _reg(arq, "abertura", 0, {"tarefa_id": "P1a", "condicao": "A"})
    _reg(arq, "inicio", 1)
    _reg(arq, "nota", 2, {"texto": "ok"})
    assert ev.verificar_cadeia(arq) == []
    linhas = arq.read_text(encoding="utf-8").splitlines()
    linhas[1] = linhas[1].replace('"inicio"', '"pausa"')
    arq.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    assert ev.verificar_cadeia(arq)  # alteração detectada


def test_tipo_desconhecido_e_recusado(tmp_path):
    with pytest.raises(ev.ErroEvento):
        ev.registrar(tmp_path / "s.jsonl", "X01", "inventado")


def test_transicoes_validas_e_invalidas():
    assert sessao.proximo_estado(None, "abertura") == "aberta"
    assert sessao.proximo_estado("em_execucao", "nota") == "em_execucao"
    with pytest.raises(sessao.TransicaoInvalida):
        sessao.proximo_estado("aberta", "entrega")
    with pytest.raises(sessao.TransicaoInvalida):
        sessao.proximo_estado("pausada", "entrega")
    with pytest.raises(sessao.TransicaoInvalida):
        sessao.proximo_estado("encerrada", "inicio")


def test_tempo_ativo_desconta_pausas(tmp_path):
    arq = tmp_path / "s.jsonl"
    _reg(arq, "abertura", 0, {"tarefa_id": "P1a", "condicao": "A"})
    _reg(arq, "inicio", 5)
    _reg(arq, "pausa", 15)
    _reg(arq, "retomada", 25)   # 10 min de pausa
    _reg(arq, "entrega", 45)
    evs = ev.ler(arq)
    assert sessao.tempo_ativo(evs, 1, 4) == 30 * 60
    s = sessao.reconstruir(evs)
    assert (s.estado, s.entregas, s.condicao) == ("avaliando", 1, "A")


def test_pausa_aberta_ate_o_fim_do_intervalo(tmp_path):
    arq = tmp_path / "s.jsonl"
    _reg(arq, "abertura", 0)
    _reg(arq, "inicio", 0)
    _reg(arq, "pausa", 10)
    _reg(arq, "nota", 30)
    assert sessao.tempo_ativo(ev.ler(arq), 1, 3) == 10 * 60
