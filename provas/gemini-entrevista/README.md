# Prova técnica — entrevista guiada com o Gemini real (ADR-004)

Pergunta: o schema da entrevista (v2 dos prompts, `2026-11-12.1`) é aceito pelo Gemini e a IA conduz a conversa como o desenho pede (um assunto por vez, respostas rápidas, requisitos com assunto e título, sugestões marcadas e pedido ao desenvolvedor com ficha)?

## Como foi feita

- Script [`run.ts`](run.ts): mesmo cliente (`geminiDoAmbiente`), mesmo prompt (`instrucoesLevantamento`) e mesmo schema (`levantamentoGeminiSchema`) do Worker; cada resposta é validada pelo `LevantamentoSchema` (Zod), como em produção.
- Quatro falas fictícias de uma distribuidora de bebidas, incluindo um pedido fora do catálogo (desconto para cliente fiel).
- Modelo `gemini-3.1-flash-lite`, `temperature: 0`. A chave vem de `GEMINI_API_KEY` e nunca é impressa.

Para repetir: `GEMINI_API_KEY=... npx tsx provas/gemini-entrevista/run.ts`.

## Resultado (2026-11-12)

- **Primeira tentativa: HTTP 400** (`Request contains an invalid argument`). Por eliminação, a causa foi o `maxItems: 60` da lista de requisitos: o Gemini recusa esse limite numa lista de objetos deste tamanho. O schema enviado ao provedor passou a omitir só esse limite; o `LevantamentoSchema` continua aplicando os 60 antes de qualquer gravação. O schema da conversa anterior (v1) nunca tinha sido testado com o provedor real.
- **Depois da correção, as 4 rodadas passaram no Zod**, com o comportamento esperado:
  - uma pergunta por mensagem, com respostas rápidas (ex.: "R$ 500,00", "R$ 1.000,00", "R$ 2.000,00");
  - requisitos com assunto e título (ex.: `produtos_precos` · "Preço de atacado a partir de": "Atacado a partir de R$ 1.500,00 em produtos");
  - o desconto para cliente fiel virou **pedido ao desenvolvedor** com regra proposta, 1 exemplo e 3 critérios de aceite, sem promessa de prazo, e não virou requisito.
- Tokens por rodada: de 1.198 a 1.420 de entrada e de 216 a 527 de saída. **Custo estimado das 4 rodadas: R$ 0,0203** (preço e câmbio da prova `gemini-schema`).
