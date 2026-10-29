"""Ciclo de vida (estados e transições): garantias que o validador impõe no mapa.

Estes testes provam que o MAPA expressa e respeita as decisões aprovadas. O
comportamento em execução (estorno real, sem duplicidade) depende do motor de
geração, que ainda não existe.
"""

from __future__ import annotations

import copy

import pytest

from .conftest import indice, validar_e_conferir

BASE = "/entidades/2/ciclo_de_vida"  # venda


def _ciclo(m):
    return m["entidades"][indice(m["entidades"], "venda")]["ciclo_de_vida"]


def _situacao(m):
    venda = m["entidades"][indice(m["entidades"], "venda")]
    return venda["campos"][indice(venda["campos"], "situacao")]


def test_garantias_da_venda_no_exemplo(padaria):
    ciclo = _ciclo(padaria)
    estados = {e["id"]: e for e in ciclo["estados"]}
    transicoes = {t["id"]: t for t in ciclo["transicoes"]}
    assert ciclo["inicial"] == "rascunho"
    assert estados["rascunho"]["editavel"] and estados["rascunho"]["excluivel"]           # decisão 1
    assert not estados["concluida"]["excluivel"] and not estados["concluida"]["editavel"]  # decisão 3
    assert transicoes["cancelar"]["de"] == ["concluida"] and transicoes["cancelar"]["estorna"] == "concluir"
    assert estados["cancelada"].get("final") is True                                      # decisão 4 (no mapa)
    assert not estados["cancelada"]["excluivel"] and not estados["cancelada"]["editavel"]  # P6
    efeitos = [r for r in padaria["regras"] if r["tipo"] == "acao"]
    assert efeitos and all(r.get("transicoes") == ["concluir"] for r in efeitos)          # decisão 2
    assert validar_e_conferir(padaria) == []


CASOS = [
    ("estado_inicial_inexistente", lambda m: _ciclo(m).update(inicial="aberta"),
     "ESTADO_INICIAL_INEXISTENTE", f"{BASE}/inicial"),
    ("transicao_saindo_de_estado_final", lambda m: _ciclo(m)["transicoes"][0]["de"].append("cancelada"),
     "TRANSICAO_DE_ESTADO_FINAL", f"{BASE}/transicoes/0/de/1"),
    ("transicao_para_estado_inexistente", lambda m: _ciclo(m)["transicoes"][0].update(para="paga"),
     "REF_ESTADO_INEXISTENTE", f"{BASE}/transicoes/0/para"),
    ("estorno_partindo_do_estado_errado", lambda m: _ciclo(m)["transicoes"][1].update(de=["rascunho"]),
     "ESTORNO_INVALIDO", f"{BASE}/transicoes/1/de"),
    ("estorno_de_si_mesmo", lambda m: _ciclo(m)["transicoes"][1].update(estorna="cancelar"),
     "ESTORNO_INVALIDO", f"{BASE}/transicoes/1/estorna"),
    ("estorno_de_transicao_inexistente", lambda m: _ciclo(m)["transicoes"][1].update(estorna="pagar"),
     "REF_TRANSICAO_INEXISTENTE", f"{BASE}/transicoes/1/estorna"),
    ("estado_com_efeitos_excluivel", lambda m: _ciclo(m)["estados"][1].update(excluivel=True),
     "EXCLUSAO_COM_EFEITOS", f"{BASE}/estados/1/excluivel"),
    ("regra_de_transicao_sem_ciclo", lambda m: m["regras"][7].update(transicoes=["concluir"]),
     "GATILHO_SEM_CICLO", "/regras/7/transicoes"),
    ("regra_com_transicao_inexistente", lambda m: m["regras"][4].update(transicoes=["finalizar"]),
     "REF_TRANSICAO_INEXISTENTE", "/regras/4/transicoes/0"),
    ("detalhe_que_nao_parte_da_entidade", lambda m: _ciclo(m).update(detalhes=["produto_itens"]),
     "DETALHE_INVALIDO", f"{BASE}/detalhes/0"),
    ("opcoes_do_campo_diferentes_dos_estados", lambda m: _situacao(m)["opcoes"].append("perdida"),
     "CAMPO_ESTADO_INVALIDO", f"{BASE}/campo"),
    ("campo_de_estado_com_origem_usuario", lambda m: _situacao(m).update(origem="usuario"),
     "CAMPO_ESTADO_INVALIDO", f"{BASE}/campo"),
    ("padrao_do_campo_diferente_do_inicial", lambda m: _situacao(m).update(padrao="concluida"),
     "CAMPO_ESTADO_INVALIDO", f"{BASE}/campo"),
    ("origem_estado_fora_de_ciclo", lambda m: m["entidades"][4]["campos"][3].update(origem="estado"),
     "CAMPO_ESTADO_INVALIDO", "/entidades/4/campos/3/origem"),
    ("estado_duplicado", lambda m: _ciclo(m)["estados"].append(copy.deepcopy(_ciclo(m)["estados"][0])),
     "ID_DUPLICADO", f"{BASE}/estados/3/id"),
]


@pytest.mark.parametrize("nome,mutacao,codigo,caminho", CASOS, ids=[c[0] for c in CASOS])
def test_inconsistencia_de_ciclo_de_vida(padaria, nome, mutacao, codigo, caminho):
    mutacao(padaria)
    encontrados = [(e.codigo, e.caminho) for e in validar_e_conferir(padaria)]
    assert (codigo, caminho) in encontrados, f"{nome}: esperado {(codigo, caminho)}, obtido {encontrados}"


def test_estado_inalcancavel_e_aviso(padaria):
    _ciclo(padaria)["estados"].append({"id": "arquivada", "nome": "Arquivada", "editavel": False, "excluivel": False})
    _situacao(padaria)["opcoes"].append("arquivada")
    erros = validar_e_conferir(padaria)
    assert [(e.codigo, e.caminho, e.severidade) for e in erros] == [("ESTADO_INALCANCAVEL", f"{BASE}/estados/3/id", "aviso")]
