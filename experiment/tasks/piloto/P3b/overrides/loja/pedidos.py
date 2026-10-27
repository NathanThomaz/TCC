"""Ciclo de vida dos pedidos: criação, mudança de status e cancelamento."""

from __future__ import annotations

import sqlite3
from datetime import date

from loja import estoque
from loja.precos import Cupom, Item, calcular_totais

TRANSICOES = {
    "pendente": {"pago", "cancelado"},
    "pago": {"enviado", "cancelado"},
    "enviado": {"entregue"},
    "entregue": set(),
    "cancelado": set(),
}


class ErroPedido(Exception):
    pass


def _carregar_cupom(conn: sqlite3.Connection, codigo: str | None) -> Cupom | None:
    if codigo is None:
        return None
    row = conn.execute("SELECT * FROM cupons WHERE codigo = ?", (codigo,)).fetchone()
    if row is None:
        raise ErroPedido(f"Cupom inexistente: {codigo}")
    return Cupom(row["codigo"], row["percentual"], date.fromisoformat(row["valido_ate"]), row["minimo_centavos"])


def criar_pedido(
    conn: sqlite3.Connection,
    cliente_id: int,
    itens: list[tuple[int, int]],
    cupom: str | None = None,
    data: date | None = None,
) -> int:
    """Cria um pedido pendente e baixa o estoque. `itens` é uma lista de (produto_id, quantidade)."""
    data = data or date.today()
    if not itens:
        raise ErroPedido("Pedido sem itens")
    ids = [p for p, _ in itens]
    if len(ids) != len(set(ids)):
        raise ErroPedido("Produto repetido no pedido")
    with conn:
        linhas = []
        for produto_id, quantidade in itens:
            if quantidade <= 0:
                raise ErroPedido(f"Quantidade inválida para o produto {produto_id}")
            prod = conn.execute("SELECT preco_centavos, ativo FROM produtos WHERE id = ?", (produto_id,)).fetchone()
            if prod is None or not prod["ativo"]:
                raise ErroPedido(f"Produto indisponível: {produto_id}")
            linhas.append(Item(produto_id, quantidade, prod["preco_centavos"]))
        cup = _carregar_cupom(conn, cupom)
        totais = calcular_totais(linhas, cup, data)
        for item in linhas:
            estoque.baixar(conn, item.produto_id, item.quantidade)
        cur = conn.execute(
            "INSERT INTO pedidos (cliente_id, criado_em, status, cupom, subtotal_centavos, "
            "desconto_centavos, frete_centavos, total_centavos) VALUES (?, ?, 'pendente', ?, ?, ?, ?, ?)",
            (cliente_id, data.isoformat(), cupom if totais.desconto_centavos else None,
             totais.subtotal_centavos, totais.desconto_centavos, totais.frete_centavos, totais.total_centavos),
        )
        pedido_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unit_centavos) VALUES (?, ?, ?, ?)",
            [(pedido_id, i.produto_id, i.quantidade, i.preco_unit_centavos) for i in linhas],
        )
    return pedido_id


def status(conn: sqlite3.Connection, pedido_id: int) -> str:
    row = conn.execute("SELECT status FROM pedidos WHERE id = ?", (pedido_id,)).fetchone()
    if row is None:
        raise ErroPedido(f"Pedido inexistente: {pedido_id}")
    return row["status"]


def alterar_status(conn: sqlite3.Connection, pedido_id: int, novo: str) -> None:
    atual = status(conn, pedido_id)
    if novo not in TRANSICOES[atual]:
        raise ErroPedido(f"Transição inválida: {atual} -> {novo}")
    if novo == "cancelado":
        cancelar_pedido(conn, pedido_id)
        return
    with conn:
        conn.execute("UPDATE pedidos SET status = ? WHERE id = ?", (novo, pedido_id))


def cancelar_pedido(conn: sqlite3.Connection, pedido_id: int) -> None:
    """Cancela o pedido e devolve ao estoque as quantidades de todos os itens."""
    atual = status(conn, pedido_id)
    if "cancelado" not in TRANSICOES[atual]:
        raise ErroPedido(f"Pedido {pedido_id} não pode ser cancelado no status '{atual}'")
    with conn:
        itens = conn.execute(
            "SELECT produto_id, quantidade FROM itens_pedido WHERE pedido_id = ?", (pedido_id,)
        ).fetchall()
        for item in itens:
            estoque.repor(conn, item["produto_id"], item["quantidade"])
        conn.execute("UPDATE pedidos SET status = 'cancelado' WHERE id = ?", (pedido_id,))


def resumo_cliente(conn: sqlite3.Connection, cliente_id: int) -> dict:
    """Resumo de compras do cliente. Regras no ENUNCIADO.md."""
    raise NotImplementedError
