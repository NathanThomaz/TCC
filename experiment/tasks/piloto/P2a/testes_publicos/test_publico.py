from conftest import pid, venda
from loja import relatorios


def test_caso_relatado_um_pedido_em_mercearia(conn):
    venda(conn, 1, [(pid(conn, "CAF-001"), 1), (pid(conn, "CHA-002"), 1)], "2026-02-10")
    r = relatorios.vendas_por_categoria(conn, "2026-02-01", "2026-03-01")
    assert r == [("mercearia", 6990 + 1890, 1)]
