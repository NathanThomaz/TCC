import type { SessionResponse } from "../../shared/api";
import { authenticate } from "../auth/session";
import type { Handler } from "../http/router";
import { json } from "../http/responses";

/** Identidade e papel vindos da sessão validada no backend (seção 7). */
export const getSession: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  const body: SessionResponse = { usuario: { id: user.id, email: user.email, papel: user.role } };
  return json(body);
};
