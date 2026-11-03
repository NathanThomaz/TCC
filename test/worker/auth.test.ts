import { env } from "cloudflare:workers";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { verifyFirebaseIdToken, type VerifiedToken } from "../../src/worker/auth/firebase-token";
import { authenticate, requireSystemAccess } from "../../src/worker/auth/session";
import { AppError } from "../../src/worker/http/errors";
import { fixedClock } from "../../src/worker/lib/clock";

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

// Sessão: o verificador é substituído por uma função que devolve a identidade desejada.
const BEARER = "Bearer " + "x".repeat(40);
function ctx() {
  return {
    request: new Request("https://app.test/api/v1/x", { headers: { authorization: BEARER } }),
    env,
    clock: fixedClock(NOW),
  };
}
const as =
  (identity: Partial<VerifiedToken> = {}) =>
  () =>
    Promise.resolve<VerifiedToken>({
      uid: "uid-admin",
      email: "admin@example.com",
      emailVerified: true,
      authTime: NOW - 60_000,
      ...identity,
    });

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

  it("exige Bearer e verificador configurado (T01)", async () => {
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

  it("recusa sessão anterior à revogação (valid_since)", async () => {
    await env.DB.prepare("UPDATE users SET valid_since = ? WHERE id = 'admin'")
      .bind(NOW - 1000)
      .run();

    expect(await code(authenticate(ctx(), as({ authTime: NOW - 60_000 })))).toBe("unauthenticated");
    expect(await code(authenticate(ctx(), as({ authTime: NOW })))).toBe("ok");
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
