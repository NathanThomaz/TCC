import { createApp } from "./app";
import type { Env } from "./env";

const handle = createApp();

// Só /api/* chega aqui (run_worker_first no wrangler.jsonc); o resto é Static Assets.
export default {
  fetch(request, env) {
    return handle(request, env);
  },
} satisfies ExportedHandler<Env>;
