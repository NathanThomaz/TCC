"""Validação SEMÂNTICA: referências, caminhos, tipos, cálculos, ações, regras, telas, perfis e testes.

Cada caso parte do mapa da padaria (válido), altera um único ponto e confere que o
validador acusa o código esperado no caminho esperado (JSON Pointer).
"""

from __future__ import annotations

import copy

import pytest

from .conftest import indice, validar_e_conferir

# Posições no exemplo da padaria usadas nos caminhos esperados (conferidas em test_posicoes_do_exemplo).
ENT = {"cliente": 0, "produto": 1, "venda": 2, "item_venda": 3, "encomenda": 4}
REGRA = {"r_venda_com_itens": 0, "r_estoque_suficiente": 1, "r_subtotal": 2, "r_total_venda": 3,
         "r_baixa_estoque": 4, "r_limite_fiado": 5, "r_soma_fiado": 6, "r_entrega_futura": 7}
TELA = {"painel": 0, "vendas": 1, "produtos": 2, "clientes": 3, "encomendas": 4, "relatorio_vendas": 5}
TESTE = {"t_rascunho_nao_movimenta": 0, "t_concluir_baixa_estoque": 1, "t_bloqueia_sem_estoque": 2,
         "t_cancelar_estorna": 3, "t_cancelar_duas_vezes": 4, "t_concluida_nao_exclui": 5,
         "t_limite_fiado": 6, "t_estorno_fiado": 7}


def test_posicoes_do_exemplo(padaria):
    for nome, i in ENT.items():
        assert indice(padaria["entidades"], nome) == i
    for nome, i in REGRA.items():
        assert indice(padaria["regras"], nome) == i
    for nome, i in TELA.items():
        assert indice(padaria["telas"]["itens"], nome) == i
    for nome, i in TESTE.items():
        assert indice(padaria["testes_aceitacao"], nome) == i


def test_padaria_sem_erros_nem_avisos(padaria):
    assert validar_e_conferir(padaria) == []


def _r(m, nome):
    return m["regras"][REGRA[nome]]


def _t(m, nome):
    return m["testes_aceitacao"][TESTE[nome]]


def _campo(m, ent, cid):
    e = m["entidades"][ENT[ent]]
    return e["campos"][indice(e["campos"], cid)]


