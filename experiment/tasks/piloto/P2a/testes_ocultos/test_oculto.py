from conftest import pid, venda
from loja import relatorios

FEV = ("2026-02-01", "2026-03-01")


def test_varios_itens_mesma_categoria_contam_um_pedido(conn):
    itens = [(pid(conn, s), 1) for s in ("CAF-001", "CHA-002", "FIL-021")]
    venda(conn, 2, itens, "2026-02-05")
    venda(conn, 3, [(pid(conn, "CAF-001"), 1)], "2026-02-06")
    (cat, _, n), = relatorios.vendas_por_categoria(conn, *FEV)
    assert (cat, n) == ("mercearia", 2)


def test_pedido_com_duas_categorias_conta_uma_vez_em_cada(conn):
    itens = [(pid(conn, s), 1) for s in ("CAF-001", "FIL-021", "CAN-010", "GAR-011")]
    venda(conn, 1, itens, "2026-02-07")
    r = {c: n for c, _, n in relatorios.vendas_por_categoria(conn, *FEV)}
    assert r == {"mercearia": 1, "utilidades": 1}


def test_receita_por_categoria(conn):
    venda(conn, 1, [(pid(conn, "CAF-001"), 2), (pid(conn, "MOE-020"), 1)], "2026-02-08")
    venda(conn, 2, [(pid(conn, "CHA-002"), 3)], "2026-02-09")
    r = {c: rec for c, rec, _ in relatorios.vendas_por_categoria(conn, *FEV)}
    assert r == {"mercearia": 2 * 6990 + 3 * 1890, "equipamentos": 24900}


def test_cancelados_e_pendentes_nao_contam(conn):
    venda(conn, 1, [(pid(conn, "CAN-010"), 1)], "2026-02-10", status="cancelado")
    venda(conn, 2, [(pid(conn, "CAN-010"), 1)], "2026-02-10", status="pendente")
    venda(conn, 3, [(pid(conn, "CAF-001"), 1)], "2026-02-10")
    assert relatorios.vendas_por_categoria(conn, *FEV) == [("mercearia", 6990, 1)]


def test_limites_do_periodo(conn):
    venda(conn, 1, [(pid(conn, "CAF-001"), 1)], "2026-02-01")
    venda(conn, 2, [(pid(conn, "CHA-002"), 1)], "2026-03-01")
    venda(conn, 3, [(pid(conn, "FIL-021"), 1)], "2026-01-31")
    assert relatorios.vendas_por_categoria(conn, *FEV) == [("mercearia", 6990, 1)]
