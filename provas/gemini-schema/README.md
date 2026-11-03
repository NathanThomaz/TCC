# Prova técnica — saída estruturada do Gemini com schema gerado do Zod

Prova da ADR-001, itens 3 e 7 (Vault do TCC). Três perguntas: o JSON Schema gerado do Zod é aceito como `responseJsonSchema`? A resposta passa no mesmo schema Zod? Quanto custa uma chamada típica?

## Como foi feita

- Script [`run.js`](run.js), com dados fictícios: um contrato reduzido e representativo em Zod 4.6.7 (modelo, módulos, requisitos e uma **união discriminada** de quatro tipos de regra). O texto de entrada é uma descrição narrativa de uma distribuidora, sem o prazo de reserva.
- Modelo `gemini-3.1-flash-lite` (ID confirmado na listagem de modelos em 2026-11-03), `temperature: 0`, 3 chamadas por variante.
- Quatro variantes controladas do schema enviado, cada uma com **uma** mudança em relação ao gerado pelo Zod. A resposta é sempre validada com o schema Zod **original**:
  - `zod`: exatamente como `z.toJSONSchema` gera (`oneOf` + `const` + `$schema`);
  - `sem_schema`: só remove o `$schema` da raiz;
  - `anyof`: só troca `oneOf` → `anyOf` e `const` → `enum` de um valor, mantendo o `$schema`;
  - `adaptado`: as duas mudanças.
- Cada arquivo de resultado guarda o schema enviado e a **resposta completa** de cada chamada.
- Preço oficial consultado em 2026-11-03 (aistudio.google.com/docs/pricing): US$ 0,25 por 1M tokens de entrada e US$ 1,50 por 1M de saída (raciocínio incluído). Estimativa em reais com câmbio de R$ 6,00 e IOF de 4,38%, conservadores. É estimativa, não custo faturado.

Para repetir: `GEMINI_API_KEY=... PROVA_VARIANTE=<variante> node provas/gemini-schema/run.js`.

## Resultado (2026-11-03)

| Variante     | Aceita pela API | Passou no Zod | Respostas idênticas | Custo médio |
| ------------ | --------------- | ------------- | ------------------- | ----------- |
| `zod`        | Sim (HTTP 200)  | **0 de 3**    | Sim                 | ~R$ 0,0045  |
| `sem_schema` | Sim (HTTP 200)  | **0 de 3**    | Sim                 | ~R$ 0,0045  |
| `anyof`      | Sim (HTTP 200)  | **3 de 3**    | Sim                 | ~R$ 0,0052  |
| `adaptado`   | Sim (HTTP 200)  | **3 de 3**    | Sim                 | ~R$ 0,0052  |

- Nas variantes que falharam, os tipos de regra foram **inventados** (`desconto_atacado`, `servico_tecnico`), o módulo `clientes` ficou de fora e a regra de caixa também.
- Nas que passaram vieram `limite_atacado` 100000 centavos, `unidades_por_caixa` 12, `duracao_atendimento` 60 (×2) e os 6 módulos. O prazo de reserva ficou **pendente**, com uma pergunta ao dono.
- Tokens na variante adaptada: 156 de entrada e 531 de saída; latência de cerca de 2 s.

Saídas completas: `resultado-<variante>.json`.

## Conclusão

- **Comprovado:** a API aceita `oneOf`/`const` **sem erro, mas não os aplica**. A resposta sai fora do catálogo e só o validador do backend percebe. Aceitar o schema não garante uma resposta válida.
- **Comprovado (controlado):** o `$schema` não é a causa; remover só ele não mudou nada. A troca `oneOf` → `anyOf` com `const` → `enum` resolveu nesse cenário. Essas duas trocas foram testadas **juntas**, então não se isola qual das duas é a responsável.
- **Decisão técnica:** o contrato do Nexus usa o Zod como fonte única e passa pelo `adaptForGemini` (as duas trocas, mais a remoção do `$schema`, que é inofensiva) antes do Gemini. A validação completa no backend continua obrigatória em toda resposta.
- **Custo:** cerca de R$ 0,005 por chamada com contexto pequeno. O teto de R$ 20/mês comporta milhares de chamadas desse porte. O custo de uma conversa real (contexto que cresce a cada turno) ainda precisa ser medido no piloto, como diz a ADR-001.
- **Observação:** a listagem de modelos já traz o `gemini-3.5-flash-lite` (US$ 0,30 / US$ 2,50). O modelo aprovado continua sendo o 3.1; trocar exigiria decisão e não pode acontecer durante o experimento.
- **Limites desta prova:** um único cenário, uma única mensagem e sem conversa de vários turnos. Não mede a qualidade da interpretação, que é medida no experimento.
