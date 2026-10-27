from loja import etl


def test_caso_relatado_arquivo_com_bom(conn, tmp_path):
    arq = tmp_path / "excel.csv"
    arq.write_bytes("﻿sku;nome;categoria;preco;estoque\nXIC-030;Xícara;utilidades;19,90;12\n".encode("utf-8"))
    rel = etl.importar_produtos_csv(conn, arq)
    assert (rel.inseridos, rel.rejeitados) == (1, [])