# Cada caso: (nome, função que altera o mapa, código esperado, caminho esperado)
CASOS = [
    # ---- referências
    ("entidade_inexistente_na_regra", lambda m: _r(m, "r_estoque_suficiente").update(entidade="vendaa"),
     "REF_ENTIDADE_INEXISTENTE", "/regras/1/entidade"),
    ("campo_inexistente_no_caminho", lambda m: _r(m, "r_estoque_suficiente")["condicao"]["dir"].update(campo="produto.estoqe"),
     "REF_CAMPO_INEXISTENTE", "/regras/1/condicao/dir/campo"),
    ("caminho_por_relacionamento_inexistente", lambda m: _r(m, "r_estoque_suficiente")["condicao"]["dir"].update(campo="fornecedor.estoque"),
     "CAMINHO_INVALIDO", "/regras/1/condicao/dir/campo"),
    ("relacionamento_inexistente_no_detalhe", lambda m: m["telas"]["itens"][TELA["vendas"]].update(detalhe="venda_itenz"),
     "REF_RELACIONAMENTO_INEXISTENTE", "/telas/itens/1/detalhe"),
    ("tela_inexistente_no_menu", lambda m: m["telas"]["menu"].append("estoque"),
     "REF_TELA_INEXISTENTE", "/telas/menu/6"),
    ("regra_inexistente_no_teste", lambda m: _t(m, "t_concluir_baixa_estoque").update(regra="r_nao_existe"),
     "REF_REGRA_INEXISTENTE", "/testes_aceitacao/1/regra"),
    ("entidade_inexistente_no_relacionamento", lambda m: m["relacionamentos"][3].update(destino="pedido"),
     "REF_ENTIDADE_INEXISTENTE", "/relacionamentos/3/destino"),
    ("rotulo_inexistente", lambda m: m["entidades"][ENT["cliente"]].update(rotulo="apelido"),
     "REF_CAMPO_INEXISTENTE", "/entidades/0/rotulo"),
    # ---- tipos
    ("aritmetica_com_texto", lambda m: _r(m, "r_subtotal")["expressao"]["args"].__setitem__(1, {"valor": "dez"}),
     "TIPO_INCOMPATIVEL", "/regras/2/expressao/args/1"),
    ("comparacao_de_data_com_numero", lambda m: _r(m, "r_entrega_futura")["condicao"].update(dir={"valor": 5}),
     "TIPO_INCOMPATIVEL", "/regras/7/condicao"),
    ("comparacao_de_ordem_entre_textos", lambda m: _r(m, "r_entrega_futura")["condicao"].update(
        esq={"campo": "descricao"}, dir={"valor": "abc"}),
     "TIPO_INCOMPATIVEL", "/regras/7/condicao"),
    ("condicao_nao_booleana", lambda m: _r(m, "r_venda_com_itens").update(condicao={"agregar": "contagem", "colecao": "itens"}),
     "CONDICAO_NAO_BOOLEANA", "/regras/0/condicao"),
    ("valor_fora_das_opcoes", lambda m: _r(m, "r_soma_fiado")["condicao"]["dir"].update(valor="fiado_"),
     "VALOR_FORA_DAS_OPCOES", "/regras/6/condicao/dir/valor"),
    ("calculo_com_tipo_incompativel", lambda m: _r(m, "r_subtotal").update(
        expressao={"comparar": ">", "esq": {"campo": "quantidade"}, "dir": {"valor": 0}}),
     "CALCULO_TIPO_INCOMPATIVEL", "/regras/2/expressao"),
    ("acao_com_valor_de_texto", lambda m: _r(m, "r_baixa_estoque").update(valor={"valor": "dois"}),
     "ACAO_TIPO_INCOMPATIVEL", "/regras/4/valor"),
    ("colecao_onde_se_espera_valor", lambda m: m["telas"]["itens"][TELA["vendas"]]["campos"].append("itens"),
     "COLECAO_ONDE_SE_ESPERA_VALOR", "/telas/itens/1/campos/5"),
    ("agregacao_sem_colecao", lambda m: _r(m, "r_total_venda")["expressao"].update(colecao="cliente"),
     "AGREGACAO_SEM_COLECAO", "/regras/3/expressao/colecao"),
    ("agregacao_sem_expressao", lambda m: _r(m, "r_total_venda")["expressao"].pop("expr"),
     "AGREGACAO_SEM_EXPRESSAO", "/regras/3/expressao"),
    ("para_cada_que_nao_e_colecao", lambda m: _r(m, "r_estoque_suficiente").update(para_cada="cliente"),
     "PARA_CADA_INVALIDO", "/regras/1/para_cada"),
    # ---- cálculos
    ("calculado_sem_regra", lambda m: m["regras"].pop(REGRA["r_subtotal"]),
     "CALCULADO_SEM_REGRA", "/entidades/3/campos/2/origem"),
    ("calculo_duplicado", lambda m: m["regras"].append(dict(copy.deepcopy(_r(m, "r_subtotal")), id="r_subtotal_2")),
     "CALCULO_DUPLICADO", "/regras/8/campo"),
    ("calculo_em_campo_nao_calculado", lambda m: _r(m, "r_subtotal").update(campo="quantidade"),
     "CALCULO_EM_CAMPO_NAO_CALCULADO", "/regras/2/campo"),
    ("ciclo_de_calculo_direto", lambda m: _r(m, "r_subtotal").update(
        expressao={"op": "+", "args": [{"campo": "subtotal"}, {"valor": 1}]}),
     "CICLO_DE_CALCULO", "/regras/2/expressao"),
    ("ciclo_de_calculo_via_agregacao", lambda m: _r(m, "r_subtotal").update(
        expressao={"op": "*", "args": [{"campo": "quantidade"}, {"campo": "venda.total"}]}),
     "CICLO_DE_CALCULO", "/regras/2/expressao"),
    # ---- ações
    ("acao_altera_campo_calculado", lambda m: _r(m, "r_soma_fiado").update(alvo="total"),
     "ACAO_ALTERA_CALCULADO", "/regras/6/alvo"),
    ("acao_altera_campo_de_estado", lambda m: _r(m, "r_soma_fiado").update(alvo="situacao", operacao="definir", valor={"valor": "cancelada"}),
     "ACAO_ALTERA_ESTADO", "/regras/6/alvo"),
    ("campo_de_acao_sem_acao", lambda m: m["regras"].pop(REGRA["r_soma_fiado"]),
     "CAMPO_ACAO_SEM_ACAO", "/entidades/0/campos/3/origem"),
    ("reverter_em_acao_de_transicao", lambda m: _r(m, "r_baixa_estoque").update(reverter_ao_excluir=True),
     "REVERTER_EM_TRANSICAO", "/regras/4/reverter_ao_excluir"),
    ("acao_disparada_por_edicao", lambda m: _r(m, "r_baixa_estoque").update(eventos=["editar"]),
     "ACAO_EM_EDICAO_NAO_SUPORTADA", "/regras/4/eventos/0"),
    # ---- regras e identificadores
    ("regra_com_id_duplicado", lambda m: _r(m, "r_entrega_futura").update(id="r_subtotal"),
     "REGRA_DUPLICADA", "/regras/7/id"),
    ("campo_com_id_duplicado", lambda m: m["entidades"][ENT["produto"]]["campos"].append(copy.deepcopy(_campo(m, "produto", "estoque"))),
     "ID_DUPLICADO", "/entidades/1/campos/4/id"),
    ("nome_de_relacionamento_conflitante", lambda m: m["relacionamentos"][0].update(nome_no_destino="data"),
     "NOME_CONFLITANTE", "/relacionamentos/0/nome_no_destino"),
    # ---- telas e perfis
    ("periodo_do_relatorio_nao_e_data", lambda m: m["telas"]["itens"][TELA["relatorio_vendas"]].update(campo_periodo="total"),
     "TIPO_INCOMPATIVEL", "/telas/itens/5/campo_periodo"),
    ("indicador_soma_sem_campo", lambda m: m["telas"]["itens"][TELA["painel"]]["indicadores"][0].pop("campo"),
     "AGREGACAO_SEM_EXPRESSAO", "/telas/itens/0/indicadores/0"),
    ("perfil_com_entidade_inexistente", lambda m: m["perfis"][1]["permissoes"].update(pedido=["ler"]),
     "PERFIL_ENTIDADE_INEXISTENTE", "/perfis/1/permissoes/pedido"),
    ("perfil_com_transicao_inexistente", lambda m: m["perfis"][0]["permissoes_transicoes"]["venda"].append("estornar"),
     "REF_TRANSICAO_INEXISTENTE", "/perfis/0/permissoes_transicoes/venda/2"),
    # ---- testes de aceitação
    ("teste_usa_ref_indefinida", lambda m: _t(m, "t_concluir_baixa_estoque")["passos"][3].update(alvo="@v9"),
     "TESTE_REF_INDEFINIDA", "/testes_aceitacao/1/passos/3/alvo"),
    ("teste_ref_de_outra_entidade", lambda m: _t(m, "t_concluir_baixa_estoque")["passos"][2]["dados"].update(produto="@v1"),
     "TESTE_REF_ENTIDADE_INCOMPATIVEL", "/testes_aceitacao/1/passos/2/dados/produto"),
    ("campo_protegido_na_preparacao", lambda m: _t(m, "t_limite_fiado")["preparacao"][0]["dados"].update(saldo_fiado=100),
     "TESTE_CAMPO_PROTEGIDO", "/testes_aceitacao/6/preparacao/0/dados/saldo_fiado"),
    ("campo_calculado_nos_passos", lambda m: _t(m, "t_rascunho_nao_movimenta")["passos"][1]["dados"].update(total=10),
     "TESTE_CAMPO_PROTEGIDO", "/testes_aceitacao/0/passos/1/dados/total"),
    ("forcar_campo_de_usuario", lambda m: _t(m, "t_limite_fiado")["preparacao"][0].update(forcar={"limite_fiado": 500}),
     "FORCAR_CAMPO_DE_USUARIO", "/testes_aceitacao/6/preparacao/0/forcar/limite_fiado"),
    ("teste_com_transicao_inexistente", lambda m: _t(m, "t_concluir_baixa_estoque")["passos"][3].update(transicao="finalizar"),
     "TESTE_TRANSICAO_INEXISTENTE", "/testes_aceitacao/1/passos/3/transicao"),
    ("teste_com_valor_fora_das_opcoes", lambda m: _t(m, "t_rascunho_nao_movimenta")["passos"][1]["dados"].update(forma_pagamento="boleto"),
     "VALOR_FORA_DAS_OPCOES", "/testes_aceitacao/0/passos/1/dados/forma_pagamento"),
    ("teste_com_data_invalida", lambda m: _t(m, "t_rascunho_nao_movimenta")["passos"][1]["dados"].update(data="02/11/2026"),
     "DATA_INVALIDA", "/testes_aceitacao/0/passos/1/dados/data"),
    ("teste_com_campo_inexistente", lambda m: _t(m, "t_rascunho_nao_movimenta")["passos"][0]["dados"].update(cor="azul"),
     "REF_CAMPO_INEXISTENTE", "/testes_aceitacao/0/passos/0/dados/cor"),
    ("verificar_ref_indefinida", lambda m: _t(m, "t_rascunho_nao_movimenta")["esperado"]["verificar"][0].update(registro="@bolo"),
     "TESTE_REF_INDEFINIDA", "/testes_aceitacao/0/esperado/verificar/0/registro"),
    # ---- formatos
    ("data_invalida_nos_metadados", lambda m: m["metadados"].update(criado_em="28/10/2026"),
     "DATA_INVALIDA", "/metadados/criado_em"),
]


