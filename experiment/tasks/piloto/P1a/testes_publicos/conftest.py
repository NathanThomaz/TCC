# Fonte única do conftest das tarefas-piloto. scripts/sincronizar_conftest.py copia este
# arquivo para testes_publicos/ e testes_ocultos/ de cada tarefa (pytest exige o conftest
# no diretório dos testes).
from datetime import date

import pytest

from loja import db, exemplo, pedidos


@pytest.fixture
def conn():
    c = db.conectar()
    exemplo.popular(c)
    yield c
    c.close()


def pid(conn, sku):
    return exemplo.id_produto(conn, sku)


def venda(conn, cliente, itens, data, status="pago"):
    """Cria um pedido e o leva ao status indicado ('pendente', 'pago' ou 'cancelado')."""
    p = pedidos.criar_pedido(conn, cliente, itens, data=date.fromisoformat(data))
    if status == "pago":
        pedidos.alterar_status(conn, p, "pago")
    elif status == "cancelado":
        pedidos.cancelar_pedido(conn, p)
    return p
