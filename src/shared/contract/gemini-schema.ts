import { z } from "zod";
import { ConfigDraftSchema } from "./schema";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/**
 * Converte o JSON Schema gerado pelo Zod para a forma que o Gemini aplica de fato
 * (provas/gemini-schema): `oneOf` vira `anyOf`, `const` vira `enum` de um valor e `$schema`
 * sai. O Gemini aceitou `oneOf`/`const` sem erro, mas não os respeitou. `maxItems` também sai:
 * com listas de objetos grandes (requisitos, 11 tipos de regra) o Gemini recusa o schema com
 * HTTP 400 (prova de 2026-11-13). A resposta continua sendo validada pelo schema Zod original
 * no backend, que aplica todos os limites.
 */
export function adaptForGemini(node: Json): Json {
  if (Array.isArray(node)) return node.map(adaptForGemini);
  if (node === null || typeof node !== "object") return node;
  const out: { [key: string]: Json } = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema" || key === "maxItems") continue;
    if (key === "oneOf") out.anyOf = adaptForGemini(value);
    else if (key === "const") out.enum = [value];
    else out[key] = adaptForGemini(value);
  }
  return out;
}

/** Schema do rascunho pronto para o `responseJsonSchema` do Gemini. */
export function configDraftGeminiSchema(): Json {
  return adaptForGemini(z.toJSONSchema(ConfigDraftSchema) as Json);
}
