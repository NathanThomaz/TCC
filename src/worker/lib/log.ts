export type LogLevel = "info" | "warn" | "error";

export interface Logger {
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

// Chaves cujo valor nunca vai para o log, em qualquer nível de aninhamento.
const SENSITIVE = /token|secret|password|senha|authorization|cookie|api[_-]?key/i;

// Segredos que podem aparecer dentro de textos livres (mensagens de erro de integrações).
const SECRET_IN_TEXT: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [omitido]"],
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt omitido]"],
  [/AIza[0-9A-Za-z_-]{20,}/g, "[chave omitida]"],
  [/((?:token|secret|password|senha|api[_-]?key|key)=)[^&\s"']+/gi, "$1[omitido]"],
  // JSON embutido na mensagem: "password": "..." (valor texto ou não).
  [
    /("[^"]*(?:token|secret|password|senha|authorization|cookie|api[_-]?key)[^"]*"\s*:\s*)("(?:[^"\\]|\\.)*"|[^,}\s]+)/gi,
    '$1"[omitido]"',
  ],
];

export function redactText(text: string): string {
  return SECRET_IN_TEXT.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    text,
  );
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[profundo]";
  if (typeof value === "string") return redactText(value);
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE.test(key) ? "[omitido]" : redact(item, depth + 1),
      ]),
    );
  }
  return value;
}

/** Log estruturado em JSON (Workers Observability), com redação de campos sensíveis. */
export function createLogger(base: Record<string, unknown> = {}): Logger {
  const write = (level: LogLevel, event: string, data: Record<string, unknown> = {}) => {
    const line = JSON.stringify({ level, event, ...(redact({ ...base, ...data }) as object) });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    info: (event, data) => write("info", event, data),
    warn: (event, data) => write("warn", event, data),
    error: (event, data) => write("error", event, data),
  };
}
