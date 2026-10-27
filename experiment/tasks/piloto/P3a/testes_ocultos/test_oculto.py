import pytest

from loja import estoque


def test_minimo_por_categoria_sobrepoe_padrao(conn):
    r = estoque.produtos_abaixo_do_minimo(conn, 10, {"mercearia": 60})
    assert r == [("CAF-001", 50, 60), ("MOE-020", 8, 10)]


def test_produto_sem_registro_de_estoque_tem_saldo_zero(conn):
    conn.execute("INSERT INTO produtos (sku, nome, categoria, preco_centavos) VALUES ('NOV-099', 'Novo', 'utilidades', 100)")
    r = estoque.produtos_abaixo_do_minimo(conn, 5)
    assert ("NOV-099", 0, 5) in r


def test_produtos_inativos_ignorados(conn):
    conn.execute("UPDATE produtos SET ativo = 0 WHERE sku = 'MOE-020'")
    assert estoque.produtos_abaixo_do_minimo(conn, 20) == [("GAR-011", 15, 20)]


def test_minimo_negativo_rejeitado(conn):
    with pytest.raises(ValueError):
        estoque.produtos_abaixo_do_minimo(conn, -1)
    with pytest.raises(ValueError):
        estoque.produtos_abaixo_do_minimo(conn, 5, {"utilidades": -2})


def test_empate_de_deficit_ordena_por_sku(conn):
    conn.execute("UPDATE estoque SET quantidade = 10 WHERE produto_id IN (SELECT id FROM produtos WHERE sku IN ('CAN-010', 'GAR-011'))")
    r = estoque.produtos_abaixo_do_minimo(conn, 20)
    assert [s for s, _, _ in r] == ["MOE-020", "CAN-010", "GAR-011"]


def test_saldo_igual_ao_minimo_nao_entra(conn):
    assert estoque.produtos_abaixo_do_minimo(conn, 15) == [("MOE-020", 8, 15)]
