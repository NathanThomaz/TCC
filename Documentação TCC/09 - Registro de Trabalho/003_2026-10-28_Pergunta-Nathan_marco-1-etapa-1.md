---
tipo: pergunta
autor: Nathan
numero: "003"
data: 2026-10-28
assunto: "Marco 1, etapa 1: contrato v0.2 e testes estruturais"
resposta: "[[003_2026-10-28_Resposta-Claude_marco-1-etapa-1]]"
tags: [tcc, registro, pergunta]
---

# 003 · Pergunta de Nathan — Marco 1, etapa 1: contrato v0.2 e testes estruturais

**Data:** 2026-10-28 · **Resposta:** [[003_2026-10-28_Resposta-Claude_marco-1-etapa-1]]

> Aprovo o plano do Marco 1 da Forja e **aceito as recomendações P1 a P9**, conforme descritas na seção 10 do documento.
>
> Pode iniciar a implementação, seguindo o plano aprovado e respeitando os seguintes direcionamentos:
>
> 1. **Implemente por etapas pequenas e verificáveis**, executando os testes correspondentes ao final de cada etapa.
> 2. Comece pela atualização do contrato para a versão 0.2, pela migração manual do exemplo da padaria e pelos testes estruturais.
> 3. Depois, implemente o validador semântico, os códigos de erro e os testes correspondentes.
> 4. Preserve integralmente o projeto anterior `src/tcc_exp/`, os testes existentes e os demais componentes fora do escopo definido.
> 5. Não implemente ainda a interface, o Ollama ou o motor de geração. O foco deste marco é exclusivamente o contrato do mapa e a validação estrutural e semântica.
> 6. Garanta que o contrato seja encontrado tanto durante o desenvolvimento quanto após a instalação do pacote `forja`.
> 7. Mantenha as expressões das regras como estruturas de dados, sem utilizar `eval`.
> 8. Não declare testes aprovados sem executá-los. Ao final, informe os comandos executados, os resultados reais, eventuais falhas e as limitações que permanecerem.
> 9. Atualize a documentação para distinguir claramente o que está implementado do que continua planejado.
>
> **Critérios de conclusão do Marco 1:**
> - Contrato v0.2 válido e exemplo da padaria atualizado.
> - Validação estrutural e semântica funcionando.
> - Erros e avisos com códigos, caminhos e ordenação determinística.
> - Testes específicos da Forja executados e aprovados.
> - Os 45 testes existentes do projeto anterior continuam passando.
> - Documentação atualizada e coerente com o código realmente implementado.
> - Nenhuma funcionalidade do motor de geração ou da interface foi implementada antecipadamente.
>
> Antes de começar, faça uma breve conferência de escopo. Em seguida, implemente a primeira etapa e apresente os resultados antes de avançar para a próxima. Se encontrar uma contradição no contrato, uma decisão técnica que altere o escopo ou um problema que exija modificar o projeto anterior, **pare e me consulte antes de prosseguir**.
>
> Não faça commits automaticamente. Ao concluir cada etapa, apresente um resumo dos arquivos alterados, das decisões tomadas e dos testes executados.
