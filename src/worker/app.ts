import {
  createAccountLookup,
  parseServiceAccount,
  type AccountLookup,
} from "./auth/firebase-admin";
import { firebaseKeys, verifyFirebaseIdToken } from "./auth/firebase-token";
import type { RouterDeps } from "./http/router";
import { createRouter } from "./http/router";
import { systemClock } from "./lib/clock";
import { getHealth } from "./modules/health";
import {
  activateSystem,
  approveVersion,
  createSystem,
  createVersion,
  getSystem,
  listSystems,
} from "./modules/systems";

/** Base das rotas (seção 20): recursos de negócio ficam em `/api/v1/systems/:systemId/...`. */
export const API_BASE = "/api/v1";

// Uma consulta administrativa por isolate (guarda o token OAuth da conta de serviço).
let lookupCache: { key: string; lookup: AccountLookup } | undefined;

/**
 * Provedor real: exige o projeto Firebase E a conta de serviço. Sem a conta de serviço não há
 * como sincronizar a revogação externa, então a autenticação fica indisponível (fail closed).
 */
const firebaseAuth: NonNullable<RouterDeps["auth"]> = (env, clock) => {
  const projectId = env.FIREBASE_PROJECT_ID;
  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  if (!projectId || !serviceAccount) return undefined;
  const key = `${projectId}:${serviceAccount.client_email}`;
  if (lookupCache?.key !== key) {
    lookupCache = {
      key,
      lookup: createAccountLookup({
        projectId,
        serviceAccount,
        fetch: (input, init) => fetch(input, init),
        now: () => clock.now(),
      }),
    };
  }
  return {
    verify: (token) =>
      verifyFirebaseIdToken(token, { projectId, keys: firebaseKeys(), now: clock.now() }),
    lookup: lookupCache.lookup,
  };
};

/** Monta o app; `deps` permite fixar o relógio e o provedor de identidade nos testes. */
export function createApp(deps: RouterDeps = { clock: systemClock, auth: firebaseAuth }) {
  const S = `${API_BASE}/systems`;
  return createRouter(
    [
      { method: "GET", path: `${API_BASE}/health`, handler: getHealth },
      { method: "GET", path: S, handler: listSystems },
      { method: "POST", path: S, handler: createSystem },
      { method: "GET", path: `${S}/:systemId`, handler: getSystem },
      { method: "POST", path: `${S}/:systemId/versions`, handler: createVersion },
      {
        method: "POST",
        path: `${S}/:systemId/versions/:versionId/approve`,
        handler: approveVersion,
      },
      { method: "POST", path: `${S}/:systemId/activate`, handler: activateSystem },
    ],
    deps,
  );
}
