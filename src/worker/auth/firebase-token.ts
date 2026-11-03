import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

// Verificação do ID token do Firebase no Worker, sem o SDK Admin para Node (ADR-001, item 6).
// Requisitos oficiais (firebase.google.com/docs/auth/admin/verify-id-tokens): RS256, kid das
// chaves públicas do securetoken, aud = id do projeto, iss = securetoken.google.com/<projeto>,
// exp no futuro, iat e auth_time no passado, sub não vazio (= uid).

export const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// Uma instância por isolate: o jose guarda as chaves e respeita o tempo de cache.
let remoteKeys: JWTVerifyGetKey | undefined;
export function firebaseKeys(): JWTVerifyGetKey {
  remoteKeys ??= createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  return remoteKeys;
}

export interface VerifiedToken {
  uid: string;
  email: string;
  emailVerified: boolean;
  /**
   * Momento do login que originou a sessão, em ms. É o que se compara com users.valid_since
   * (tokensValidAfterTime), como faz o checkRevoked do SDK Admin; o iat muda a cada renovação.
   */
  authTime: number;
}

export class InvalidTokenError extends Error {
  constructor(readonly reason: string) {
    super(`token inválido: ${reason}`);
    this.name = "InvalidTokenError";
  }
}

export async function verifyFirebaseIdToken(
  token: string,
  options: { projectId: string; keys: JWTVerifyGetKey; now: number },
): Promise<VerifiedToken> {
  const nowSeconds = Math.floor(options.now / 1000);
  let payload: JWTPayload;
  let kid: unknown;
  try {
    let protectedHeader;
    ({ payload, protectedHeader } = await jwtVerify(token, options.keys, {
      algorithms: ["RS256"],
      audience: options.projectId,
      issuer: `https://securetoken.google.com/${options.projectId}`,
      currentDate: new Date(options.now),
      requiredClaims: ["exp", "iat", "sub", "auth_time"],
      // Sem tolerância extra: o relógio de referência é o do backend.
      clockTolerance: 0,
    }));
    kid = protectedHeader.kid;
  } catch (error) {
    if (error instanceof errors.JWTExpired) throw new InvalidTokenError("expirado");
    if (error instanceof errors.JOSEError) throw new InvalidTokenError(error.code);
    throw error;
  }

  // O Firebase sempre informa o kid; token sem ele é recusado mesmo com uma só chave no conjunto.
  if (typeof kid !== "string" || kid.length === 0) throw new InvalidTokenError("kid");
  const sub = payload.sub;
  const iat = payload.iat;
  const authTime = payload.auth_time;
  if (typeof sub !== "string" || sub.length === 0 || sub.length > 128) {
    throw new InvalidTokenError("sub");
  }
  if (typeof iat !== "number" || iat > nowSeconds) throw new InvalidTokenError("iat");
  if (typeof authTime !== "number" || authTime > nowSeconds)
    throw new InvalidTokenError("auth_time");
  const email = payload.email;
  if (typeof email !== "string" || email.length === 0) throw new InvalidTokenError("email");

  return {
    uid: sub,
    email,
    emailVerified: payload.email_verified === true,
    authTime: authTime * 1000,
  };
}
