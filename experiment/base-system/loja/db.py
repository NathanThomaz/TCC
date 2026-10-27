"""Esquema do banco SQLite e abertura de conexões."""

from __future__ import annotations

import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS clientes (
    id          INTEGER PRIMARY KEY,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    cidade      TEXT,
    criado_em   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS produtos (
    id              INTEGER PRIMARY KEY,
    sku             TEXT NOT NULL UNIQUE,
    nome            TEXT NOT NULL,
    categoria       TEXT NOT NULL,
    preco_centavos  INTEGER NOT NULL CHECK (preco_centavos >= 0),
    ativo           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS estoque (
    produto_id  INTEGER PRIMARY KEY REFERENCES produtos(id),
    quantidade  INTEGER NOT NULL CHECK (quantidade >= 0)
);

CREATE TABLE IF NOT EXISTS cupons (
    codigo           TEXT PRIMARY KEY,
    percentual       INTEGER NOT NULL CHECK (percentual BETWEEN 1 AND 100),
    valido_ate       TEXT NOT NULL,              -- data ISO (AAAA-MM-DD), inclusiva
    minimo_centavos  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pedidos (
    id                 INTEGER PRIMARY KEY,
    cliente_id         INTEGER NOT NULL REFERENCES clientes(id),
    criado_em          TEXT NOT NULL,            -- data ISO (AAAA-MM-DD)
    status             TEXT NOT NULL,
    cupom              TEXT REFERENCES cupons(codigo),
    subtotal_centavos  INTEGER NOT NULL,
    desconto_centavos  INTEGER NOT NULL,
    frete_centavos     INTEGER NOT NULL,
    total_centavos     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS itens_pedido (
    pedido_id            INTEGER NOT NULL REFERENCES pedidos(id),
    produto_id           INTEGER NOT NULL REFERENCES produtos(id),
    quantidade           INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unit_centavos  INTEGER NOT NULL,
    PRIMARY KEY (pedido_id, produto_id)
);
"""


def conectar(caminho: str = ":memory:") -> sqlite3.Connection:
    conn = sqlite3.connect(caminho)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn
