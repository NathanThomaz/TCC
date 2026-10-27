"""Regras de preço: desconto por quantidade, cupom e frete.

Regras de negócio:
- Desconto por quantidade, por item: 5% a partir de 5 unidades e 10% a partir de 10 unidades.
- Cupom: percentual sobre o subtotal (já com os descontos por quantidade). Vale até a data
  `valido_ate`, inclusive, e só quando o subtotal atinge `minimo_centavos`.
- Frete: R$ 25,00. É grátis quando o valor após o cupom é de pelo menos R$ 300,00.
  Pedido sem itens não tem frete.
- Arredondamento: metade para cima, em centavos.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

FRETE_PADRAO_CENTAVOS = 2500
FRETE_GRATIS_A_PARTIR_CENTAVOS = 30000
DESCONTO_POR_QUANTIDADE = ((10, 10), (5, 5))  # (quantidade mínima, percentual), do maior para o menor


@dataclass(frozen=True)
class Item:
    produto_id: int
    quantidade: int
    preco_unit_centavos: int


@dataclass(frozen=True)
class Cupom:
    codigo: str
    percentual: int
    valido_ate: date
    minimo_centavos: int = 0


@dataclass(frozen=True)
class Totais:
    subtotal_centavos: int
    desconto_centavos: int
    frete_centavos: int
    total_centavos: int


def arredondar(valor: Decimal) -> int:
    return int(valor.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def percentual_por_quantidade(quantidade: int) -> int:
    for minimo, pct in DESCONTO_POR_QUANTIDADE:
        if quantidade >= minimo:
            return pct
    return 0


def preco_item(item: Item) -> int:
    if item.quantidade <= 0:
        raise ValueError("quantidade deve ser positiva")
    bruto = item.quantidade * item.preco_unit_centavos
    desconto = arredondar(Decimal(bruto) * percentual_por_quantidade(item.quantidade) / 100)
    return bruto - desconto


def subtotal(itens: list[Item]) -> int:
    return sum(preco_item(i) for i in itens)


def cupom_aplicavel(cupom: Cupom | None, data: date, subtotal_centavos: int) -> bool:
    if cupom is None:
        return False
    return data <= cupom.valido_ate and subtotal_centavos >= cupom.minimo_centavos


def calcular_totais(itens: list[Item], cupom: Cupom | None = None, data: date | None = None) -> Totais:
    data = data or date.today()
    sub = subtotal(itens)
    desconto = 0
    if cupom_aplicavel(cupom, data, sub):
        desconto = arredondar(Decimal(sub) * cupom.percentual / 100)
    apos_desconto = sub - desconto
    if not itens or sub >= FRETE_GRATIS_A_PARTIR_CENTAVOS:
        frete = 0
    else:
        frete = FRETE_PADRAO_CENTAVOS
    return Totais(sub, desconto, frete, apos_desconto + frete)
