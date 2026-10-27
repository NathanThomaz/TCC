"""Testes da aplicação-base (não são testes de tarefa; não vão para os workspaces)."""

from datetime import date

import pytest

from loja import estoque, etl, pedidos, precos, relatorios
from loja.exemplo import id_produto
from loja.precos import Cupom, Item


# ---- preços

def test_desconto_por_quantidade_faixas():
    assert precos.preco_item(Item(1, 4, 1000)) == 4000
    assert precos.preco_item(Item(1, 5, 1000)) == 4750
    assert precos.preco_item(Item(1, 10, 1000)) == 9000


def test_cupom_valido_no_ultimo_dia_e_com_minimo():
    cupom = Cupom("X", 10, date(2026, 3, 31), minimo_centavos=10000)
    t = precos.calcular_totais([Item(1, 1, 20000)], cupom, date(2026, 3, 31))
    assert t.desconto_centavos == 2000
    t2 = precos.calcular_totais([Item(1, 1, 20000)], cupom, date(2026, 4, 1))
    assert t2.desconto_centavos == 0
    t3 = precos.calcular_totais([Item(1, 1, 9999)], cupom, date(2026, 3, 1))
    assert t3.desconto_centavos == 0


def test_frete_gratis_considera_valor_apos_cupom():
    cupom = Cupom("X", 10, date(2026, 12, 31))
    t = precos.calcular_totais([Item(1, 1, 32000)], cupom, date(2026, 1, 1))  # 32000 - 3200 = 28800
    assert t.frete_centavos == precos.FRETE_PADRAO_CENTAVOS
    t2 = precos.calcular_totais([Item(1, 1, 30000)], None, date(2026, 1, 1))
    assert t2.frete_centavos == 0


def test_pedido_vazio_sem_frete():
    assert precos.calcular_totais([], None, date(2026, 1, 1)).total_centavos == 0


# ---- estoque e pedidos

def test_criar_pedido_baixa_estoque_e_calcula_total(conn):
    caf = id_produto(conn, "CAF-001")
    pid = pedidos.criar_pedido(conn, 1, [(caf, 2)], data=date(2026, 2, 1))
    assert estoque.saldo(conn, caf) == 48
    total = conn.execute("SELECT total_centavos FROM pedidos WHERE id = ?", (pid,)).fetchone()[0]
    assert total == 2 * 6990 + precos.FRETE_PADRAO_CENTAVOS


def test_estoque_insuficiente_nao_cria_pedido(conn):
    moe = id_produto(conn, "MOE-020")
    with pytest.raises(estoque.EstoqueInsuficiente):
        pedidos.criar_pedido(conn, 1, [(moe, 9)])
    assert estoque.saldo(conn, moe) == 8
    assert conn.execute("SELECT COUNT(*) FROM pedidos").fetchone()[0] == 0


def test_cancelar_devolve_todas_as_unidades(conn):
    caf, fil = id_produto(conn, "CAF-001"), id_produto(conn, "FIL-021")
    pid = pedidos.criar_pedido(conn, 1, [(caf, 3), (fil, 7)])
    pedidos.cancelar_pedido(conn, pid)
    assert estoque.saldo(conn, caf) == 50
    assert estoque.saldo(conn, fil) == 200
    assert pedidos.status(conn, pid) == "cancelado"


def test_nao_cancela_pedido_enviado(conn):
    caf = id_produto(conn, "CAF-001")
    pid = pedidos.criar_pedido(conn, 1, [(caf, 1)])
    pedidos.alterar_status(conn, pid, "pago")
    pedidos.alterar_status(conn, pid, "enviado")
    with pytest.raises(pedidos.ErroPedido):
        pedidos.cancelar_pedido(conn, pid)


# ---- relatórios

def _venda(conn, cliente, itens, data, status="pago"):
    pid = pedidos.criar_pedido(conn, cliente, itens, data=date.fromisoformat(data))
    if status != "pendente":
        pedidos.alterar_status(conn, pid, "cancelado" if status == "cancelado" else "pago")
    return pid


def test_vendas_por_categoria_conta_pedidos_distintos(conn):
    caf, cha, can = (id_produto(conn, s) for s in ("CAF-001", "CHA-002", "CAN-010"))
    _venda(conn, 1, [(caf, 1), (cha, 2)], "2026-02-10")
    _venda(conn, 2, [(can, 1)], "2026-02-11")
    _venda(conn, 3, [(caf, 5)], "2026-02-12", status="cancelado")
    r = relatorios.vendas_por_categoria(conn, "2026-02-01", "2026-03-01")
    assert r == [("mercearia", 6990 + 2 * 1890, 1), ("utilidades", 3500, 1)]


def test_produtos_sem_venda(conn):
    caf = id_produto(conn, "CAF-001")
    cha = id_produto(conn, "CHA-002")
    _venda(conn, 1, [(caf, 1)], "2026-02-10")
    _venda(conn, 1, [(cha, 1)], "2026-02-10", status="cancelado")
    r = relatorios.produtos_sem_venda(conn, "2026-02-01", "2026-03-01")
    assert "CAF-001" not in r and "CHA-002" in r


def test_top_clientes(conn):
    caf, moe = id_produto(conn, "CAF-001"), id_produto(conn, "MOE-020")
    _venda(conn, 1, [(caf, 1)], "2026-02-10")
    _venda(conn, 2, [(moe, 1)], "2026-02-10")
    r = relatorios.top_clientes(conn, 1, "2026-02-01", "2026-03-01")
    assert r[0][0] == 2


# ---- ETL

def test_importacao_csv(conn, tmp_path):
    arq = tmp_path / "catalogo.csv"
    arq.write_text(
        "sku;nome;categoria;preco;estoque\n"
        "CAF-001;Café 1kg (novo);mercearia;72,50;40\n"
        "XIC-030;Xícara;utilidades;1.234,5;3\n"
        ";Sem SKU;mercearia;1,00;1\n"
        "ERR-1;Preço ruim;mercearia;abc;1\n",
        encoding="utf-8",
    )
    rel = etl.importar_produtos_csv(conn, arq)
    assert (rel.inseridos, rel.atualizados) == (1, 1)
    assert [n for n, _ in rel.rejeitados] == [4, 5]
    assert estoque.saldo(conn, id_produto(conn, "CAF-001")) == 40
    assert conn.execute("SELECT preco_centavos FROM produtos WHERE sku='XIC-030'").fetchone()[0] == 123450


@pytest.mark.parametrize("texto,esperado", [("10", 1000), ("10,5", 1050), ("1.234,56", 123456), ("R$ 3,99", 399)])
def test_preco_br(texto, esperado):
    assert etl.preco_br_para_centavos(texto) == esperado
