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

/** Verificador real: só existe quando o projeto Firebase está configurado no ambiente. */
const firebaseVerifier: NonNullable<RouterDeps["verifier"]> = (env, clock) => {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) return undefined;
  return (token) =>
    verifyFirebaseIdToken(token, { projectId, keys: firebaseKeys(), now: clock.now() });
};

/** Monta o app; `deps` permite fixar o relógio e o verificador de token nos testes. */
export function createApp(deps: RouterDeps = { clock: systemClock, verifier: firebaseVerifier }) {
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
