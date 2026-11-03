import { AppError, forbidden, notFound, unauthenticated, unavailable } from "../http/errors";
import type { RequestContext } from "../http/router";
import { AccountLookupError, type AccountLookup } from "./firebase-admin";
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
  valid_since_checked_at: number | null;
}

export type TokenVerifier = (token: string) => Promise<VerifiedToken>;

/** O que a sessão precisa do provedor de identidade. Os dois são obrigatórios (fail closed). */
export interface AuthProvider {
  verify: TokenVerifier;
  lookup: AccountLookup;
}

/** Idade máxima da última conferência de revogação no Firebase antes de consultar de novo. */
export const REVOCATION_CHECK_MS = 5 * 60_000;
/** Se o Firebase não responder, aceita a última conferência até esta idade; depois, recusa. */
export const REVOCATION_GRACE_MS = 60 * 60_000;

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

/**
 * Confere a revogação: reconsulta o Firebase quando a última conferência está velha e guarda o
 * maior validSince conhecido com um UPDATE atômico (max no próprio SQL, com RETURNING) — uma
 * consulta antiga terminando depois nunca reduz o valor gravado. Recusa sessão com auth_time
 * anterior. Devolve a linha com o valid_since efetivo.
 */
async function checkRevocation(
  ctx: Pick<RequestContext, "env" | "clock" | "log">,
  user: UserRow,
  identity: VerifiedToken,
  lookup: AccountLookup,
): Promise<UserRow> {
  const now = ctx.clock.now();
  let current = user;
  const checkedAt = user.valid_since_checked_at;
  if (checkedAt === null || now - checkedAt > REVOCATION_CHECK_MS) {
    try {
      const state = await lookup(identity.uid);
      if (state.disabled) {
        // Desativação observada no Firebase é gravada: uma falha de consulta depois (tolerância)
        // não pode devolver o acesso. Reativar é decisão do administrador (seção 7).
        await ctx.env.DB.batch([
          ctx.env.DB.prepare(
            `UPDATE users SET status = 'disabled',
               valid_since = max(COALESCE(valid_since, 0), ?), valid_since_checked_at = ?, updated_at = ?
             WHERE id = ?`,
          ).bind(now, now, now, user.id),
          ctx.env.DB.prepare(
            "INSERT INTO audit_events (actor_id, action, target_type, target_id, created_at) SELECT NULL, 'user.disabled_by_provider', 'user', ?, ? WHERE changes() = 1",
          ).bind(user.id, now),
        ]);
        throw accountDisabled();
      }
      const stored = await ctx.env.DB.prepare(
        `UPDATE users
         SET valid_since = NULLIF(max(COALESCE(valid_since, 0), ?), 0),
             valid_since_checked_at = max(COALESCE(valid_since_checked_at, 0), ?)
         WHERE id = ?
         RETURNING valid_since, valid_since_checked_at`,
      )
        .bind(state.validSince ?? 0, now, user.id)
        .first<Pick<UserRow, "valid_since" | "valid_since_checked_at">>();
      if (stored) current = { ...user, ...stored };
    } catch (error) {
      if (!(error instanceof AccountLookupError)) throw error;
      ctx.log.warn("auth.revocation_check_failed", { error });
      if (checkedAt === null || now - checkedAt > REVOCATION_GRACE_MS) {
        throw unavailable(
          "Não foi possível confirmar sua sessão agora. Tente de novo em instantes.",
        );
      }
    }
  }
  if (current.valid_since !== null && identity.authTime < current.valid_since) {
    throw unauthenticated();
  }
  return current;
}

export async function authenticate(
  ctx: Pick<RequestContext, "request" | "env" | "clock" | "log">,
  provider: AuthProvider | undefined,
): Promise<AuthUser> {
  if (!provider) throw unavailable("Autenticação não configurada neste ambiente.");
  const token = bearer(ctx.request);

  let identity: VerifiedToken;
  try {
    identity = await provider.verify(token);
  } catch (error) {
    if (error instanceof InvalidTokenError) throw unauthenticated();
    throw error;
  }
  if (!identity.emailVerified) throw emailNotVerified();

  const db = ctx.env.DB;
  const byUid = () =>
    db.prepare("SELECT * FROM users WHERE firebase_uid = ?").bind(identity.uid).first<UserRow>();
  let user = await byUid();

  if (!user) {
    // Primeiro acesso após o convite: vincula o uid à conta pendente com o mesmo e-mail.
    const invited = await db
      .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
      .bind(identity.email)
      .first<UserRow>();
    if (!invited) throw accountUnknown();
    if (invited.firebase_uid === identity.uid) {
      // Outra requisição do mesmo uid vinculou entre as duas leituras.
      user = invited;
    } else {
      if (invited.firebase_uid !== null) throw unauthenticated();
      if (invited.status === "disabled") throw accountDisabled();
      // Revogação conferida ANTES de consumir o convite; o UPDATE repete a condição com o valor
      // gravado no banco, então sessão recusada não deixa efeito.
      const checked = await checkRevocation(ctx, invited, identity, provider.lookup);
      const bound = await db
        .prepare(
          `UPDATE users SET firebase_uid = ?, status = 'active', updated_at = ?
           WHERE id = ? AND firebase_uid IS NULL AND status = 'pending'
             AND (valid_since IS NULL OR valid_since <= ?)`,
        )
        .bind(identity.uid, ctx.clock.now(), invited.id, identity.authTime)
        .run();
      if (bound.meta.changes === 1) {
        // Já conferido acima: não consulta o Firebase de novo nesta requisição.
        return toAuthUser({ ...checked, firebase_uid: identity.uid, status: "active" });
      }
      // Outra requisição do mesmo uid pode ter vinculado ao mesmo tempo: relê antes de recusar.
      user = await byUid();
      if (!user) throw unauthenticated();
    }
  }

  if (user.status === "disabled") throw accountDisabled();
  if (user.status !== "active") throw unauthenticated();
  return toAuthUser(await checkRevocation(ctx, user, identity, provider.lookup));
}

function toAuthUser(user: UserRow): AuthUser {
  if (user.status !== "active") throw unauthenticated();
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
