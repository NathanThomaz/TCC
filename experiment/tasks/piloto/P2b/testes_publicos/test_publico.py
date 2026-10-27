from conftest import pid, venda
from loja import relatorios


def test_caso_relatado_lista_produto_com_pedido_cancelado(conn):
    venda(conn, 1, [(pid(conn, "CHA-002"), 1)], "2026-02-10", status="cancelado")
    assert "CHA-002" in relatorios.produtos_sem_venda(conn, "2026-02-01", "2026-03-01")
