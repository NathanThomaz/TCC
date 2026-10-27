"""Importação de catálogo de produtos a partir de CSV de fornecedor.

Formato: separador ';', codificação UTF-8, cabeçalho obrigatório
    sku;nome;categoria;preco;estoque
Preço no formato brasileiro ("1.234,56"). Linhas inválidas são rejeitadas
individualmente (com número da linha e motivo) sem interromper a importação.
Produtos existentes (mesmo SKU) são atualizados, e o estoque é substituído pelo valor do arquivo.
"""

from __future__ import annotations

import csv
import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

from loja import estoque

COLUNAS = ("sku", "nome", "categoria", "preco", "estoque")
# milhar com "." em grupos de 3 dígitos (opcional); decimal com "," e 1-2 dígitos (opcional)
_PRECO_BR = re.compile(r"(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?")


@dataclass
class RelatorioImportacao:
    inseridos: int = 0
    atualizados: int = 0
    rejeitados: list[tuple[int, str]] = field(default_factory=list)


def preco_br_para_centavos(texto: str) -> int:
    t = texto.strip()
    m = _PRECO_BR.fullmatch(t)
    if not m:
        raise ValueError(f"preço inválido: {texto!r}")
    inteiro, frac = m.group(1).replace(".", ""), m.group(2) or ""
    return int(inteiro) * 100 + int(frac.ljust(2, "0"))


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
    with open(caminho, encoding="utf-8", newline="") as f:
        leitor = csv.DictReader(f, delimiter=";")
        if tuple(c.strip() for c in (leitor.fieldnames or ())) != COLUNAS:
            raise ValueError(f"Cabeçalho inválido; esperado {';'.join(COLUNAS)}")
        with conn:
            for numero, linha in enumerate(leitor, start=2):
                try:
                    sku, nome, categoria, preco, qtd = _validar(linha)
                except ValueError as e:
                    rel.rejeitados.append((numero, str(e)))
                    continue
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
