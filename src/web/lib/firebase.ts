import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import type { PublicConfig } from "../../shared/api";

// O SDK web do Firebase é configurado com o que o Worker entrega em /api/v1/config (nada
// versionado). Sem configuração no ambiente, o login fica indisponível e a tela avisa.
let config: Promise<PublicConfig | null> | undefined;
let auth: Promise<Auth | null> | undefined;

export function obterConfig(fetcher: typeof fetch = fetch): Promise<PublicConfig | null> {
  config ??= fetcher("/api/v1/config")
    .then((r) => r.json() as Promise<PublicConfig>)
    .catch(() => {
      config = undefined; // permite tentar de novo
      return null;
    });
  return config;
}

export function obterAuth(fetcher: typeof fetch = fetch): Promise<Auth | null> {
  auth ??= obterConfig(fetcher).then((c) => {
    if (!c?.firebase) {
      auth = undefined;
      return null;
    }
    return getAuth(initializeApp(c.firebase));
  });
  return auth;
}
