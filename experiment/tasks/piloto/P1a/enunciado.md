# Tarefa P1a — Frete grátis concedido indevidamente

**Tipo:** correção de defeito · **Tarefa de PILOTO** (não faz parte da coleta principal)

## Relato do defeito (equipe comercial)

> Um cliente fez um pedido de R$ 320,00 e usou um cupom de 10%. O pedido ficou em
> R$ 288,00 e, mesmo assim, saiu com frete grátis. A política é clara: o frete grátis
> vale quando o valor **após o desconto do cupom** é de pelo menos R$ 300,00.

## Regras de negócio (vigentes)

As regras completas de preço estão no cabeçalho de `loja/precos.py`. Em resumo:
- frete padrão de R$ 25,00;
- frete grátis quando o valor após o cupom é **≥ R$ 300,00**;
- pedido sem itens não tem frete.

## O que fazer

Corrija o defeito de modo que **todas** as regras de frete sejam respeitadas, inclusive
no total gravado pelos pedidos criados com `criar_pedido`.

## Critérios de aceitação

1. O caso relatado passa a cobrar frete (teste público em `testes_publicos/`).
2. As demais regras de preço e frete continuam válidas.
3. A entrega será avaliada também por cenários de avaliação adicionais, derivados das
   regras acima, que não são mostrados.

## Como trabalhar

- Rode os testes públicos com `exp testar <exec_id>`.
- Entregue com `exp entregar <exec_id>`.
- Não altere os arquivos em `testes_publicos/`.