@pytest.mark.parametrize("nome,mutacao,codigo,caminho", CASOS, ids=[c[0] for c in CASOS])
def test_erro_semantico_no_ponto_alterado(padaria, nome, mutacao, codigo, caminho):
    mutacao(padaria)
    erros = validar_e_conferir(padaria)
    assert all(e.camada == "semantica" for e in erros), [e.codigo for e in erros]
    encontrados = [(e.codigo, e.caminho) for e in erros]
    assert (codigo, caminho) in encontrados, f"{nome}: esperado {(codigo, caminho)}, obtido {encontrados}"
    assert any(e.severidade == "erro" for e in erros)


def test_mensagem_do_ciclo_mostra_o_caminho(padaria):
    _r(padaria, "r_subtotal")["expressao"] = {"op": "*", "args": [{"campo": "quantidade"}, {"campo": "venda.total"}]}
    ciclo = [e for e in validar_e_conferir(padaria) if e.codigo == "CICLO_DE_CALCULO"]
    assert len(ciclo) == 1
    assert ciclo[0].detalhes["ciclo"] == ["item_venda.subtotal", "venda.total", "item_venda.subtotal"]


def test_referencia_inexistente_traz_sugestao(padaria):
    _r(padaria, "r_estoque_suficiente")["condicao"]["dir"]["campo"] = "produto.estoqe"
    erro = next(e for e in validar_e_conferir(padaria) if e.codigo == "REF_CAMPO_INEXISTENTE")
    assert "estoque" in erro.detalhes["sugestoes"]


