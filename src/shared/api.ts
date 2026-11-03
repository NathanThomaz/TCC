// Contratos HTTP compartilhados entre o Worker e o front.

/** Corpo de erro padronizado (seção 20 da especificação): sem detalhes internos nem segredos. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface HealthResponse {
  status: "ok" | "degraded";
  environment: string;
  time: string;
  checks: {
    database: "ok" | "error";
  };
}
