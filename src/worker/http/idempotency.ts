import { AppError, validationFailed } from "./errors";
import type { RequestContext } from "./router";
import { canonicalJson, sha256Hex } from "../lib/hash";

// Idempotência por escopo + ator + comando + chave (seção 19). O registro em operation_requests
// entra no MESMO batch dos efeitos: ou tudo é gravado, ou nada. Repetir com a mesma chave e o
// mesmo conteúdo devolve o recurso já criado; mesma chave com outro conteúdo é conflito.

const KEY = /^[A-Za-z0-9_-]{8,100}$/;

export interface IdempotentCommand {
  scope: string;
  actorId: string;
  command: string;
  body: unknown;
}

export type IdempotencyOutcome =
  | { kind: "new"; key: string; requestHash: string }
  | { kind: "replay"; resourceId: string; statusCode: number };

export function idempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key") ?? "";
  if (!KEY.test(key)) {
    throw validationFailed(
      "Envie o cabeçalho Idempotency-Key (8 a 100 caracteres: letras, números, _ ou -).",
    );
  }
  return key;
}

const keyReused = () =>
  new AppError(
    409,
    "chave_idempotencia_reutilizada",
    "Esta chave de idempotência já foi usada com outro conteúdo.",
  );

interface StoredOperation {
  request_hash: string;
  status_code: number;
  response_json: string;
}

async function stored(
  ctx: Pick<RequestContext, "env">,
  cmd: IdempotentCommand,
  key: string,
): Promise<StoredOperation | null> {
  return ctx.env.DB.prepare(
    "SELECT request_hash, status_code, response_json FROM operation_requests WHERE scope = ? AND actor_id = ? AND command = ? AND idempotency_key = ?",
  )
    .bind(cmd.scope, cmd.actorId, cmd.command, key)
    .first<StoredOperation>();
}

function replayOf(row: StoredOperation, requestHash: string): IdempotencyOutcome {
  if (row.request_hash !== requestHash) throw keyReused();
  const { recurso } = JSON.parse(row.response_json) as { recurso: string };
  return { kind: "replay", resourceId: recurso, statusCode: row.status_code };
}

/** Confere se a operação já foi feita antes de executar os efeitos. */
export async function beginIdempotent(
  ctx: Pick<RequestContext, "env" | "request">,
  cmd: IdempotentCommand,
): Promise<IdempotencyOutcome> {
  const key = idempotencyKey(ctx.request);
  const requestHash = await sha256Hex(canonicalJson(cmd.body));
  const row = await stored(ctx, cmd, key);
  return row ? replayOf(row, requestHash) : { kind: "new", key, requestHash };
}

/** Instrução que registra a operação; vai no mesmo batch dos efeitos. */
export function recordStatement(
  ctx: Pick<RequestContext, "env">,
  cmd: IdempotentCommand,
  started: Extract<IdempotencyOutcome, { kind: "new" }>,
  resourceId: string,
  statusCode: number,
  now: number,
): D1PreparedStatement {
  return ctx.env.DB.prepare(
    `INSERT INTO operation_requests
       (scope, actor_id, command, idempotency_key, request_hash, status_code, response_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, json_object('recurso', ?), ?)`,
  ).bind(
    cmd.scope,
    cmd.actorId,
    cmd.command,
    started.key,
    started.requestHash,
    statusCode,
    resourceId,
    now,
  );
}

/**
 * Depois de um batch que falhou por UNIQUE: se outra requisição com a mesma chave venceu a
 * corrida, devolve a repetição dela; senão, `null` (o erro era de outra causa).
 */
export async function replayAfterRace(
  ctx: Pick<RequestContext, "env">,
  cmd: IdempotentCommand,
  started: Extract<IdempotencyOutcome, { kind: "new" }>,
): Promise<IdempotencyOutcome | null> {
  const row = await stored(ctx, cmd, started.key);
  return row ? replayOf(row, started.requestHash) : null;
}
