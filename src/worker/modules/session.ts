import { z } from "zod";
import type { SessionResponse } from "../../shared/api";
import { authenticate, ehDonoDoNexus } from "../auth/session";
import { readJson } from "../http/body";
import type { Handler, RequestContext } from "../http/router";
import { json } from "../http/responses";
import { parse } from "./comum";

async function resposta(ctx: RequestContext, user: Awaited<ReturnType<typeof authenticate>>) {
  const body: SessionResponse = {
    usuario: {
      id: user.id,
      email: user.email,
      papel: user.role,
      nome: user.nome,
      dono: await ehDonoDoNexus(ctx.env.DB, user),
    },
  };
  return json(body);
}

/** Identidade e papel vindos da sessão validada no backend (seção 7). */
export const getSession: Handler = async (ctx) => resposta(ctx, await authenticate(ctx, ctx.auth));

const PerfilBody = z.object({ nome: z.string().trim().min(1).max(120) });

/** PATCH /session — a pessoa ajusta o próprio nome (aparece na saudação e para o administrador). */
export const editarPerfil: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  const { nome } = parse(PerfilBody, await readJson(ctx.request));
  const now = ctx.clock.now();
  await ctx.env.DB.prepare(
    "UPDATE users SET display_name = ?, updated_at = max(updated_at, ?) WHERE id = ?",
  )
    .bind(nome, now, user.id)
    .run();
  return resposta(ctx, { ...user, nome });
};
