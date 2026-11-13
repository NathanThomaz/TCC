import type { ApiErrorBody } from "../../shared/api";
import { obterAuth } from "@/lib/firebase";

// Cliente da API real (/api/v1). Toda chamada leva o ID token do Firebase; criações levam uma
// Idempotency-Key (seção 19), para que um clique repetido ou um retry não duplique efeitos.

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
    public dados?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Avisado quando a API responde 401 com sessão aberta (sessão expirada ou revogada). */
let aoExpirar: (() => void) | undefined;
export function quandoSessaoExpirar(fn: (() => void) | undefined) {
  aoExpirar = fn;
}

/** Para chamadas fora de `chamar` (ex.: arquivos): 401 com sessão aberta avisa a expiração. */
export function sessaoRecusada(status: number, tinhaToken: boolean) {
  if (status === 401 && tinhaToken) aoExpirar?.();
}

export async function tokenAtual(): Promise<string | null> {
  const auth = await obterAuth();
  return (await auth?.currentUser?.getIdToken()) ?? null;
}

export async function chamar<T>(
  caminho: string,
  opcoes: { method?: "GET" | "POST" | "PATCH"; body?: unknown; chave?: string } = {},
): Promise<T> {
  const token = await tokenAtual();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (opcoes.body !== undefined) headers["content-type"] = "application/json";
  if (opcoes.chave) headers["idempotency-key"] = opcoes.chave;

  let resposta: Response;
  try {
    resposta = await fetch(`/api/v1${caminho}`, {
      method: opcoes.method ?? "GET",
      headers,
      ...(opcoes.body !== undefined ? { body: JSON.stringify(opcoes.body) } : {}),
    });
  } catch {
    throw new ApiError("servico_indisponivel", "Não conseguimos falar com o servidor.");
  }

  const corpo = (await resposta.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (resposta.ok && corpo) return corpo;
  // 422 do validador traz o diagnóstico no corpo; quem chama decide o que fazer.
  if (resposta.status === 422 && corpo && "issues" in corpo) return corpo;
  sessaoRecusada(resposta.status, !!token);
  const erro = corpo?.error;
  throw new ApiError(
    erro?.code ?? (resposta.status >= 500 ? "servico_indisponivel" : "erro_desconhecido"),
    erro?.message ?? "Não foi possível concluir a operação.",
    resposta.status,
    corpo,
  );
}

/** Chave nova por intenção do usuário (um clique); repetições da mesma intenção a reutilizam. */
export function novaChave(): string {
  return crypto.randomUUID();
}
