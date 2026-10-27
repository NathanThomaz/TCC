import pytest

from loja import estoque, etl
from loja.exemplo import id_produto

CAB = "sku;nome;categoria;preco;estoque"


def _arq(tmp_path, texto, bom=False, crlf=False):
    if crlf:
        texto = texto.replace("\n", "\r\n")
    arq = tmp_path / "f.csv"
    arq.write_bytes((("﻿" if bom else "") + texto).encode("utf-8"))
    return arq


def test_bom_e_quebra_de_linha_windows(conn, tmp_path):
    arq = _arq(tmp_path, f"{CAB}\nXIC-030;Xícara;utilidades;19,90;12\nCAF-001;Café;mercearia;70,00;5\n",
               bom=True, crlf=True)
    rel = etl.importar_produtos_csv(conn, arq)
    assert (rel.inseridos, rel.atualizados, rel.rejeitados) == (1, 1, [])


def test_sku_duplicado_no_arquivo_rejeitado(conn, tmp_path):
    arq = _arq(tmp_path, f"{CAB}\nXIC-030;Xícara;utilidades;19,90;12\nXIC-030;Xícara 2;utilidades;25,00;3\n")
    rel = etl.importar_produtos_csv(conn, arq)
    assert rel.inseridos == 1
    assert len(rel.rejeitados) == 1 and rel.rejeitados[0][0] == 3 and "duplicado" in rel.rejeitados[0][1]
    assert estoque.saldo(conn, id_produto(conn, "XIC-030")) == 12


def test_cabecalho_com_espacos(conn, tmp_path):
    arq = _arq(tmp_path, " sku ; nome;categoria ;preco; estoque\nXIC-030;Xícara;utilidades;19,90;12\n")
    rel = etl.importar_produtos_csv(conn, arq)
    assert (rel.inseridos, rel.rejeitados) == (1, [])


def test_numero_da_linha_considera_linhas_vazias(conn, tmp_path):
    arq = _arq(tmp_path, f"{CAB}\nXIC-030;Xícara;utilidades;19,90;12\n\n\nERR-1;Ruim;mercearia;abc;1\n")
    rel = etl.importar_produtos_csv(conn, arq)
    assert [n for n, _ in rel.rejeitados] == [5]


def test_linhas_vazias_ignoradas(conn, tmp_path):
    arq = _arq(tmp_path, f"{CAB}\n\nXIC-030;Xícara;utilidades;19,90;12\n\n")
    rel = etl.importar_produtos_csv(conn, arq)
    assert (rel.inseridos, rel.rejeitados) == (1, [])


def test_cabecalho_invalido_nao_importa_nada(conn, tmp_path):
    arq = _arq(tmp_path, "sku;nome;preco\nXIC-030;Xícara;19,90\n")
    with pytest.raises(ValueError):
        etl.importar_produtos_csv(conn, arq)
    assert conn.execute("SELECT COUNT(*) FROM produtos WHERE sku = 'XIC-030'").fetchone()[0] == 0
