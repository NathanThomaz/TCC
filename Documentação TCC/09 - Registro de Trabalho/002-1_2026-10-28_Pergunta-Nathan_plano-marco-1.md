---
tipo: pergunta
autor: Nathan
numero: "002-1"
data: 2026-10-28
assunto: "Plano do Marco 1 (contrato e validação semântica)"
resposta: "[[002-1_2026-10-28_Resposta-Claude_plano-marco-1]]"
tags: [tcc, registro, pergunta]
---

# 002-1 · Pergunta de Nathan — Plano do Marco 1 (contrato e validação semântica)

**Data:** 2026-10-28 · **Resposta:** [[002-1_2026-10-28_Resposta-Claude_plano-marco-1]]

> # Forja — Marco 1: contrato e validação semântica
>
> ## Contexto
>
> Estamos desenvolvendo a Forja, uma plataforma que transforma regras de negócio em especificações estruturadas de sistemas. O mapa do sistema é a fonte única da verdade para os artefatos gerados.
>
> Arquivos principais existentes:
> - `docs/forja/README.md`
> - `docs/forja/mapa-do-sistema.schema.json`
> - `docs/forja/exemplo-padaria.mapa.json`
>
> O projeto ainda não possui o motor de geração da Forja. Não presuma que funcionalidades planejadas já estejam implementadas.
>
> ## Decisões de negócio confirmadas
>
> 1. Uma venda começa como rascunho.
> 2. A venda só movimenta estoque e financeiro quando é concluída.
> 3. Uma venda concluída não pode ser excluída diretamente. Deve ser cancelada explicitamente, com estorno dos efeitos originais.
> 4. O cancelamento não pode produzir estornos duplicados.
> 5. Campos calculados não podem ser editados na aplicação normal.
> 6. Testes podem preparar valores iniciais de campos calculados por meio de um mecanismo explícito, isolado do sistema publicado.
> 7. Expressões de regras devem permanecer estruturadas e nunca ser executadas por `eval`.
> 8. O modo com IA e o modo guiado devem produzir o mesmo formato de mapa.
>
> ## Objetivo da primeira entrega
>
> Revisar e formalizar o contrato e preparar uma validação estrutural e semântica reproduzível.
>
> ## Restrições
>
> - Antes de editar arquivos, apresente um plano com os arquivos que pretende alterar e as decisões técnicas envolvidas.
> - Não faça commits.
> - Não reescreva o projeto experimental anterior.
> - Não implemente ainda a interface, o Ollama ou o motor completo de geração.
> - Preserve a compatibilidade do mapa de exemplo sempre que possível. Se houver incompatibilidade necessária, explique-a e proponha uma migração.
> - Não adicione dependências sem justificativa.
> - Não declare que um teste passou sem executá-lo.
> - Separe decisões confirmadas de decisões ainda pendentes.
>
> ## Trabalho solicitado
>
> 1. Inspecione o schema, o README e o mapa de exemplo.
> 2. Identifique as mudanças mínimas necessárias para representar o ciclo de vida de vendas e as decisões sobre campos calculados.
> 3. Proponha um modelo explícito para estados e transições, diferenciando eventos de domínio de operações CRUD.
> 4. Proponha um mecanismo de validação semântica que verifique referências, compatibilidade de tipos, ciclos de cálculo e integridade das regras.
> 5. Defina a estrutura dos erros de validação, incluindo código, caminho do elemento e mensagem.
> 6. Planeje testes estruturais e semânticos positivos e negativos.
> 7. Defina como o setup de testes poderá preparar campos calculados sem expor essa capacidade na aplicação publicada.
> 8. Apresente os arquivos que serão criados ou modificados e os critérios de aceitação de cada alteração.
>
> Não implemente a geração de sistemas nesta etapa.
>
> ## Critérios de aceitação
>
> - O schema pode ser validado por uma ferramenta compatível com JSON Schema Draft 2020-12.
> - A dependência de validação está declarada no projeto, se necessária.
> - O mapa da padaria passa pela validação estrutural e semântica após os ajustes acordados.
> - Referências inexistentes são rejeitadas.
> - Campos calculados sem regra, regras duplicadas e ciclos de cálculo são detectados.
> - Ações que alteram campos calculados são rejeitadas.
> - A semântica de estados e transições está documentada.
> - Existem testes automatizados reproduzíveis.
> - A documentação distingue claramente o que está implementado do que permanece planejado.
>
> Primeiro, entregue apenas o plano de implementação e a lista de arquivos envolvidos. Aguarde minha aprovação antes de alterar qualquer arquivo.
