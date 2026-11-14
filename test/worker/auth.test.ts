import { env } from "cloudflare:workers";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { verifyFirebaseIdToken, type VerifiedToken } from "../../src/worker/auth/firebase-token";
import { AccountLookupError } from "../../src/worker/auth/firebase-admin";
import {
  REVOCATION_CHECK_MS,
  REVOCATION_GRACE_MS,
  authenticate,
  ehDonoDoNexus,
  requireSystemAccess,
  type AuthProvider,
} from "../../src/worker/auth/session";
import { AppError } from "../../src/worker/http/errors";
import { fixedClock } from "../../src/worker/lib/clock";
import { createLogger } from "../../src/worker/lib/log";

const PROJECT = "nexus-teste";
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);
const s = (ms: number) => Math.floor(ms / 1000);

let privateKey: CryptoKey;
let otherKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  const other = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  otherKey = other.privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

function token(
  claims: Record<string, unknown> = {},
  opts: { key?: CryptoKey; aud?: string; iss?: string; exp?: number } = {},
) {
  return new SignJWT({
    email: "pessoa@example.com",
    email_verified: true,
    auth_time: s(NOW) - 60,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setSubject("uid-1")
    .setAudience(opts.aud ?? PROJECT)
    .setIssuer(opts.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setIssuedAt(s(NOW) - 30)
    .setExpirationTime(opts.exp ?? s(NOW) + 3600)
    .sign(opts.key ?? privateKey);
}

const verify = (t: string) => verifyFirebaseIdToken(t, { projectId: PROJECT, keys, now: NOW });

describe("verifyFirebaseIdToken", () => {
  it("aceita token válido e devolve uid, e-mail e auth_time", async () => {
    await expect(verify(await token())).resolves.toEqual({
      uid: "uid-1",
      email: "pessoa@example.com",
      emailVerified: true,
      authTime: (s(NOW) - 60) * 1000,
    });
  });

  it.each([
    ["audiência de outro projeto", () => token({}, { aud: "outro" })],
    ["emissor errado", () => token({}, { iss: "https://accounts.google.com" })],
    ["expirado", () => token({}, { exp: s(NOW) - 1 })],
    ["assinado com outra chave", () => token({}, { key: otherKey })],
    ["auth_time no futuro", () => token({ auth_time: s(NOW) + 60 })],
    ["sem e-mail", () => token({ email: undefined })],
  ])("recusa token com %s", async (_caso, make) => {
    await expect(verify(await make())).rejects.toThrow(/token inválido/);
  });

  it("recusa token sem kid no cabeçalho, mesmo com uma só chave no conjunto", async () => {
    const semKid = await new SignJWT({
      email: "a@example.com",
      email_verified: true,
      auth_time: s(NOW) - 60,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("uid-1")
      .setAudience(PROJECT)
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setIssuedAt(s(NOW) - 30)
      .setExpirationTime(s(NOW) + 3600)
      .sign(privateKey);
    await expect(verify(semKid)).rejects.toThrow(/token inválido/);
  });

  it("recusa algoritmo diferente de RS256", async () => {
    const hs = await new SignJWT({ email: "a@example.com", auth_time: s(NOW) })
      .setProtectedHeader({ alg: "HS256", kid: "k1" })
      .setSubject("uid-1")
      .setAudience(PROJECT)
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setIssuedAt(s(NOW))
      .setExpirationTime(s(NOW) + 60)
      .sign(new TextEncoder().encode("segredo-de-teste-com-32-bytes-ok!"));
    await expect(verify(hs)).rejects.toThrow(/token inválido/);
  });
});

// Sessão: o provedor é substituído por funções que devolvem a identidade e o estado desejados.
const BEARER = "Bearer " + "x".repeat(40);
function ctx(now = NOW, cadastro: "true" | "false" = "false") {
  return {
    request: new Request("https://app.test/api/v1/x", { headers: { authorization: BEARER } }),
    env: { ...env, CADASTRO_ABERTO: cadastro },
    clock: fixedClock(now),
    log: createLogger(),
  };
}
type LookupFn = AuthProvider["lookup"];
const notRevoked: LookupFn = () => Promise.resolve({ validSince: null, disabled: false });
function as(identity: Partial<VerifiedToken> = {}, lookup: LookupFn = notRevoked): AuthProvider {
  return {
    verify: () =>
      Promise.resolve<VerifiedToken>({
        uid: "uid-admin",
        email: "admin@example.com",
        emailVerified: true,
        authTime: NOW - 60_000,
        ...identity,
      }),
    lookup,
  };
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
}

describe("authenticate e requireSystemAccess", () => {
  beforeEach(async () => {
    const T = NOW - 86_400_000;
    await env.DB.batch([
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM system_access"),
      env.DB.prepare("DELETE FROM systems"),
      env.DB.prepare("DELETE FROM users WHERE owner_id IS NOT NULL"),
      env.DB.prepare("DELETE FROM users"),
      env.DB.prepare(
        `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at) VALUES
         ('admin', 'uid-admin', 'admin@example.com', 'admin', 'active', NULL, ${T}, ${T}),
         ('admin2', 'uid-admin2', 'admin2@example.com', 'admin', 'active', NULL, ${T}, ${T}),
         ('sec', NULL, 'Sec@Example.com', 'secondary', 'pending', 'admin', ${T}, ${T}),
         ('off', 'uid-off', 'off@example.com', 'secondary', 'disabled', 'admin', ${T}, ${T})`,
      ),
      env.DB.prepare(
        `INSERT INTO systems (id, owner_id, name, status, created_at, updated_at) VALUES
         ('s1', 'admin', 'Loja', 'active', ${T}, ${T}),
         ('s2', 'admin', 'Arquivado', 'archived', ${T}, ${T}),
         ('s3', 'admin2', 'De outro', 'active', ${T}, ${T})`,
      ),
      env.DB.prepare(
        `INSERT INTO system_access (user_id, system_id, status, granted_by, created_at, updated_at) VALUES
         ('sec', 's1', 'active', 'admin', ${T}, ${T}), ('sec', 's2', 'active', 'admin', ${T}, ${T})`,
      ),
    ]);
  });

  it("autentica o administrador ativo", async () => {
    await expect(authenticate(ctx(), as())).resolves.toMatchObject({ id: "admin", role: "admin" });
  });

  it("exige Bearer e provedor configurado (T01)", async () => {
    const semToken = { ...ctx(), request: new Request("https://app.test/") };
    expect(await code(authenticate(semToken, as()))).toBe("unauthenticated");
    expect(await code(authenticate(ctx(), undefined))).toBe("unavailable");
  });

  it("recusa e-mail não confirmado, conta desativada e conta não cadastrada (T01)", async () => {
    expect(await code(authenticate(ctx(), as({ emailVerified: false })))).toBe(
      "email_nao_confirmado",
    );
    expect(await code(authenticate(ctx(), as({ uid: "uid-off", email: "off@example.com" })))).toBe(
      "conta_desativada",
    );
    expect(await code(authenticate(ctx(), as({ uid: "uid-x", email: "x@example.com" })))).toBe(
      "conta_nao_cadastrada",
    );
  });

  it("cadastro aberto: e-mail confirmado sem conta vira administrador independente (ADR-009)", async () => {
    const novo = as({ uid: "uid-novo", email: "novo@example.com" });
    const user = await authenticate(ctx(NOW, "true"), novo);
    expect(user).toMatchObject({ role: "admin", adminId: user.id });
    const row = await env.DB.prepare(
      "SELECT role, status, owner_id, created_by, self_signup FROM users WHERE firebase_uid = 'uid-novo'",
    ).first();
    expect(row).toEqual({
      role: "admin",
      status: "active",
      owner_id: null,
      created_by: null,
      self_signup: 1,
    });
    // Segundo acesso: a mesma conta, sem duplicar.
    await expect(authenticate(ctx(NOW, "true"), novo)).resolves.toMatchObject({ id: user.id });
    const total = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM users WHERE email = 'novo@example.com'",
    ).first<{ n: number }>();
    expect(total!.n).toBe(1);
    // Não vê sistemas de outros administradores.
    expect(await code(requireSystemAccess(env.DB, user, "s1"))).toBe("not_found");
    // Nem vira dono do Nexus, mesmo criada antes de todos.
    await env.DB.prepare("UPDATE users SET created_at = 1 WHERE id = ?").bind(user.id).run();
    expect(await ehDonoDoNexus(env.DB, user)).toBe(false);
    expect(await ehDonoDoNexus(env.DB, await authenticate(ctx(), as()))).toBe(true);
  });

  it("cadastro aberto não cria conta com e-mail não confirmado (ADR-009)", async () => {
    const naoConfirmado = as({ uid: "uid-novo", email: "novo@example.com", emailVerified: false });
    expect(await code(authenticate(ctx(NOW, "true"), naoConfirmado))).toBe("email_nao_confirmado");
    const row = await env.DB.prepare(
      "SELECT id FROM users WHERE email = 'novo@example.com'",
    ).first();
    expect(row).toBeNull();
  });

  it("cadastro aberto não toma convite pendente nem conta desativada", async () => {
    // Convite pendente segue o vínculo de sempre (vira secundária, não administrador novo).
    const sec = await authenticate(
      ctx(NOW, "true"),
      as({ uid: "uid-sec", email: "sec@example.com" }),
    );
    expect(sec).toMatchObject({ id: "sec", role: "secondary" });
    expect(
      await code(authenticate(ctx(NOW, "true"), as({ uid: "uid-off", email: "off@example.com" }))),
    ).toBe("conta_desativada");
  });

  it("vincula o primeiro acesso do convite pelo e-mail, sem diferenciar maiúsculas", async () => {
    const user = await authenticate(ctx(), as({ uid: "uid-sec", email: "sec@example.com" }));
    const row = await env.DB.prepare(
      "SELECT firebase_uid, status FROM users WHERE id = 'sec'",
    ).first();

    expect(user).toMatchObject({ id: "sec", role: "secondary", adminId: "admin" });
    expect(row).toEqual({ firebase_uid: "uid-sec", status: "active" });
    // Outro uid com o mesmo e-mail não sequestra a conta já vinculada.
    expect(
      await code(authenticate(ctx(), as({ uid: "uid-intruso", email: "sec@example.com" }))),
    ).toBe("unauthenticated");
  });

  it("primeiro acesso simultâneo do mesmo uid: as requisições entram", async () => {
    const provider = as({ uid: "uid-sec", email: "sec@example.com" });
    const results = await Promise.all([
      code(authenticate(ctx(), provider)),
      code(authenticate(ctx(), provider)),
      code(authenticate(ctx(), provider)),
    ]);

    expect(results).toEqual(["ok", "ok", "ok"]);
  });

  it("convite com sessão revogada é recusado sem consumir o convite", async () => {
    const revoked: LookupFn = () => Promise.resolve({ validSince: NOW - 1000, disabled: false });
    const result = await code(
      authenticate(ctx(), as({ uid: "uid-sec", email: "sec@example.com" }, revoked)),
    );
    const row = await env.DB.prepare(
      "SELECT firebase_uid, status FROM users WHERE id = 'sec'",
    ).first();

    expect(result).toBe("unauthenticated");
    expect(row).toEqual({ firebase_uid: null, status: "pending" });
  });

  it("sincroniza a revogação feita no Firebase e recusa a sessão anterior", async () => {
    let calls = 0;
    let validSince: number | null = null;
    const lookup: LookupFn = () => {
      calls++;
      return Promise.resolve({ validSince, disabled: false });
    };

    expect(await code(authenticate(ctx(), as({}, lookup)))).toBe("ok");
    // Redefinição de senha no Firebase depois do login; dentro de 5 min não reconsulta.
    validSince = NOW - 1000;
    expect(await code(authenticate(ctx(NOW + 60_000), as({}, lookup)))).toBe("ok");
    expect(calls).toBe(1);
    // Passados os 5 minutos, reconsulta e recusa a sessão antiga; login novo entra.
    const later = NOW + REVOCATION_CHECK_MS + 1;
    expect(await code(authenticate(ctx(later), as({}, lookup)))).toBe("unauthenticated");
    expect(await code(authenticate(ctx(later), as({ authTime: NOW }, lookup)))).toBe("ok");
    expect(calls).toBe(2);
    const row = await env.DB.prepare("SELECT valid_since FROM users WHERE id = 'admin'").first();
    expect(row).toEqual({ valid_since: NOW - 1000 });
  });

  it("consulta antiga não reduz o valid_since já gravado (máximo atômico)", async () => {
    await env.DB.prepare("UPDATE users SET valid_since = ? WHERE id = 'admin'")
      .bind(NOW - 1000)
      .run();
    // Consulta concorrente mais antiga respondendo "sem revogação".
    const stale: LookupFn = () => Promise.resolve({ validSince: null, disabled: false });

    expect(await code(authenticate(ctx(), as({}, stale)))).toBe("unauthenticated");
    const row = await env.DB.prepare("SELECT valid_since FROM users WHERE id = 'admin'").first();
    expect(row).toEqual({ valid_since: NOW - 1000 });
  });

  it("primeiro acesso do convite consulta o Firebase uma única vez", async () => {
    let calls = 0;
    const lookup: LookupFn = () => {
      calls++;
      return Promise.resolve({ validSince: null, disabled: false });
    };
    expect(
      await code(authenticate(ctx(), as({ uid: "uid-sec", email: "sec@example.com" }, lookup))),
    ).toBe("ok");
    expect(calls).toBe(1);
  });

  it("conta desativada ou apagada no Firebase é recusada", async () => {
    const disabled: LookupFn = () => Promise.resolve({ validSince: null, disabled: true });
    expect(await code(authenticate(ctx(), as({}, disabled)))).toBe("conta_desativada");

    // A desativação fica gravada: queda do Firebase dentro da tolerância não devolve o acesso.
    const down: LookupFn = () => Promise.reject(new AccountLookupError("fora do ar"));
    const later = NOW + REVOCATION_CHECK_MS + 1;
    expect(await code(authenticate(ctx(later), as({}, down)))).toBe("conta_desativada");
    const row = await env.DB.prepare("SELECT status FROM users WHERE id = 'admin'").first();
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'user.disabled_by_provider'",
    ).first<{ n: number }>();
    expect(row).toEqual({ status: "disabled" });
    expect(audit?.n).toBe(1);
  });

  it("falha na consulta: recusa sem conferência recente, aceita dentro da tolerância", async () => {
    const down: LookupFn = () => Promise.reject(new AccountLookupError("fora do ar"));
    expect(await code(authenticate(ctx(), as({}, down)))).toBe("unavailable");

    await env.DB.prepare("UPDATE users SET valid_since_checked_at = ? WHERE id = 'admin'")
      .bind(NOW - REVOCATION_CHECK_MS - 1)
      .run();
    expect(await code(authenticate(ctx(), as({}, down)))).toBe("ok");
    expect(await code(authenticate(ctx(NOW + REVOCATION_GRACE_MS), as({}, down)))).toBe(
      "unavailable",
    );
  });

  it("isola sistemas por administrador e por vínculo (T02, T03, T04)", async () => {
    const admin = await authenticate(ctx(), as());
    const sec = await authenticate(ctx(), as({ uid: "uid-sec", email: "sec@example.com" }));

    expect(await code(requireSystemAccess(env.DB, admin, "s1"))).toBe("ok");
    expect(await code(requireSystemAccess(env.DB, admin, "s2"))).toBe("ok");
    expect(await code(requireSystemAccess(env.DB, admin, "s3"))).toBe("not_found");
    expect(await code(requireSystemAccess(env.DB, sec, "s1"))).toBe("ok");
    expect(await code(requireSystemAccess(env.DB, sec, "s2"))).toBe("not_found");
    expect(await code(requireSystemAccess(env.DB, sec, "s3"))).toBe("not_found");

    await env.DB.prepare(
      "UPDATE system_access SET status = 'revoked' WHERE system_id = 's1'",
    ).run();
    expect(await code(requireSystemAccess(env.DB, sec, "s1"))).toBe("not_found");
  });
});
