from conftest import pid, venda
from loja import relatorios

FEV = ("2026-02-01", "2026-03-01")


def test_produto_so_em_pedido_cancelado_aparece(conn):
    venda(conn, 1, [(pid(conn, "GAR-011"), 1)], "2026-02-03", status="cancelado")
    venda(conn, 2, [(pid(conn, "GAR-011"), 2)], "2026-02-04", status="cancelado")
    assert "GAR-011" in relatorios.produtos_sem_venda(conn, *FEV)


def test_produto_vendido_fora_do_periodo_aparece(conn):
    venda(conn, 1, [(pid(conn, "MOE-020"), 1)], "2026-01-20")
    venda(conn, 2, [(pid(conn, "MOE-020"), 1)], "2026-03-01")
    assert "MOE-020" in relatorios.produtos_sem_venda(conn, *FEV)


def test_produto_so_em_pedido_pendente_aparece(conn):
    venda(conn, 1, [(pid(conn, "CAN-010"), 1)], "2026-02-12", status="pendente")
    assert "CAN-010" in relatorios.produtos_sem_venda(conn, *FEV)


def test_produto_vendido_no_periodo_nao_aparece(conn):
    venda(conn, 1, [(pid(conn, "CAF-001"), 1), (pid(conn, "FIL-021"), 2)], "2026-02-28")
    r = relatorios.produtos_sem_venda(conn, *FEV)
    assert "CAF-001" not in r and "FIL-021" not in r
    assert r == sorted(r)


def test_produto_inativo_nao_aparece(conn):
    conn.execute("UPDATE produtos SET ativo = 0 WHERE sku = 'CHA-002'")
    assert "CHA-002" not in relatorios.produtos_sem_venda(conn, *FEV)
