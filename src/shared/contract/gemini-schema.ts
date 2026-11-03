import { z } from "zod";
import { ConfigDraftSchema } from "./schema";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/**
 * Converte o JSON Schema gerado pelo Zod para a forma que o Gemini aplica de fato
 * (provas/gemini-schema): `oneOf` vira `anyOf`, `const` vira `enum` de um valor e `$schema`
 * sai. O Gemini aceitou `oneOf`/`const` sem erro, mas não os respeitou. A resposta continua
 * sendo validada pelo schema Zod original no backend.
 */
export function adaptForGemini(node: Json): Json {
  if (Array.isArray(node)) return node.map(adaptForGemini);
  if (node === null || typeof node !== "object") return node;
  const out: { [key: string]: Json } = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema") continue;
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
