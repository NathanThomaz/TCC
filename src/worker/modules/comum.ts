import type { z } from "zod";
import { AppError, validationFailed } from "../http/errors";

// Utilidades dos módulos de negócio: validação do corpo e tradução das recusas do D1.

export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw validationFailed("Campos inválidos.", { issues: result.error.issues.length });
  }
  return result.data;
}

export function isUnique(error: unknown): boolean {
  return error instanceof Error && /UNIQUE|PRIMARY KEY/i.test(error.message);
}

/** Código do trigger do D1 que recusou a instrução (`RAISE(ABORT, 'codigo')`), se for um dos esperados. */
export function triggerCode<T extends string>(error: unknown, codes: readonly T[]): T | null {
  const text = error instanceof Error ? error.message : String(error);
  return codes.find((code) => text.includes(code)) ?? null;
}

/** Converte a recusa de um trigger do D1 em conflito com mensagem clara. */
export function triggerConflict(error: unknown, messages: Record<string, string>): never {
  const code = triggerCode(error, Object.keys(messages));
  if (code) throw new AppError(409, code, messages[code] ?? code);
  throw error;
}
