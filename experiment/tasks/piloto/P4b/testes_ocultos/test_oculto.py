import pytest

from loja import etl


def test_agrupamento_de_milhar_invalido_rejeitado():
    for texto in ("1.23,45", "12.3456,00", "1.2345", "1..234"):
        with pytest.raises(ValueError):
            etl.preco_br_para_centavos(texto)


def test_ponto_decimal_rejeitado_na_importacao(conn, tmp_path):
    arq = tmp_path / "f.csv"
    arq.write_text("sku;nome;categoria;preco;estoque\n"
                   "XIC-030;Xícara;utilidades;19,90;12\n"
                   "PRA-031;Prato;utilidades;9.90;4\n", encoding="utf-8")
    rel = etl.importar_produtos_csv(conn, arq)
    assert rel.inseridos == 1 and [n for n, _ in rel.rejeitados] == [3]


def test_milhar_valido_aceito():
    assert etl.preco_br_para_centavos("1.234.567,89") == 123456789
    assert etl.preco_br_para_centavos("1.000") == 100000


def test_negativo_e_vazio_rejeitados():
    for texto in ("-1,00", "", "   ", "R$"):
        with pytest.raises(ValueError):
            etl.preco_br_para_centavos(texto)


def test_sem_separador_de_milhar_aceito():
    assert etl.preco_br_para_centavos("1234,5") == 123450


def test_espacos_e_prefixo_aceitos():
    assert etl.preco_br_para_centavos("  R$ 3,99 ") == 399
