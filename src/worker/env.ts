// Bindings e variáveis do Worker. Vars ficam no wrangler.jsonc; segredos via
// `wrangler secret put` (produção) ou `.dev.vars` (local) e nunca no Git.
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  APP_ENV: string;
}
