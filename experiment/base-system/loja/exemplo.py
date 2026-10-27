"""Dados de exemplo para desenvolvimento local e testes (fictícios)."""

from __future__ import annotations

import sqlite3

PRODUTOS = [
    # (sku, nome, categoria, preco_centavos, estoque)
    ("CAF-001", "Café em grãos 1kg", "mercearia", 6990, 50),
    ("CHA-002", "Chá verde 100g", "mercearia", 1890, 80),
    ("CAN-010", "Caneca de cerâmica", "utilidades", 3500, 30),
    ("GAR-011", "Garrafa térmica 1L", "utilidades", 12900, 15),
    ("MOE-020", "Moedor manual", "equipamentos", 24900, 8),
    ("FIL-021", "Filtro de papel 103 (100un)", "mercearia", 990, 200),
]

CLIENTES = [
    ("Ana Souza", "ana@example.com", "Belo Horizonte"),
    ("Bruno Lima", "bruno@example.com", "Contagem"),
    ("Carla Dias", "carla@example.com", "Betim"),
]


def popular(conn: sqlite3.Connection, criado_em: str = "2026-01-01") -> None:
    with conn:
        for sku, nome, cat, preco, qtd in PRODUTOS:
            cur = conn.execute(
                "INSERT INTO produtos (sku, nome, categoria, preco_centavos) VALUES (?, ?, ?, ?)",
                (sku, nome, cat, preco),
            )
            conn.execute("INSERT INTO estoque (produto_id, quantidade) VALUES (?, ?)", (cur.lastrowid, qtd))
        for nome, email, cidade in CLIENTES:
            conn.execute(
                "INSERT INTO clientes (nome, email, cidade, criado_em) VALUES (?, ?, ?, ?)",
                (nome, email, cidade, criado_em),
            )
        conn.execute(
            "INSERT INTO cupons (codigo, percentual, valido_ate, minimo_centavos) VALUES (?, ?, ?, ?)",
            ("BEMVINDO10", 10, "2026-12-31", 10000),
        )


def id_produto(conn: sqlite3.Connection, sku: str) -> int:
    return conn.execute("SELECT id FROM produtos WHERE sku = ?", (sku,)).fetchone()["id"]
