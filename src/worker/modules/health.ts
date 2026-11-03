import type { HealthResponse } from "../../shared/api";
import type { Handler } from "../http/router";
import { json } from "../http/responses";

/** Saúde do Worker e do D1; não expõe nada além do ambiente e do estado do banco. */
export const getHealth: Handler = async ({ env, clock, log }) => {
  let database: HealthResponse["checks"]["database"] = "ok";
  try {
    await env.DB.prepare("SELECT 1").first();
  } catch (error) {
    database = "error";
    log.error("health.database_failed", { error });
  }

  const body: HealthResponse = {
    status: database === "ok" ? "ok" : "degraded",
    environment: env.APP_ENV,
    time: new Date(clock.now()).toISOString(),
    checks: { database },
  };
  return json(body, { status: database === "ok" ? 200 : 503 });
};
