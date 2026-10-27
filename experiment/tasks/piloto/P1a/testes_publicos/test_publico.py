from datetime import date

from loja import precos
from loja.precos import Cupom, Item


def test_caso_relatado_cobra_frete():
    cupom = Cupom("DEZ", 10, date(2026, 12, 31))
    t = precos.calcular_totais([Item(1, 1, 32000)], cupom, date(2026, 3, 1))
    assert t.desconto_centavos == 3200
    assert t.frete_centavos == 2500
    assert t.total_centavos == 28800 + 2500
