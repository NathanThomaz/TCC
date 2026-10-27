from datetime import date

from conftest import pid
from loja import pedidos, precos
from loja.precos import Cupom, Item

HOJE = date(2026, 3, 1)


def test_frete_cobrado_quando_cupom_reduz_abaixo_do_limite():
    t = precos.calcular_totais([Item(1, 1, 31000)], Cupom("C5", 5, date(2026, 12, 31)), HOJE)
    assert (t.desconto_centavos, t.frete_centavos) == (1550, 2500)


def test_total_persistido_inclui_frete_quando_cupom_reduz(conn):
    itens = [(pid(conn, "MOE-020"), 1), (pid(conn, "CAN-010"), 1), (pid(conn, "CHA-002"), 1)]
    p = pedidos.criar_pedido(conn, 1, itens, cupom="BEMVINDO10", data=date(2026, 2, 1))
    row = conn.execute("SELECT * FROM pedidos WHERE id = ?", (p,)).fetchone()
    assert row["subtotal_centavos"] == 30290
    assert row["desconto_centavos"] == 3029
    assert row["frete_centavos"] == 2500
    assert row["total_centavos"] == 30290 - 3029 + 2500


def test_frete_gratis_exatamente_no_limite_apos_cupom():
    t = precos.calcular_totais([Item(1, 1, 40000)], Cupom("C25", 25, date(2026, 12, 31)), HOJE)
    assert t.total_centavos == 30000
    assert t.frete_centavos == 0


def test_cupom_expirado_nao_altera_regra_de_frete():
    t = precos.calcular_totais([Item(1, 1, 32000)], Cupom("OLD", 10, date(2026, 1, 31)), HOJE)
    assert (t.desconto_centavos, t.frete_centavos, t.total_centavos) == (0, 0, 32000)


def test_frete_gratis_sem_cupom_no_limite():
    t = precos.calcular_totais([Item(1, 3, 10000)], None, HOJE)
    assert t.frete_centavos == 0
