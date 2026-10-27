import pytest

from conftest import pid
from loja import estoque, pedidos


def test_cancelamento_varios_itens_quantidades_diferentes(conn):
    ids = {s: pid(conn, s) for s in ("CAF-001", "FIL-021", "CAN-010")}
    antes = {s: estoque.saldo(conn, i) for s, i in ids.items()}
    p = pedidos.criar_pedido(conn, 2, [(ids["CAF-001"], 2), (ids["FIL-021"], 12), (ids["CAN-010"], 1)])
    pedidos.cancelar_pedido(conn, p)
    assert {s: estoque.saldo(conn, i) for s, i in ids.items()} == antes


def test_cancelamento_por_alterar_status(conn):
    fil = pid(conn, "FIL-021")
    p = pedidos.criar_pedido(conn, 1, [(fil, 20)])
    pedidos.alterar_status(conn, p, "cancelado")
    assert estoque.saldo(conn, fil) == 200


def test_cancelamento_de_pedido_pago(conn):
    gar = pid(conn, "GAR-011")
    p = pedidos.criar_pedido(conn, 3, [(gar, 4)])
    pedidos.alterar_status(conn, p, "pago")
    pedidos.cancelar_pedido(conn, p)
    assert estoque.saldo(conn, gar) == 15


def test_nao_cancela_duas_vezes_nem_devolve_em_dobro(conn):
    caf = pid(conn, "CAF-001")
    p = pedidos.criar_pedido(conn, 1, [(caf, 1)])
    pedidos.cancelar_pedido(conn, p)
    with pytest.raises(pedidos.ErroPedido):
        pedidos.cancelar_pedido(conn, p)
    assert estoque.saldo(conn, caf) == 50


def test_cancelamento_quantidade_unitaria(conn):
    moe = pid(conn, "MOE-020")
    p = pedidos.criar_pedido(conn, 1, [(moe, 1)])
    pedidos.cancelar_pedido(conn, p)
    assert estoque.saldo(conn, moe) == 8
