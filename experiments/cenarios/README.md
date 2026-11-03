# Cenários do experimento (chat com IA × formulário manual)

**Estado: rascunho para revisão do autor. Ainda NÃO está congelado.** Ao aprovar, registrar o SHA-256 de cada arquivo (seção "Congelamento") antes de começar o chat de criação. Depois de congelado, nenhum enunciado, ficha ou gabarito muda (seção 25 e ADR-002 do TCC).

## Como usar em cada execução

1. O avaliador lê **só o enunciado** do cenário: o texto de um dono de negócio, com ambiguidades de propósito.
2. Configura o sistema na condição sorteada:
   - **Chat:** conversa com o Nexus. Quando o Nexus perguntar algo, o avaliador responde **apenas** com a resposta correspondente da ficha. Se a ficha não cobrir a pergunta, responde "não sei, decida o padrão do sistema" e registra o fato.
   - **Formulário:** preenche o formulário manual. Quando tiver uma dúvida que a ficha cobre, pode consultar **só aquele item** e registra a consulta.
3. A execução termina quando a configuração está validada e aprovada para ativação, ou aos 30 minutos.
4. A configuração final é comparada com o **gabarito** (métrica principal). O tempo é métrica secundária.

A mesma ficha vale para as duas condições. O chat não recebe informação extra, e as consultas são registradas nas duas.

## Pontuação contra o gabarito

Cada requisito do gabarito vale 1 ponto, e só conta se estiver representado corretamente na configuração final:

- **Certo:** valor e local corretos, por exemplo `limite_atacado` = 50000 centavos.
- **Errado:** representado com valor ou tipo diferente.
- **Ausente:** não aparece na configuração.
- **Indevido:** item na configuração sem respaldo no enunciado nem na ficha (conta à parte).

Também se registra o que o validador bloqueou durante a execução (erros pegos) e o que passou errado até o fim (erros que escaparam).

## Cenários

| Cenário                      | Modelo esperado       | Arquivo                                            | Gabarito                             |
| ---------------------------- | --------------------- | -------------------------------------------------- | ------------------------------------ |
| C1 — Loja de materiais       | Comércio              | [c1-comercio.md](c1-comercio.md)                   | [c1-gabarito.json](c1-gabarito.json) |
| C2 — Pet shop (banho e tosa) | Serviços agendados    | [c2-servicos.md](c2-servicos.md)                   | [c2-gabarito.json](c2-gabarito.json) |
| C3 — Oficina de bicicletas   | Comércio com serviços | [c3-comercio-servicos.md](c3-comercio-servicos.md) | [c3-gabarito.json](c3-gabarito.json) |

Os gabaritos são configurações completas, verificadas pelo mesmo validador do Nexus (`test/worker/experiment.test.ts`). Todos os negócios e dados são fictícios. A distribuidora fica de fora dos cenários de propósito: ela é o caso da demonstração e reduz o efeito de aprendizagem.

## Congelamento

| Arquivo                  | SHA-256 | Data |
| ------------------------ | ------- | ---- |
| (preencher na aprovação) |         |      |
