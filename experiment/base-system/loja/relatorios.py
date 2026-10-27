"""Relatórios gerenciais em SQL.

Convenções comuns:
- Período: `inicio` inclusivo e `fim` exclusivo, datas ISO (AAAA-MM-DD).
- Vendas consideradas: pedidos com status 'pago', 'enviado' ou 'entregue'.
  Pedidos 'pendente' e 'cancelado' não contam como venda.
"""

from __future__ import annotations

import sqlite3

STATUS_VENDA = ("pago", "enviado", "entregue")
_IN_STATUS = "('pago', 'enviado', 'entregue')"


def vendas_por_categoria(conn: sqlite3.Connection, inicio: str, fim: str) -> list[tuple[str, int, int]]:
    """(categoria, receita em centavos dos itens, nº de pedidos distintos), por receita decrescente.

    A receita usa quantidade × preço unitário registrado no pedido (sem descontos e sem frete).
    """
    sql = f"""
        SELECT pr.categoria AS categoria,
               SUM(i.quantidade * i.preco_unit_centavos) AS receita,
               COUNT(DISTINCT p.id) AS n_pedidos
        FROM pedidos p
        JOIN itens_pedido i ON i.pedido_id = p.id
        JOIN produtos pr ON pr.id = i.produto_id
        WHERE p.status IN {_IN_STATUS}
          AND p.criado_em >= ? AND p.criado_em < ?
        GROUP BY pr.categoria
        ORDER BY receita DESC, categoria ASC
    """
    return [(r["categoria"], r["receita"], r["n_pedidos"]) for r in conn.execute(sql, (inicio, fim))]


def top_clientes(conn: sqlite3.Connection, n: int, inicio: str, fim: str) -> list[tuple[int, str, int, int]]:
    """(cliente_id, nome, total gasto em centavos, nº de pedidos) dos n clientes que mais gastaram."""
    sql = f"""
        SELECT c.id AS id, c.nome AS nome, SUM(p.total_centavos) AS gasto, COUNT(*) AS n_pedidos
        FROM clientes c
        JOIN pedidos p ON p.cliente_id = c.id
        WHERE p.status IN {_IN_STATUS}
          AND p.criado_em >= ? AND p.criado_em < ?
        GROUP BY c.id, c.nome
        ORDER BY gasto DESC, nome ASC
        LIMIT ?
    """
    return [(r["id"], r["nome"], r["gasto"], r["n_pedidos"]) for r in conn.execute(sql, (inicio, fim, n))]


def produtos_sem_venda(conn: sqlite3.Connection, inicio: str, fim: str) -> list[str]:
    """SKUs dos produtos ATIVOS sem nenhuma unidade vendida no período, em ordem alfabética."""
    sql = f"""
        SELECT pr.sku AS sku
        FROM produtos pr
        WHERE pr.ativo = 1
          AND NOT EXISTS (
              SELECT 1
              FROM itens_pedido i
              JOIN pedidos p ON p.id = i.pedido_id
              WHERE i.produto_id = pr.id
                AND p.status IN {_IN_STATUS}
                AND p.criado_em >= ? AND p.criado_em < ?
          )
        ORDER BY pr.sku
    """
    return [r["sku"] for r in conn.execute(sql, (inicio, fim))]
