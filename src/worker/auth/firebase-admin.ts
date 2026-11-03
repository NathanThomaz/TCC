import { SignJWT, importPKCS8 } from "jose";

// Consulta administrativa da conta no Firebase (Identity Toolkit REST), autenticada por conta de
// serviço via OAuth 2.0 JWT bearer — sem o SDK Admin para Node (ADR-001, item 6). Serve para
// sincronizar a revogação externa: redefinir a senha ou revogar sessões no Firebase muda o
// validSince da conta, e tokens com auth_time anterior passam a ser recusados.

export interface AccountState {
  /** tokensValidAfterTime em ms; null se o Firebase não informar. */
  validSince: number | null;
  disabled: boolean;
}

export type AccountLookup = (uid: string) => Promise<AccountState>;

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/identitytoolkit";

export class AccountLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountLookupError";
  }
}

export function parseServiceAccount(raw: string | undefined): ServiceAccount | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as Partial<ServiceAccount>;
    if (typeof value.client_email === "string" && typeof value.private_key === "string") {
      return { client_email: value.client_email, private_key: value.private_key };
    }
  } catch {
    // formato inválido: tratado como ausente
  }
  return undefined;
}

export function createAccountLookup(options: {
  projectId: string;
  serviceAccount: ServiceAccount;
  fetch: typeof fetch;
  now: () => number;
}): AccountLookup {
  let cached: { token: string; expiresAt: number } | undefined;
  let keyPromise: Promise<CryptoKey> | undefined;

  async function accessToken(): Promise<string> {
    const now = options.now();
    if (cached && cached.expiresAt - 60_000 > now) return cached.token;
    keyPromise ??= importPKCS8(options.serviceAccount.private_key, "RS256");
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(options.serviceAccount.client_email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(now / 1000) + 3600)
      .sign(await keyPromise);
    const response = await options.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) throw new AccountLookupError(`token OAuth recusado (${response.status})`);
    const body = await response.json<{ access_token?: string; expires_in?: number }>();
    if (!body.access_token) throw new AccountLookupError("token OAuth ausente");
    cached = { token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) * 1000 };
    return cached.token;
  }

  return async (uid) => {
    const response = await options.fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(options.projectId)}/accounts:lookup`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${await accessToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ localId: [uid] }),
      },
    );
    if (!response.ok) throw new AccountLookupError(`accounts:lookup falhou (${response.status})`);
    const body = await response.json<{
      users?: { localId?: string; validSince?: string; disabled?: boolean }[];
    }>();
    const user = body.users?.find((u) => u.localId === uid);
    // Conta apagada no Firebase: tratada como desativada.
    if (!user) return { validSince: null, disabled: true };
    const seconds = Number(user.validSince);
    return {
      validSince: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null,
      disabled: user.disabled === true,
    };
  };
}
