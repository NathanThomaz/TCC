from loja import estoque


def test_exemplo_minimo_padrao(conn):
    assert estoque.produtos_abaixo_do_minimo(conn, 20) == [("MOE-020", 8, 20), ("GAR-011", 15, 20)]
