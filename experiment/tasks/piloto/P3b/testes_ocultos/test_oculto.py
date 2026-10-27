import pytest

from conftest import pid, venda
from loja import pedidos


def test_cancelados_e_pendentes_nao_contam(conn):
    venda(conn, 2, [(pid(conn, "MOE-020"), 3)], "2026-02-20", status="cancelado")
    venda(conn, 2, [(pid(conn, "GAR-011"), 2)], "2026-02-21", status="pendente")
    venda(conn, 2, [(pid(conn, "CHA-002"), 1)], "2026-02-01")
    r = pedidos.resumo_cliente(conn, 2)
    assert r == {"n_pedidos": 1, "total_gasto_centavos": 4390, "ticket_medio_centavos": 4390,
                 "ultimo_pedido": "2026-02-01", "produto_favorito": "CHA-002"}


def test_produto_favorito_por_unidades_com_desempate(conn):
    venda(conn, 1, [(pid(conn, "FIL-021"), 3), (pid(conn, "CAN-010"), 1)], "2026-02-01")
    venda(conn, 1, [(pid(conn, "CAN-010"), 2)], "2026-02-02")
    assert pedidos.resumo_cliente(conn, 1)["produto_favorito"] == "CAN-010"  # 3 × 3: menor SKU


def test_ticket_medio_arredonda_meio_para_cima(conn):
    for total in (1001, 1000):
        conn.execute(
            "INSERT INTO pedidos (cliente_id, criado_em, status, subtotal_centavos, desconto_centavos, "
            "frete_centavos, total_centavos) VALUES (3, '2026-02-01', 'entregue', ?, 0, 0, ?)", (total, total))
    assert pedidos.resumo_cliente(conn, 3)["ticket_medio_centavos"] == 1001


def test_cliente_sem_vendas(conn):
    venda(conn, 3, [(pid(conn, "CAF-001"), 1)], "2026-02-01", status="cancelado")
    assert pedidos.resumo_cliente(conn, 3) == {"n_pedidos": 0, "total_gasto_centavos": 0,
                                               "ticket_medio_centavos": 0, "ultimo_pedido": None,
                                               "produto_favorito": None}


def test_ultimo_pedido_considera_apenas_vendas(conn):
    venda(conn, 1, [(pid(conn, "CAF-001"), 1)], "2026-02-10")
    venda(conn, 1, [(pid(conn, "CAF-001"), 1)], "2026-02-25", status="cancelado")
    assert pedidos.resumo_cliente(conn, 1)["ultimo_pedido"] == "2026-02-10"


def test_cliente_inexistente(conn):
    with pytest.raises(pedidos.ErroPedido):
        pedidos.resumo_cliente(conn, 999)