# ---- avisos (não bloqueiam: o mapa continua válido)

def test_regra_equivalente_e_aviso(padaria):
    copia = copy.deepcopy(_r(padaria, "r_entrega_futura"))
    copia.update(id="r_entrega_futura_2", nome="Outra frase")
    padaria["regras"].append(copia)
    erros = validar_e_conferir(padaria)
    assert [(e.codigo, e.caminho, e.severidade) for e in erros] == [("REGRA_EQUIVALENTE", "/regras/8", "aviso")]


def test_entidade_sem_perfil_e_aviso(padaria):
    for perfil in padaria["perfis"]:
        perfil["permissoes"].pop("encomenda")
    erros = validar_e_conferir(padaria)
    assert [(e.codigo, e.caminho, e.severidade) for e in erros] == [("PERFIL_SEM_ENTIDADE", "/entidades/4/id", "aviso")]


def test_sinonimo_calculado_gera_aviso_e_continua_valido(padaria):
    subtotal = _campo(padaria, "item_venda", "subtotal")
    del subtotal["origem"]
    subtotal["calculado"] = True
    erros = validar_e_conferir(padaria)
    assert [(e.codigo, e.caminho, e.severidade) for e in erros] == [
        ("CAMPO_CALCULADO_OBSOLETO", "/entidades/3/campos/2/calculado", "aviso")]
