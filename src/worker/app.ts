import type { RouterDeps } from "./http/router";
import { createRouter } from "./http/router";
import { getHealth } from "./modules/health";

/** Base das rotas (seção 20): recursos de negócio ficam em `/api/v1/systems/:systemId/...`. */
export const API_BASE = "/api/v1";

/** Monta o app; `deps` permite fixar o relógio nos testes. */
export function createApp(deps?: RouterDeps) {
  return createRouter([{ method: "GET", path: `${API_BASE}/health`, handler: getHealth }], deps);
}
