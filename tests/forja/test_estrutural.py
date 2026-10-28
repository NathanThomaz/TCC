"""Validação ESTRUTURAL do contrato v0.2 (forma do mapa), com jsonschema Draft 2020-12.

Cada caso negativo parte do mapa da padaria (válido), altera um único ponto e confere
que o schema rejeita o mapa com um erro localizado naquele ponto.
"""

from __future__ import annotations

import pytest

from forja.contrato import VERSAO_MAPA, carregar_schema

from .conftest import indice, jsonschema


def _caminhos_dos_erros(validador, mapa) -> list[str]:
    return [erro.json_path for erro in validador.iter_errors(mapa)]


# ---------------------------------------------------------------- contrato em si

def test_schema_e_draft_2020_12_valido():
    schema = carregar_schema()
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    jsonschema.Draft202012Validator.check_schema(schema)


def test_schema_vem_do_pacote_e_e_uma_copia():
    primeiro = carregar_schema()
    primeiro["title"] = "alterado"
    assert carregar_schema()["title"] != "alterado"


def test_versao_do_contrato_coerente_com_o_pacote():
    assert carregar_schema()["properties"]["versao_mapa"]["const"] == VERSAO_MAPA == "0.2"


# ---------------------------------------------------------------- casos válidos

def test_padaria_e_estruturalmente_valida(validador_estrutural, padaria):
    assert _caminhos_dos_erros(validador_estrutural, padaria) == []


def test_sinonimo_obsoleto_calculado_e_aceito_na_forma(validador_estrutural, padaria):
    item = padaria["entidades"][indice(padaria["entidades"], "item_venda")]
    subtotal = item["campos"][indice(item["campos"], "subtotal")]
    del subtotal["origem"]
    subtotal["calculado"] = True
    assert _caminhos_dos_erros(validador_estrutural, padaria) == []


def test_entidade_sem_ciclo_de_vida_continua_valida(validador_estrutural, padaria):
    venda = padaria["entidades"][indice(padaria["entidades"], "venda")]
    assert "ciclo_de_vida" in venda
    encomenda = padaria["entidades"][indice(padaria["entidades"], "encomenda")]
    assert "ciclo_de_vida" not in encomenda
    assert _caminhos_dos_erros(validador_estrutural, padaria) == []


# ---------------------------------------------------------------- casos inválidos
# Cada função altera o mapa e devolve o prefixo do json_path onde o erro deve aparecer.

def _entidade(m, id_):
    i = indice(m["entidades"], id_)
    return m["entidades"][i], f"$.entidades[{i}]"


def _campo(m, ent, campo):
    e, p = _entidade(m, ent)
    return e["campos"][indice(e["campos"], campo)], p


def _regra(m, id_):
    i = indice(m["regras"], id_)
    return m["regras"][i], f"$.regras[{i}]"


def _teste(m, id_):
    i = indice(m["testes_aceitacao"], id_)
    return m["testes_aceitacao"][i], f"$.testes_aceitacao[{i}]"


def _perfil(m, id_):
    i = indice(m["perfis"], id_)
    return m["perfis"][i], f"$.perfis[{i}]"


def tipo_de_campo_inexistente(m):
    c, p = _campo(m, "cliente", "nome")
    c["tipo"] = "foto"
    return p


def restricao_sem_mensagem(m):
    r, p = _regra(m, "r_estoque_suficiente")
    del r["mensagem"]
    return p


def acao_sem_alvo(m):
    r, p = _regra(m, "r_baixa_estoque")
    del r["alvo"]
    return p


def campo_opcoes_sem_lista(m):
    c, p = _campo(m, "venda", "forma_pagamento")
    del c["opcoes"]
    return p


def expressao_em_texto_livre(m):
    r, p = _regra(m, "r_estoque_suficiente")
    r["condicao"] = "quantidade <= produto.estoque"
    return p


def permissao_inventada(m):
    perfil, p = _perfil(m, "atendente")
    perfil["permissoes"]["produto"] = ["apagar_tudo"]
    return p


def cor_fora_do_formato(m):
    m["tema"]["cor_primaria"] = "laranja"
    return "$.tema"


def secao_extra_nao_prevista(m):
    m["codigo_python"] = "print(1)"
    return "$"


def forcar_dentro_dos_passos(m):
    t, p = _teste(m, "t_limite_fiado")
    t["passos"][0]["forcar"] = {"estoque": 1}
    return p


def passo_de_transicao_sem_nome(m):
    t, p = _teste(m, "t_concluir_baixa_estoque")
    del t["passos"][-1]["transicao"]
    return p


def transicao_em_passo_crud(m):
    t, p = _teste(m, "t_rascunho_nao_movimenta")
    t["passos"][0]["transicao"] = "concluir"
    return p


def excluir_sem_alvo(m):
    t, p = _teste(m, "t_concluida_nao_exclui")
    del t["passos"][-1]["alvo"]
    return p


def ciclo_de_vida_sem_inicial(m):
    e, p = _entidade(m, "venda")
    del e["ciclo_de_vida"]["inicial"]
    return p


def estado_sem_editavel(m):
    e, p = _entidade(m, "venda")
    del e["ciclo_de_vida"]["estados"][0]["editavel"]
    return p


def origem_desconhecida(m):
    c, p = _campo(m, "cliente", "saldo_fiado")
    c["origem"] = "magica"
    return p


def calculado_e_origem_juntos(m):
    c, p = _campo(m, "item_venda", "subtotal")
    c["calculado"] = True
    return p


def versao_0_1(m):
    m["versao_mapa"] = "0.1"
    return "$.versao_mapa"


def restricao_sem_gatilho(m):
    r, p = _regra(m, "r_venda_com_itens")
    del r["transicoes"]
    return p


def preparacao_sem_ref(m):
    t, p = _teste(m, "t_limite_fiado")
    del t["preparacao"][0]["ref"]
    return p


def forcar_vazio(m):
    t, p = _teste(m, "t_limite_fiado")
    t["preparacao"][0]["forcar"] = {}
    return p


def permissoes_transicoes_sem_lista(m):
    perfil, p = _perfil(m, "dona")
    perfil["permissoes_transicoes"]["venda"] = "concluir"
    return p


CASOS_INVALIDOS = [
    tipo_de_campo_inexistente, restricao_sem_mensagem, acao_sem_alvo, campo_opcoes_sem_lista,
    expressao_em_texto_livre, permissao_inventada, cor_fora_do_formato, secao_extra_nao_prevista,
    forcar_dentro_dos_passos, passo_de_transicao_sem_nome, transicao_em_passo_crud, excluir_sem_alvo,
    ciclo_de_vida_sem_inicial, estado_sem_editavel, origem_desconhecida, calculado_e_origem_juntos,
    versao_0_1, restricao_sem_gatilho, preparacao_sem_ref, forcar_vazio, permissoes_transicoes_sem_lista,
]


@pytest.mark.parametrize("mutacao", CASOS_INVALIDOS, ids=lambda f: f.__name__)
def test_mapa_invalido_e_rejeitado_no_ponto_alterado(validador_estrutural, padaria, mutacao):
    prefixo = mutacao(padaria)
    caminhos = _caminhos_dos_erros(validador_estrutural, padaria)
    assert caminhos, f"{mutacao.__name__}: o schema deveria rejeitar o mapa"
    assert any(c == prefixo or c.startswith(prefixo + ".") or c.startswith(prefixo + "[") for c in caminhos), (
        f"{mutacao.__name__}: erros em {caminhos}, esperado em {prefixo}"
    )
