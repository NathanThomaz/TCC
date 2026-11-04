import type { AuthProvider } from "../auth/session";
import type { ProvedorIa } from "../ia/gemini";
import type { Env } from "../env";
import type { Clock } from "../lib/clock";
import { systemClock } from "../lib/clock";
import type { Logger } from "../lib/log";
import { createLogger } from "../lib/log";
import { AppError, methodNotAllowed, notFound } from "./errors";
import { errorResponse } from "./responses";

export interface RequestContext {
  request: Request;
  url: URL;
  env: Env;
  /** Parâmetros do caminho, ex.: `{ systemId: "..." }` para `/api/v1/systems/:systemId`. */
  params: Record<string, string>;
  clock: Clock;
  log: Logger;
  requestId: string;
  /** Provedor de identidade; `undefined` quando a autenticação não está configurada. */
  auth: AuthProvider | undefined;
  /** Provedor de IA; `undefined` quando a chave não está configurada. */
  ia: ProvedorIa | undefined;
}

export type Handler = (ctx: RequestContext) => Promise<Response> | Response;

export interface Route {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Caminho exato; segmentos `:nome` viram parâmetros. */
  path: string;
  handler: Handler;
}

export interface RouterDeps {
  clock: Clock;
  /** Monta o provedor de identidade para o ambiente (injetável nos testes). */
  auth?: (env: Env, clock: Clock) => AuthProvider | undefined;
  /** Monta o provedor de IA para o ambiente (injetável nos testes). */
  ia?: (env: Env) => ProvedorIa | undefined;
}

const defaultDeps: RouterDeps = { clock: systemClock };

/** Compara o caminho com o padrão segmento a segmento; `null` se não casar. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split("/");
  const actual = pathname.split("/");
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const value = actual[index] ?? "";
    if (segment.startsWith(":")) {
      if (value === "") return null;
      let decoded: string;
      try {
        decoded = decodeURIComponent(value);
      } catch {
        return null;
      }
      params[segment.slice(1)] = decoded;
    } else if (segment !== value) {
      return null;
    }
  }
  return params;
}

/** Roteador mínimo por método + caminho; erros viram respostas JSON padronizadas. */
export function createRouter(routes: Route[], deps: RouterDeps = defaultDeps) {
  return async function handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestId = crypto.randomUUID();
    const log = createLogger({ requestId, method: request.method, path: url.pathname });
    const started = Date.now();

    let response: Response;
    try {
      const candidates = routes
        .map((route) => ({ route, params: matchPath(route.path, url.pathname) }))
        .filter((candidate) => candidate.params !== null);
      const match = candidates.find((candidate) => candidate.route.method === request.method);
      if (match?.params) {
        response = await match.route.handler({
          request,
          url,
          env,
          params: match.params,
          clock: deps.clock,
          log,
          requestId,
          auth: deps.auth?.(env, deps.clock),
          ia: deps.ia?.(env),
        });
      } else if (candidates.length > 0) {
        const allow = [...new Set(candidates.map((candidate) => candidate.route.method))].join(
          ", ",
        );
        response = errorResponse(methodNotAllowed(), requestId, { allow });
      } else {
        throw notFound();
      }
    } catch (error) {
      response = handleError(error, requestId, log);
    }

    log.info("request.completed", { status: response.status, durationMs: Date.now() - started });
    return response;
  };
}

function handleError(error: unknown, requestId: string, log: Logger): Response {
  if (error instanceof AppError) {
    const level = error.status >= 500 ? "error" : "info";
    log[level]("request.failed", { code: error.code, ...error.context });
    return errorResponse(error, requestId);
  }
  // Erro inesperado: detalhes só no log, resposta genérica ao cliente.
  log.error("request.unhandled_error", { error });
  return errorResponse(
    new AppError(500, "internal_error", "Erro interno. Tente novamente mais tarde."),
    requestId,
  );
}
