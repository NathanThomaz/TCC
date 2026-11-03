import { AppError, forbidden, notFound, unauthenticated, unavailable } from "../http/errors";
import type { RequestContext } from "../http/router";
import { InvalidTokenError, type VerifiedToken } from "./firebase-token";

// Sessão validada no backend (seção 7): identidade e privilégios vêm do token verificado e do
// estado atual no D1, nunca de flags enviadas pelo navegador. Toda requisição confere conta
// ativa, e-mail confirmado, revogação (valid_since) e vínculo com o sistema.

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "secondary";
  /** Administrador responsável: o próprio id para admin, o dono para secundário. */
  adminId: string;
}

interface UserRow {
  id: string;
  firebase_uid: string | null;
  email: string;
  role: "admin" | "secondary";
  status: "pending" | "active" | "disabled";
  owner_id: string | null;
  valid_since: number | null;
}

export type TokenVerifier = (token: string) => Promise<VerifiedToken>;

const emailNotVerified = () =>
  new AppError(
    403,
    "email_nao_confirmado",
    "Confirme seu e-mail pelo link recebido para continuar.",
  );
const accountDisabled = () =>
  new AppError(403, "conta_desativada", "Esta conta está desativada. Fale com o administrador.");
const accountUnknown = () =>
  new AppError(403, "conta_nao_cadastrada", "Esta conta não foi cadastrada por um administrador.");

function bearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(header);
  if (!match?.[1]) throw unauthenticated();
  return match[1];
}

export async function authenticate(
  ctx: Pick<RequestContext, "request" | "env" | "clock">,
  verify: TokenVerifier | undefined,
): Promise<AuthUser> {
  if (!verify) throw unavailable("Autenticação não configurada neste ambiente.");
  const token = bearer(ctx.request);

  let identity: VerifiedToken;
  try {
    identity = await verify(token);
  } catch (error) {
    if (error instanceof InvalidTokenError) throw unauthenticated();
    throw error;
  }
  if (!identity.emailVerified) throw emailNotVerified();

  const db = ctx.env.DB;
  let user = await db
    .prepare("SELECT * FROM users WHERE firebase_uid = ?")
    .bind(identity.uid)
    .first<UserRow>();

  if (!user) {
    // Primeiro acesso após o convite: vincula o uid à conta pendente com o mesmo e-mail.
    const invited = await db
      .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
      .bind(identity.email)
      .first<UserRow>();
    if (!invited) throw accountUnknown();
    if (invited.firebase_uid !== null) throw unauthenticated();
    if (invited.status === "disabled") throw accountDisabled();
    const now = ctx.clock.now();
    const bound = await db
      .prepare(
        "UPDATE users SET firebase_uid = ?, status = 'active', updated_at = ? WHERE id = ? AND firebase_uid IS NULL AND status = 'pending'",
      )
      .bind(identity.uid, now, invited.id)
      .run();
    if (bound.meta.changes !== 1) throw unauthenticated();
    user = { ...invited, firebase_uid: identity.uid, status: "active" };
  }

  if (user.status === "disabled") throw accountDisabled();
  if (user.status !== "active") throw unauthenticated();
  if (user.valid_since !== null && identity.authTime < user.valid_since) throw unauthenticated();

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    adminId: user.role === "admin" ? user.id : (user.owner_id ?? user.id),
  };
}

export function requireAdmin(user: AuthUser): void {
  if (user.role !== "admin") throw forbidden();
}

export interface SystemRef {
  id: string;
  owner_id: string;
  status: "draft" | "active" | "archived";
}

/**
 * Confere o acesso ao sistema. Sistema de outro administrador ou sem vínculo ativo responde 404
 * (não revela que o id existe). Sistema arquivado fica só para consulta do administrador.
 */
export async function requireSystemAccess(
  db: D1Database,
  user: AuthUser,
  systemId: string,
): Promise<SystemRef> {
  const system = await db
    .prepare("SELECT id, owner_id, status FROM systems WHERE id = ?")
    .bind(systemId)
    .first<SystemRef>();
  if (!system) throw notFound();

  if (user.role === "admin") {
    if (system.owner_id !== user.id) throw notFound();
    return system;
  }
  if (system.owner_id !== user.adminId || system.status === "archived") throw notFound();
  const access = await db
    .prepare("SELECT status FROM system_access WHERE user_id = ? AND system_id = ?")
    .bind(user.id, systemId)
    .first<{ status: string }>();
  if (access?.status !== "active") throw notFound();
  return system;
}
