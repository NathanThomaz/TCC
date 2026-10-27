from conftest import pid
from loja import estoque, pedidos


def test_caso_relatado_restaura_estoque(conn):
    caf = pid(conn, "CAF-001")
    p = pedidos.criar_pedido(conn, 1, [(caf, 3)])
    assert estoque.saldo(conn, caf) == 47
    pedidos.cancelar_pedido(conn, p)
    assert estoque.saldo(conn, caf) == 50
