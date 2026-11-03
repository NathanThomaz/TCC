/**
 * Erro de aplicação com status HTTP e código estável. `message` é exibida ao cliente;
 * `context` só vai para o log (já passa pela redação) e nunca para a resposta.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly context: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.context = context;
  }
}

// Categorias da seção 20: autenticação, permissão, validação, inexistência, conflito e indisponibilidade.
export const unauthenticated = () =>
  new AppError(401, "unauthenticated", "Faça login para continuar.");

export const forbidden = () =>
  new AppError(403, "forbidden", "Você não tem permissão para esta operação.");

export const notFound = () => new AppError(404, "not_found", "Recurso não encontrado.");

export const methodNotAllowed = () =>
  new AppError(405, "method_not_allowed", "Método não permitido para este recurso.");

export const conflict = (message: string, context: Record<string, unknown> = {}) =>
  new AppError(409, "conflict", message, context);

export const validationFailed = (message: string, context: Record<string, unknown> = {}) =>
  new AppError(422, "validation_failed", message, context);

export const unavailable = (message = "Serviço indisponível no momento. Tente novamente.") =>
  new AppError(503, "unavailable", message);
