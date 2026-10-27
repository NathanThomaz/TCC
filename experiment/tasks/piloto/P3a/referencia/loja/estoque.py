"""Controle de estoque por produto."""

from __future__ import annotations

import sqlite3


class EstoqueInsuficiente(Exception):
    def __init__(self, produto_id: int, solicitado: int, disponivel: int):
        super().__init__(f"Produto {produto_id}: solicitado {solicitado}, disponível {disponivel}")
        self.produto_id = produto_id
        self.solicitado = solicitado
        self.disponivel = disponivel


def saldo(conn: sqlite3.Connection, produto_id: int) -> int:
    row = conn.execute("SELECT quantidade FROM estoque WHERE produto_id = ?", (produto_id,)).fetchone()
    return row["quantidade"] if row else 0


def repor(conn: sqlite3.Connection, produto_id: int, quantidade: int) -> int:
    if quantidade <= 0:
        raise ValueError("quantidade de reposição deve ser positiva")
    conn.execute(
        "INSERT INTO estoque (produto_id, quantidade) VALUES (?, ?) "
        "ON CONFLICT(produto_id) DO UPDATE SET quantidade = quantidade + excluded.quantidade",
        (produto_id, quantidade),
    )
    return saldo(conn, produto_id)


def definir(conn: sqlite3.Connection, produto_id: int, quantidade: int) -> None:
    if quantidade < 0:
        raise ValueError("estoque não pode ser negativo")
    conn.execute(
        "INSERT INTO estoque (produto_id, quantidade) VALUES (?, ?) "
        "ON CONFLICT(produto_id) DO UPDATE SET quantidade = excluded.quantidade",
        (produto_id, quantidade),
    )


def baixar(conn: sqlite3.Connection, produto_id: int, quantidade: int) -> int:
    if quantidade <= 0:
        raise ValueError("quantidade de baixa deve ser positiva")
    disponivel = saldo(conn, produto_id)
    if disponivel < quantidade:
        raise EstoqueInsuficiente(produto_id, quantidade, disponivel)
    conn.execute("UPDATE estoque SET quantidade = quantidade - ? WHERE produto_id = ?", (quantidade, produto_id))
    return disponivel - quantidade


def produtos_abaixo_do_minimo(
    conn: sqlite3.Connection, minimo_padrao: int, minimos_por_categoria: dict[str, int] | None = None
) -> list[tuple[str, int, int]]:
    """(sku, saldo, mínimo) dos produtos ativos com saldo abaixo do mínimo. Regras no ENUNCIADO.md."""
    minimos = minimos_por_categoria or {}
    if minimo_padrao < 0 or any(v < 0 for v in minimos.values()):
        raise ValueError("mínimo não pode ser negativo")
    linhas = conn.execute(
        "SELECT p.sku, p.categoria, COALESCE(e.quantidade, 0) AS saldo "
        "FROM produtos p LEFT JOIN estoque e ON e.produto_id = p.id WHERE p.ativo = 1"
    ).fetchall()
    resultado = []
    for r in linhas:
        minimo = minimos.get(r["categoria"], minimo_padrao)
        if r["saldo"] < minimo:
            resultado.append((r["sku"], r["saldo"], minimo))
    resultado.sort(key=lambda t: (-(t[2] - t[1]), t[0]))
    return resultado
