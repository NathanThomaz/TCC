# C3 — Oficina e loja de bicicletas (Comércio com serviços)

## Enunciado (o único texto entregue ao avaliador)

> Tenho uma loja de bicicletas com oficina. Vendo peças e acessórios — câmara, pneu, corrente, capacete — e faço revisão. Muita gente não tem como trazer a bike, então eu busco na casa do cliente e depois devolvo, e quem busca é o mesmo mecânico que devolve, para ele já saber o que foi feito. Buscar e devolver leva uns quarenta minutos cada. Câmara de ar eu vendo avulsa ou na caixa. Quero que o sistema segure as peças enquanto o pedido está aberto, igual ao que se faz em loja grande. Para cada bicicleta que entra, queria anotar o número do quadro.

## Ficha de respostas do cliente simulado

Consultar só o item perguntado. Registrar cada consulta.

| #   | Pergunta (tema)                                               | Resposta padronizada                              |
| --- | ------------------------------------------------------------- | ------------------------------------------------- |
| F1  | Quantas câmaras vêm na caixa?                                 | 10 unidades.                                      |
| F2  | Por quanto tempo as peças ficam seguras?                      | 30 minutos.                                       |
| F3  | Existe preço de atacado?                                      | Não, preço único.                                 |
| F4  | A devolução é sempre depois da busca, com o mesmo mecânico?   | Sim, sempre.                                      |
| F5  | Onde anotar o número do quadro: no cliente ou no atendimento? | No atendimento (agendamento), em texto, opcional. |
| F6  | A revisão na oficina também é agendada?                       | Não, só a busca e a devolução.                    |

## Gabarito (requisitos esperados)

| ID     | Requisito                                                  | Representação esperada                              |
| ------ | ---------------------------------------------------------- | --------------------------------------------------- |
| REQ-01 | Venda de peças com estoque, clientes e agenda de mecânicos | modelo `comercio_com_servicos` com os 6 módulos     |
| REQ-02 | Câmara na caixa com 10                                     | `unidades_por_caixa` = 10 (F1)                      |
| REQ-03 | Peças seguras por 30 minutos                               | `prazo_reserva` = 30 (F2)                           |
| REQ-04 | Busca e devolução de 40 minutos cada                       | tipos de atendimento `busca` e `devolucao`, 40 cada |
| REQ-05 | Busca e devolução pelo mesmo mecânico, em sequência        | `par_atendimento` busca → devolução (F4)            |
| REQ-06 | Número do quadro por atendimento                           | campo `texto` opcional em `agendamentos` (F5)       |

Indevido se aparecer: `limite_atacado` (F3) ou tipo de atendimento de revisão (F6).
