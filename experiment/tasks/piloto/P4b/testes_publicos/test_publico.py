import pytest

from loja import etl


def test_caso_relatado_ponto_decimal_rejeitado():
    with pytest.raises(ValueError):
        etl.preco_br_para_centavos("12.50")


def test_formatos_validos_do_enunciado():
    assert etl.preco_br_para_centavos("1.234,56") == 123456
