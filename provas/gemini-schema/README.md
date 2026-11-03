# Prova técnica — saída estruturada do Gemini com schema gerado do Zod

Prova da ADR-001, itens 3 e 7 (Vault do TCC). Três perguntas: o JSON Schema gerado do Zod é aceito como `responseJsonSchema`? A resposta passa no mesmo schema Zod? Quanto custa uma chamada típica?

## Como foi feita

- Script [`run.js`](run.js), com dados fictícios: um contrato reduzido e representativo em Zod 4.6.7 (modelo, módulos, requisitos e uma **união discriminada** de quatro tipos de regra). O texto de entrada é uma descrição narrativa de uma distribuidora, sem o prazo de reserva.
- Modelo `gemini-3.1-flash-lite` (ID confirmado na listagem de modelos em 2026-11-03), `temperature: 0`, 3 chamadas por variante.
- Duas variantes do schema enviado: **zod** (exatamente como `z.toJSONSchema` gera: `oneOf` + `const`) e **adaptado** (`oneOf` → `anyOf`, `const` → `enum` de um valor, sem `$schema`). Nas duas, a resposta é validada com o schema Zod **original**.
- Preço oficial consultado em 2026-11-03 (aistudio.google.com/docs/pricing): US$ 0,25 por 1M tokens de entrada e US$ 1,50 por 1M de saída (raciocínio incluído). Estimativa em reais com câmbio de R$ 6,00 e IOF de 4,38%, conservadores. É estimativa, não custo faturado.

Para repetir: `GEMINI_API_KEY=... PROVA_VARIANTE=adaptado node provas/gemini-schema/run.js`.

## Resultado (2026-11-03)

| Variante                    | Aceita pela API | Passou no Zod | O que veio                                                                                                                                                  |
| --------------------------- | --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zod (`oneOf` + `const`)     | Sim (HTTP 200)  | **0 de 3**    | Tipos de regra **inventados** (`desconto_atacado`, `servico_tecnico`), módulo `clientes` ausente, regra de caixa ausente                                    |
| adaptado (`anyOf` + `enum`) | Sim (HTTP 200)  | **3 de 3**    | `limite_atacado` 100000 centavos, `unidades_por_caixa` 12, `duracao_atendimento` 60 (×2), os 6 módulos; prazo de reserva **pendente**, com pergunta ao dono |

| Métrica (variante adaptada, média de 3) | Valor     |
| --------------------------------------- | --------- |
| Tokens de entrada / saída               | 156 / 531 |
| Latência                                | ~2 s      |
| Custo estimado por chamada              | ~R$ 0,005 |

Saídas completas: [`resultado-zod.json`](resultado-zod.json) e [`resultado-adaptado.json`](resultado-adaptado.json). As 3 chamadas de cada variante deram a mesma resposta (`temperature: 0`).

## Conclusão

- **Comprovado:** a API aceita `oneOf`/`const` **sem erro, mas não os aplica**. A resposta sai fora do catálogo e só o validador do backend percebe. Aceitar o schema não garante uma resposta válida.
- **Comprovado:** com o adaptador (`anyOf` + `enum`), o modelo respeitou a união e o catálogo nesse cenário e deixou pendente o que o dono não disse. O contrato do Nexus usa o Zod como fonte única e passa por esse adaptador antes do Gemini. A validação completa no backend continua obrigatória em toda resposta.
- **Custo:** cerca de R$ 0,005 por chamada com contexto pequeno. O teto de R$ 20/mês comporta milhares de chamadas desse porte. O custo de uma conversa real (contexto que cresce a cada turno) ainda precisa ser medido no piloto, como diz a ADR-001.
- **Observação:** a listagem de modelos já traz o `gemini-3.5-flash-lite` (US$ 0,30 / US$ 2,50). O modelo aprovado continua sendo o 3.1; trocar exigiria decisão e não pode acontecer durante o experimento.
- **Limites desta prova:** um único cenário, uma única mensagem e sem conversa de vários turnos. Não mede a qualidade da interpretação, que é medida no experimento.
