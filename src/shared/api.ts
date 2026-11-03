// Contratos HTTP compartilhados entre o Worker e o front.
import type { ConfigDraft } from "./contract/schema";

/** Corpo de erro padronizado (seção 20 da especificação): sem detalhes internos nem segredos. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface SystemDto {
  id: string;
  nome: string;
  status: "draft" | "active" | "archived";
  versaoAtiva: string | null;
  criadoEm: number;
  atualizadoEm: number;
}

export interface VersionDto {
  id: string;
  versao: number;
  hash: string;
  origem: "formulario" | "chat";
  status: "valid" | "invalid" | "approved" | "superseded";
  criadoEm: number;
}

export interface IssueDto {
  code: string;
  severity: "bloqueante" | "aviso";
  path: string;
  message: string;
}

/** Respostas de /api/v1/systems/... (cada rota preenche só os campos dela). */
export interface SystemsApiBody {
  sistema?: SystemDto;
  sistemas?: SystemDto[];
  versao?: VersionDto | null;
  versoes?: VersionDto[];
  /** Configuração da versão mais recente (só para o administrador), ponto de partida do assistente. */
  ultimaConfig?: ConfigDraft | null;
  issues?: IssueDto[];
  error?: ApiErrorBody["error"];
}

/** GET /api/v1/config — configuração pública do front. `firebase` nulo = login indisponível. */
export interface PublicConfig {
  environment: string;
  firebase: { apiKey: string; authDomain: string; projectId: string; appId: string } | null;
}

/** GET /api/v1/session — quem está logado, segundo o backend (nunca segundo o navegador). */
export interface SessionResponse {
  usuario: { id: string; email: string; papel: "admin" | "secondary" };
}

export interface HealthResponse {
  status: "ok" | "degraded";
  environment: string;
  time: string;
  checks: {
    database: "ok" | "error";
  };
}
