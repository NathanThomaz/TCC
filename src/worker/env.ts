// Bindings e variáveis do Worker. Vars ficam no wrangler.jsonc; segredos via
// `wrangler secret put` (produção) ou `.dev.vars` (local) e nunca no Git.
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  APP_ENV: string;
  /** Id do projeto Firebase (audiência do ID token). Ausente = autenticação indisponível. */
  FIREBASE_PROJECT_ID?: string;
  /** Configuração pública do SDK web (servida por /api/v1/config). */
  FIREBASE_WEB_API_KEY?: string;
  FIREBASE_AUTH_DOMAIN?: string;
  FIREBASE_APP_ID?: string;
  /** Segredo: JSON da conta de serviço (client_email, private_key), só para accounts:lookup. */
  FIREBASE_SERVICE_ACCOUNT?: string;
  /** Segredo: chave dedicada do Gemini para o Nexus (ADR-003). Ausente = chat indisponível. */
  GEMINI_API_KEY?: string;
  /** Teto mensal da IA em centavos de real (padrão 2000 = R$ 20, seção 21). */
  IA_TETO_MENSAL_CENTAVOS?: string;
  /** Limite mensal padrão de IA por conta, em centavos (padrão 300 = R$ 3); o dono não tem. */
  IA_LIMITE_CONTA_CENTAVOS?: string;
  /** "true": qualquer pessoa cria conta pela tela de entrada (com e-mail confirmado). */
  CADASTRO_ABERTO?: string;
}
