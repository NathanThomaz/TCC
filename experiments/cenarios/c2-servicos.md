# C2 — Pet shop de banho e tosa (Serviços agendados)

## Enunciado (o único texto entregue ao avaliador)

> Tenho um pet shop só de banho e tosa, com três tosadoras. Hoje marco tudo num caderno e às vezes coloco dois cachorros no mesmo horário para a mesma pessoa. Quero uma agenda por profissional que não deixe isso acontecer. O banho leva uma hora; a tosa leva um pouco mais. Preciso do cadastro dos clientes e queria anotar o porte do animal. Não vendo ração nem produtos. Se desse para mandar lembrete pelo WhatsApp um dia antes, seria perfeito.

## Ficha de respostas do cliente simulado

Consultar só o item perguntado. Registrar cada consulta.

| #   | Pergunta (tema)                                           | Resposta padronizada               |
| --- | --------------------------------------------------------- | ---------------------------------- |
| F1  | Quanto tempo leva a tosa?                                 | 90 minutos.                        |
| F2  | Quais portes existem?                                     | Pequeno, médio e grande.           |
| F3  | O porte é obrigatório?                                    | Sim, sempre preciso saber o porte. |
| F4  | Banho e tosa são feitos juntos, em sequência obrigatória? | Não, cada um é marcado separado.   |
| F5  | Precisa controlar venda ou estoque?                       | Não.                               |
| F6  | O lembrete pelo WhatsApp é indispensável?                 | Não, dá para começar sem.          |

## Gabarito (requisitos esperados)

| ID     | Requisito                                         | Representação esperada                                         |
| ------ | ------------------------------------------------- | -------------------------------------------------------------- |
| REQ-01 | Clientes, profissionais e agenda sem sobreposição | modelo `servicos` com os 3 módulos                             |
| REQ-02 | Banho de 60 minutos                               | tipo de atendimento `banho`, 60                                |
| REQ-03 | Tosa de 90 minutos                                | tipo de atendimento `tosa`, 90 (F1)                            |
| REQ-04 | Porte do animal: pequeno, médio, grande           | campo `lista` **obrigatório** em `clientes`, 3 opções (F2, F3) |
| REQ-05 | Lembrete pelo WhatsApp                            | `fora_do_catalogo`, sem promessa (F6)                          |

Indevido se aparecer: vendas, estoque, produtos (F5) ou `par_atendimento` (F4).
