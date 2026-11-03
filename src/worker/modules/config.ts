import type { PublicConfig } from "../../shared/api";
import type { Handler } from "../http/router";
import { json } from "../http/responses";

/**
 * Configuração pública do front (sem autenticação): só o que o SDK web do Firebase precisa.
 * São valores públicos por natureza, mas ficam no ambiente do Worker — não no código — para
 * não versionar a chave web e permitir trocar de projeto sem novo build.
 */
export const getPublicConfig: Handler = ({ env }) => {
  const { FIREBASE_WEB_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID } = env;
  const firebase =
    FIREBASE_WEB_API_KEY && FIREBASE_AUTH_DOMAIN && FIREBASE_PROJECT_ID && FIREBASE_APP_ID
      ? {
          apiKey: FIREBASE_WEB_API_KEY,
          authDomain: FIREBASE_AUTH_DOMAIN,
          projectId: FIREBASE_PROJECT_ID,
          appId: FIREBASE_APP_ID,
        }
      : null;
  const body: PublicConfig = { environment: env.APP_ENV, firebase };
  return json(body);
};
