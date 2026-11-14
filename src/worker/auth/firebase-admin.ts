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

  async function lookup(uid: string): Promise<AccountState> {
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
  }

  // Qualquer falha da integração (rede, JSON inválido, chave mal configurada) vira
  // AccountLookupError, para a sessão aplicar a tolerância em vez de responder 500.
  return async (uid) => {
    try {
      return await lookup(uid);
    } catch (error) {
      if (error instanceof AccountLookupError) throw error;
      keyPromise = undefined;
      throw new AccountLookupError(
        `falha na consulta ao Firebase: ${error instanceof Error ? error.name : "erro"}`,
      );
    }
  };
}

/** O e-mail já tem um login no Firebase que o chamador não pode reaproveitar (ADR-009). */
export class LoginExistenteError extends Error {
  constructor() {
    super("login já existe no Firebase");
    this.name = "LoginExistenteError";
  }
}

/** O que a gestão de contas precisa do Firebase (seção 7). */
export interface AccountAdmin {
  /**
   * Garante a conta sem senha e pede ao Firebase o link de definir senha (que confirma o e-mail).
   * Devolve o uid da conta no Firebase. Com `permitido` (null ou um uid), um login que já existe
   * só é aceito se for esse uid; outro lança LoginExistenteError sem mandar o link.
   */
  invite(email: string, permitido?: string | null): Promise<string>;
  /** uid da conta do Firebase com este e-mail, se existir. */
  findUid(email: string): Promise<string | null>;
  /**
   * Cria a conta com a senha definida pelo administrador e o e-mail dado como confirmado (sem
   * validação por e-mail, pedido do dono). Com `existingUid` (conta órfã no Firebase, já conferida
   * pelo chamador contra o D1), troca a senha dela em vez de criar. Devolve o uid. A senha só
   * passa por aqui: não é gravada nem registrada.
   */
  createWithPassword(
    email: string,
    password: string,
    displayName?: string,
    existingUid?: string | null,
  ): Promise<string>;
  /** Troca a senha de uma conta existente e dá o e-mail como confirmado. */
  setPassword(uid: string, password: string): Promise<void>;
  /** Desativa no Firebase e invalida as sessões emitidas (validSince = agora). */
  disable(uid: string): Promise<void>;
  /** Reativa no Firebase (as sessões antigas continuam inválidas). */
  enable(uid: string): Promise<void>;
}

/**
 * Operações administrativas pela Identity Toolkit REST, com a mesma conta de serviço. O link de
 * definir senha usa a chave web pública (accounts:sendOobCode), como na prova firebase-convite.
 */
export function createAccountAdmin(options: {
  projectId: string;
  serviceAccount: ServiceAccount;
  webApiKey: string;
  fetch: typeof fetch;
  now: () => number;
}): AccountAdmin {
  let cached: { token: string; expiresAt: number } | undefined;
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(options.projectId)}`;

  async function accessToken(): Promise<string> {
    const now = options.now();
    if (cached && cached.expiresAt - 60_000 > now) return cached.token;
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(options.serviceAccount.client_email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(now / 1000) + 3600)
      .sign(await importPKCS8(options.serviceAccount.private_key, "RS256"));
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

  async function admin(caminho: string, corpo: unknown) {
    const response = await options.fetch(`${base}/${caminho}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(corpo),
    });
    if (!response.ok) throw new AccountLookupError(`${caminho} falhou (${response.status})`);
    return response.json<{ users?: { localId?: string }[]; localId?: string }>();
  }

  const segura =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        if (error instanceof AccountLookupError || error instanceof LoginExistenteError)
          throw error;
        throw new AccountLookupError(
          `falha na integração com o Firebase: ${error instanceof Error ? error.name : "erro"}`,
        );
      }
    };

  return {
    invite: segura(async (email: string, permitido?: string | null) => {
      const existente = await admin("accounts:lookup", { email: [email] });
      const encontrado = existente.users?.[0]?.localId;
      if (encontrado && permitido !== undefined && encontrado !== permitido) {
        throw new LoginExistenteError();
      }
      // Criado agora: se a pessoa se cadastrou no meio, o Firebase recusa (EMAIL_EXISTS).
      const uid = encontrado ?? (await admin("accounts", { email, emailVerified: false })).localId;
      if (!uid) throw new AccountLookupError("conta criada sem uid");
      const envio = await options.fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(options.webApiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
        },
      );
      if (!envio.ok) throw new AccountLookupError(`sendOobCode falhou (${envio.status})`);
      return uid;
    }),
    findUid: segura(async (email: string) => {
      const existente = await admin("accounts:lookup", { email: [email] });
      return existente.users?.[0]?.localId ?? null;
    }),
    createWithPassword: segura(
      async (email: string, password: string, displayName?: string, uid?: string | null) => {
        if (uid) {
          await admin("accounts:update", {
            localId: uid,
            password,
            emailVerified: true,
            disableUser: false,
            ...(displayName ? { displayName } : {}),
          });
          return uid;
        }
        const criado = await admin("accounts", {
          email,
          password,
          emailVerified: true,
          ...(displayName ? { displayName } : {}),
        });
        if (!criado.localId) throw new AccountLookupError("conta criada sem uid");
        return criado.localId;
      },
    ),
    setPassword: segura(async (uid: string, password: string) => {
      // Senha definida pelo administrador vale como confirmação do e-mail (sem validação por
      // e-mail, pedido do dono): sem isto, a conta convidada pelo link antigo não entraria.
      await admin("accounts:update", { localId: uid, password, emailVerified: true });
    }),
    disable: segura(async (uid: string) => {
      await admin("accounts:update", {
        localId: uid,
        disableUser: true,
        validSince: String(Math.floor(options.now() / 1000)),
      });
    }),
    enable: segura(async (uid: string) => {
      await admin("accounts:update", { localId: uid, disableUser: false });
    }),
  };
}
