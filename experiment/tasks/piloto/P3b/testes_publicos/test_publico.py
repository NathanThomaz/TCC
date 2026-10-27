from conftest import pid, venda
from loja import pedidos


def test_exemplo_dois_pedidos_pagos(conn):
    venda(conn, 1, [(pid(conn, "CAF-001"), 1)], "2026-02-01")     # 6990 + 2500 de frete
    venda(conn, 1, [(pid(conn, "CHA-002"), 2)], "2026-02-15")     # 3780 + 2500 de frete
    r = pedidos.resumo_cliente(conn, 1)
    assert r["n_pedidos"] == 2
    assert r["total_gasto_centavos"] == 9490 + 6280
    assert r["ultimo_pedido"] == "2026-02-15"
