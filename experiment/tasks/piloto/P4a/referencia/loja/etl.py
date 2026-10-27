"""Importação de catálogo de produtos a partir de CSV de fornecedor.

Formato: separador ';', codificação UTF-8, cabeçalho obrigatório
    sku;nome;categoria;preco;estoque
Preço no formato brasileiro ("1.234,56"). Linhas inválidas são rejeitadas
individualmente (com número da linha e motivo) sem interromper a importação.
Produtos existentes (mesmo SKU) são atualizados, e o estoque é substituído pelo valor do arquivo.
"""

from __future__ import annotations

import csv
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

from loja import estoque

COLUNAS = ("sku", "nome", "categoria", "preco", "estoque")


@dataclass
class RelatorioImportacao:
    inseridos: int = 0
    atualizados: int = 0
    rejeitados: list[tuple[int, str]] = field(default_factory=list)


def preco_br_para_centavos(texto: str) -> int:
    t = texto.strip().replace("R$", "").strip()
    if not t:
        raise ValueError("preço vazio")
    if t.count(",") > 1:
        raise ValueError(f"preço inválido: {texto!r}")
    inteiro, _, frac = t.partition(",")
    inteiro = inteiro.replace(".", "")
    if not inteiro.isdigit() or (frac and (not frac.isdigit() or len(frac) > 2)):
        raise ValueError(f"preço inválido: {texto!r}")
    return int(inteiro) * 100 + int(frac.ljust(2, "0") or 0)


def _validar(linha: dict) -> tuple[str, str, str, int, int]:
    sku = (linha.get("sku") or "").strip()
    nome = (linha.get("nome") or "").strip()
    categoria = (linha.get("categoria") or "").strip()
    if not sku:
        raise ValueError("sku vazio")
    if not nome:
        raise ValueError("nome vazio")
    if not categoria:
        raise ValueError("categoria vazia")
    preco = preco_br_para_centavos(linha.get("preco") or "")
    qtd_txt = (linha.get("estoque") or "").strip()
    if not qtd_txt.isdigit():
        raise ValueError(f"estoque inválido: {qtd_txt!r}")
    return sku, nome, categoria, preco, int(qtd_txt)


def importar_produtos_csv(conn: sqlite3.Connection, caminho: Path) -> RelatorioImportacao:
    rel = RelatorioImportacao()
    with open(caminho, encoding="utf-8-sig", newline="") as f:  # utf-8-sig remove o BOM do Excel
        leitor = csv.DictReader(f, delimiter=";")
        nomes = [c.strip() for c in (leitor.fieldnames or ())]
        if tuple(nomes) != COLUNAS:
            raise ValueError(f"Cabeçalho inválido; esperado {';'.join(COLUNAS)}")
        leitor.fieldnames = nomes
        vistos: set[str] = set()
        with conn:
            for linha in leitor:
                numero = leitor.line_num  # linha física, contando as linhas vazias puladas
                try:
                    sku, nome, categoria, preco, qtd = _validar(linha)
                except ValueError as e:
                    rel.rejeitados.append((numero, str(e)))
                    continue
                if sku in vistos:
                    rel.rejeitados.append((numero, f"sku duplicado no arquivo: {sku}"))
                    continue
                vistos.add(sku)
                existente = conn.execute("SELECT id FROM produtos WHERE sku = ?", (sku,)).fetchone()
                if existente:
                    conn.execute(
                        "UPDATE produtos SET nome = ?, categoria = ?, preco_centavos = ? WHERE id = ?",
                        (nome, categoria, preco, existente["id"]),
                    )
                    produto_id = existente["id"]
                    rel.atualizados += 1
                else:
                    cur = conn.execute(
                        "INSERT INTO produtos (sku, nome, categoria, preco_centavos) VALUES (?, ?, ?, ?)",
                        (sku, nome, categoria, preco),
                    )
                    produto_id = cur.lastrowid
                    rel.inseridos += 1
                estoque.definir(conn, produto_id, qtd)
    return rel
