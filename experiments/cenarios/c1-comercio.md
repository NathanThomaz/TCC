# C1 — Loja de materiais de construção (Comércio)

## Enunciado (o único texto entregue ao avaliador)

> Tenho uma loja de materiais de construção pequena, no bairro. Vendo cimento, argamassa, tijolo, tinta e ferramentas. Preciso controlar o que tenho no depósito e as vendas, e saber quem são meus clientes, porque muito pedreiro compra comigo toda semana. Quem compra bastante leva mais barato. Cimento e argamassa eu vendo por saco, mas tijolo dá para vender solto ou no milheiro. Quando o cliente está montando o pedido no balcão, quero que o material fique separado um tempinho para outro vendedor não vender o mesmo. Também queria anotar se o cliente é pedreiro, construtora ou pessoa física. Ah, e seria ótimo emitir a nota fiscal direto do sistema.

## Ficha de respostas do cliente simulado

Consultar só o item perguntado. Registrar cada consulta.

| #   | Pergunta (tema)                                           | Resposta padronizada                          |
| --- | --------------------------------------------------------- | --------------------------------------------- |
| F1  | O que é "bastante"?                                       | A partir de R$ 500,00 em produtos no pedido.  |
| F2  | Quantos tijolos vêm no milheiro?                          | 1000 unidades.                                |
| F3  | Por quanto tempo o material fica separado?                | 20 minutos.                                   |
| F4  | O campo pedreiro/construtora/pessoa física é obrigatório? | Não, é opcional.                              |
| F5  | O preço do atacado é diferente por produto?               | Sim, cada produto tem o seu preço de atacado. |
| F6  | Precisa agendar entrega ou serviço?                       | Não, o cliente retira na loja.                |
| F7  | A nota fiscal é indispensável?                            | Seria bom, mas dá para começar sem.           |

## Gabarito (requisitos esperados)

| ID     | Requisito                                             | Representação esperada                              |
| ------ | ----------------------------------------------------- | --------------------------------------------------- |
| REQ-01 | Clientes, produtos, estoque e vendas                  | modelo `comercio` com os 4 módulos                  |
| REQ-02 | Atacado a partir de R$ 500 em produtos                | `limite_atacado` = 50000 (F1)                       |
| REQ-03 | Tijolo no milheiro de 1000                            | `unidades_por_caixa` = 1000 (F2)                    |
| REQ-04 | Material separado por 20 minutos                      | `prazo_reserva` = 20 (F3)                           |
| REQ-05 | Tipo de cliente: pedreiro, construtora, pessoa física | campo `lista` opcional em `clientes`, 3 opções (F4) |
| REQ-06 | Nota fiscal                                           | `fora_do_catalogo`, sem promessa (F7)               |

Indevido se aparecer: agenda, profissionais ou tipos de atendimento (F6).
