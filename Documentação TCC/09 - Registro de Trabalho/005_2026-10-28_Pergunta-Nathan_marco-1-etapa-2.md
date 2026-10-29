---
tipo: pergunta
autor: Nathan
numero: "005"
data: 2026-10-28
assunto: "Marco 1, etapa 2: validador semântico"
resposta: "[[005_2026-10-28_Resposta-Claude_marco-1-etapa-2]]"
tags: [tcc, registro, pergunta]
---

# 005 · Pergunta de Nathan — Marco 1, etapa 2: validador semântico

**Data:** 2026-10-28 · **Resposta:** [[005_2026-10-28_Resposta-Claude_marco-1-etapa-2]]

> Revisei o registro 004. A etapa 1 está aprovada.
>
> Pode prosseguir com o **Marco 1, etapa 2: implementação do validador semântico**, mantendo a branch `forja-marco-1`.
>
> Antes de implementar:
> 1. Confira o contrato v0.2, o exemplo da padaria e os testes estruturais existentes.
> 2. Verifique se há inconsistências entre o contrato, a documentação e as decisões já aprovadas.
> 3. Preserve os testes existentes e não altere a `main`.
>
> Durante a implementação:
> - Implemente as validações semânticas previstas no plano aprovado.
> - Mantenha os códigos de erro, caminhos e ordenação determinísticos.
> - Não utilize `eval`.
> - Implemente testes para os casos válidos e inválidos, incluindo referências inexistentes, tipos incompatíveis, cálculos circulares, regras duplicadas e inconsistências no ciclo de vida.
> - Não implemente interface, Ollama ou motor de geração nesta etapa.
>
> Ao concluir:
> - Execute os testes específicos da Forja e a suíte completa.
> - Informe os resultados reais, os arquivos modificados e eventuais limitações.
> - Atualize o registro de trabalho com o solicitado, o realizado, os testes e as pendências.
> - Não faça commits nem push adicionais sem me apresentar primeiro o resultado para revisão.
>
> Se encontrar uma inconsistência que exija mudar alguma decisão aprovada ou ampliar o escopo, pare e me consulte antes de prosseguir.
