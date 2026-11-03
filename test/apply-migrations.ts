import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Seguro reexecutar: applyD1Migrations só aplica migrations ainda não aplicadas.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
