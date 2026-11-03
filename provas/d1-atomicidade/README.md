# Prova técnica — atomicidade e concorrência no D1

Prova da ADR-001, item 5 (Vault do TCC): uma falha de trigger `RAISE(ABORT)` dentro de `db.batch()` desfaz o lote inteiro no **D1 remoto**? E reservas simultâneas respeitam o saldo?

## Como foi feita

- Esquema mínimo em [`src/schema.ts`](src/schema.ts): estoque, reservas com validade de 30 min e agendamentos, mais dois triggers. Um bloqueia reserva acima do disponível (físico − reservas ativas não vencidas, com o relógio do backend); o outro bloqueia sobreposição de agenda do mesmo técnico, em intervalos `[início, fim)`.
- Worker temporário [`src/index.ts`](src/index.ts), publicado em workers.dev só durante a prova. Era protegido por um token aleatório (segredo `PROVA_TOKEN`, nunca versionado) e foi removido em seguida (`wrangler delete`, depois disso HTTP 404).
- Cliente [`run.js`](run.js): roda os cenários em sequência e depois dispara N reservas de 2 unidades **ao mesmo tempo** contra um estoque físico de 30.
- O mesmo mecanismo roda no D1 local, como teste permanente da suíte (`test/worker/d1-atomicity.test.ts`).

Para repetir: `npx wrangler deploy -c provas/d1-atomicidade/wrangler.jsonc`, definir o segredo `PROVA_TOKEN`, rodar `PROVA_URL=... PROVA_TOKEN=... node provas/d1-atomicidade/run.js` e apagar o Worker.

## Resultado no D1 remoto (2026-11-03)

| Cenário                                          | Esperado                                             | Obtido                                         |
| ------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------- |
| Lote com 2 reservas, a 2ª sem saldo              | Erro e **0** reservas gravadas                       | `estoque_insuficiente`, 0 gravadas             |
| Contraste: as mesmas 2 escritas **fora** de lote | Erro e **1** gravada (o ABORT desfaz só a instrução) | `estoque_insuficiente`, 1 gravada              |
| Par instalação + retirada, a retirada conflita   | Erro e nenhum item do par gravado                    | `conflito_agenda`, só o agendamento prévio (1) |
| 40 reservas simultâneas de 2 un. (físico 30)     | 15 aceitas, 30 unidades                              | 15 aceitas, 25 recusadas, 30 unidades          |
| 80 reservas simultâneas de 2 un. (físico 30)     | 15 aceitas, 30 unidades                              | 15 aceitas, 65 recusadas, 30 unidades          |

Saídas completas: [`resultado-remoto.json`](resultado-remoto.json) (40) e [`resultado-remoto-80.json`](resultado-remoto-80.json) (80). O erro chega ao Worker como `D1_ERROR: <mensagem do trigger>: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)`, então o código de domínio pode reconhecer a causa pela mensagem.

## Conclusão

- **Comprovado** no D1 remoto: `db.batch()` é tudo ou nada. Uma falha de trigger num item desfaz os itens anteriores do mesmo lote.
- **Comprovado:** sob concorrência real, o trigger avaliado na escrita impediu exceder o saldo. Não houve leitura seguida de escrita desprotegida.
- **Ressalva confirmada:** sem lote, o ABORT desfaz só a própria instrução. Toda operação com vários efeitos (vários itens, par de agenda, baixa + encerramento de reserva) **tem** de ir num único `batch()`.
- **Limites desta prova:** cobre INSERT. UPDATEs de reserva (editar itens, renovar prazo) e as transições de estado precisam de triggers ou de guardas equivalentes, com testes próprios na implementação. Também não mede latência nem os limites do plano.

## Complemento — `changes()` no D1 remoto (2026-11-03)

A auditoria condicional da ativação e da aprovação usa `INSERT ... WHERE changes() = 1` logo depois do UPDATE, no mesmo lote, para auditar só uma transição que aconteceu de fato. Conferido no D1 remoto (`nexus-prova`) com `wrangler d1 execute --remote --file`: dois UPDATEs iguais em sequência, o segundo sem efeito. Ficou registrada **só** a linha da primeira mudança (`primeira_mudou`), e não a da segunda. Ressalva: essa conferência foi feita pela execução de vários comandos do Wrangler, não por `db.batch()` dentro de um Worker. O mesmo comportamento está coberto no D1 local pelos testes de concorrência de `test/worker/systems.test.ts`.
