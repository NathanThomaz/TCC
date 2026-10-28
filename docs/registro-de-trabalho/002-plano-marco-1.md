# 002 — Plano do Marco 1 (contrato e validação semântica) e aprovação

**Data:** 2026-10-28

## Solicitado
1. Primeiro pedido: um plano (sem implementar) para revisar e formalizar o contrato do mapa e preparar uma validação estrutural e semântica reproduzível. O plano deveria incorporar 8 decisões de negócio confirmadas:
   1. venda começa como rascunho;
   2. venda só movimenta estoque e financeiro ao ser concluída;
   3. venda concluída não se exclui, só se cancela, com estorno;
   4. cancelamento sem estorno duplicado;
   5. campos calculados não são editáveis;
   6. preparação de campos calculados em testes de forma explícita e isolada;
   7. sem `eval`;
   8. o mesmo formato de mapa nos modos com IA e guiado.
2. Segundo pedido: transformar o plano em arquivo `.md`, para facilitar a compreensão.
3. Terceiro pedido: aprovação do plano, aceitando as recomendações P1 a P9.

## Feito
- Plano entregue, depois gravado de forma explicativa, com glossário: [../forja/plano-marco-1.md](../forja/plano-marco-1.md).
- Conteúdo do plano:
  - diagnóstico do contrato v0.1;
  - mudanças para a v0.2: ciclo de vida, `origem` dos campos, transições como gatilho, `para_cada`, `preparacao`/`forcar`;
  - modelo de estados e transições;
  - catálogo de verificações semânticas e códigos de erro;
  - formato do erro (código, caminho em JSON Pointer, mensagem, severidade, camada);
  - plano de testes;
  - preparação de testes isolada do sistema publicado;
  - arquivos e critérios de aceitação.

## Decisões pendentes aprovadas (P1 a P9: recomendações aceitas)

| # | Decisão aprovada |
|---|---|
| P1 | Contrato oficial dentro do pacote (`src/forja/contrato/`) |
| P2 | Campo `origem` (`usuario`, `calculo`, `acao`, `estado`); `calculado: true` aceito como sinônimo obsoleto, com aviso |
| P3 | Ações disparadas por edição proibidas no MVP |
| P4 | `permissoes_transicoes` opcional no perfil |
| P5 | Estoque garantido por "tudo ou nada" + `min: 0`; regra por item só para a mensagem |
| P6 | Venda cancelada não editável nem excluível |
| P7 | Preço sugerido a partir do produto fica para depois |
| P8 | Avisos: estado inalcançável, entidade sem perfil, regra equivalente; o resto é erro |
| P9 | Sem script de migração; só a tabela documentada |

## Direcionamentos recebidos na aprovação
- Etapas pequenas e verificáveis, com testes ao fim de cada uma.
- Preservar integralmente `src/tcc_exp/` e os testes existentes.
- Sem interface, Ollama ou motor.
- O contrato precisa ser encontrado no desenvolvimento e após a instalação.
- Sem `eval`.
- Nunca declarar teste aprovado sem executar.
- Documentação distinguindo implementado de planejado.
- Parar e consultar diante de contradição ou mudança de escopo.
- Sem commits automáticos.

## Arquivos
- `docs/forja/plano-marco-1.md` (criado)
