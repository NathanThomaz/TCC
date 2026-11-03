import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import type { PublicConfig } from "../../shared/api";

// O SDK web do Firebase é configurado com o que o Worker entrega em /api/v1/config (nada
// versionado). Sem configuração no ambiente, o login fica indisponível e a tela avisa.
let auth: Promise<Auth | null> | undefined;

export function obterAuth(fetcher: typeof fetch = fetch): Promise<Auth | null> {
  auth ??= fetcher("/api/v1/config")
    .then((r) => r.json() as Promise<PublicConfig>)
    .then((c) => (c.firebase ? getAuth(initializeApp(c.firebase)) : null))
    .catch(() => {
      auth = undefined; // permite tentar de novo
      return null;
    });
  return auth;
}
