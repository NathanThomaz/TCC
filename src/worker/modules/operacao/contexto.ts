import type { SystemDto } from "../../../shared/api";
import type { FieldEntity, ModuleId } from "../../../shared/contract/catalog";
import type { ConfigDraft } from "../../../shared/contract/schema";
import { validarCampos } from "../../../shared/dominio/campos";
import { authenticate, requireSystemAccess, type AuthUser } from "../../auth/session";
import { AppError, conflict, validationFailed } from "../../http/errors";
import { json } from "../../http/responses";
import type { Handler, RequestContext } from "../../http/router";

// Operação de um sistema ativo (seção 4): telas e regras executam sobre a versão ATIVA da
// configuração, nunca sobre um rascunho. Só módulos ativos respondem; secundários operam os
// sistemas a que têm vínculo (requireSystemAccess), com as exceções conferidas em cada rota.

export interface Operacao {
  user: AuthUser;
  systemId: string;
  versionId: string;
  config: ConfigDraft;
}

export async function abrirOperacao(
  ctx: RequestContext,
  modulo: ModuleId | null,
): Promise<Operacao> {
  const user = await authenticate(ctx, ctx.auth);
  const systemId = ctx.params.systemId ?? "";
  const system = await requireSystemAccess(ctx.env.DB, user, systemId);
  if (system.status !== "active") {
    throw conflict("Este sistema ainda não foi ativado.");
  }
  const row = await ctx.env.DB.prepare(
    `SELECT v.id, v.config_json FROM systems s JOIN model_versions v ON v.id = s.active_version_id
     WHERE s.id = ?`,
  )
    .bind(systemId)
    .first<{ id: string; config_json: string }>();
  if (!row) throw conflict("Este sistema ainda não foi ativado.");
  const config = JSON.parse(row.config_json) as ConfigDraft;
  if (modulo !== null && !config.modulos.includes(modulo)) {
    throw new AppError(404, "modulo_indisponivel", "Este módulo não faz parte deste sistema.");
  }
  return { user, systemId, versionId: row.id, config };
}

/**
 * GET /systems/:id/app — abre a aplicação ativa: a configuração aprovada (módulos, campos,
 * aparência e regras) que as telas usam para se montar. Também para secundários autorizados.
 */
export const obterApp: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, null);
  const row = await ctx.env.DB.prepare(
    "SELECT id, name, status, active_version_id, created_at, updated_at FROM systems WHERE id = ?",
  )
    .bind(op.systemId)
    .first<{
      id: string;
      name: string;
      status: SystemDto["status"];
      active_version_id: string | null;
      created_at: number;
      updated_at: number;
    }>();
  if (!row) throw conflict("Este sistema ainda não foi ativado.");
  const sistema: SystemDto = {
    id: row.id,
    nome: row.name,
    status: row.status,
    versaoAtiva: row.active_version_id,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  };
  return json({ sistema, config: op.config, papel: op.user.role });
};

/** Campos informativos validados contra a configuração ativa, prontos para gravar em JSON. */
export function camposValidos(
  config: ConfigDraft,
  entidade: FieldEntity,
  valores: unknown,
): string {
  const resultado = validarCampos(config, entidade, valores);
  if ("erros" in resultado) {
    throw validationFailed(resultado.erros.map((e) => e.message).join(" "), {
      campos: resultado.erros.map((e) => e.campo),
    });
  }
  return JSON.stringify(resultado.valores);
}

export function lerCampos(extraJson: string): Record<string, string | number> {
  return JSON.parse(extraJson) as Record<string, string | number>;
}

/** Erro 409 com dados extras no corpo (faltas de estoque, serviços vinculados). */
export function conflitoComDados(
  ctx: Pick<RequestContext, "requestId" | "log">,
  code: string,
  message: string,
  dados: Record<string, unknown>,
): Response {
  ctx.log.info("request.failed", { code });
  return json({ error: { code, message, requestId: ctx.requestId }, ...dados }, { status: 409 });
}

/** Lista limitada a um conjunto de valores aceitos na query string (ex.: ?status=active). */
export function filtroDaQuery<T extends string>(
  url: URL,
  nome: string,
  aceitos: readonly T[],
): T | null {
  const valor = url.searchParams.get(nome);
  if (valor === null || valor === "") return null;
  if (!(aceitos as readonly string[]).includes(valor)) {
    throw validationFailed(`Filtro ${nome} inválido.`);
  }
  return valor as T;
}
