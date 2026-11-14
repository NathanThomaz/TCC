import { z } from "zod";
import type { IssueDto } from "../../shared/api";
import {
  FIELD_ENTITIES,
  FIELD_TYPES,
  LIMITS,
  ROTULOS_CAMPOS,
  ROTULOS_CAMPOS_CHAVES,
  normalizarRotulo,
  type FieldEntity,
} from "../../shared/contract/catalog";
import type { ConfigDraft } from "../../shared/contract/schema";
import { compatibilidadeComAtiva, validateDraft } from "../../shared/contract/validate";
import { authenticate, requireAdmin, requireSystemAccess } from "../auth/session";
import { readJson } from "../http/body";
import { beginIdempotent, recordStatement, replayAfterRace } from "../http/idempotency";
import { AppError, conflict, validationFailed } from "../http/errors";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import { canonicalJson, sha256Hex } from "../lib/hash";
import { isUnique, parse } from "./comum";
import { versaoStatements } from "./systems";

// Colunas das telas de um sistema ativo (pedido do dono, 2026-11-14): o administrador renomeia
// uma coluna direto na tabela (só o visual) ou inclui uma coluna nova. Cada ajuste vira uma versão
// nova, só com o que soma à ativa (ADR-008), aprovada e aplicada de uma vez.

const entidade = z.enum(Object.keys(FIELD_ENTITIES) as [FieldEntity, ...FieldEntity[]]);
const ColunaBody = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("renomear"),
    /** Coluna padrão ("produtos.varejo") ou campo incluído ("campo:clientes:telefone"). */
    chave: z.string().min(3).max(100),
    rotulo: z.string().trim().min(1).max(40),
  }),
  z.object({
    acao: z.literal("incluir"),
    entidade,
    rotulo: z.string().trim().min(1).max(60),
    tipo: z.enum(FIELD_TYPES),
    opcoes: z.array(z.string().trim().min(1).max(60)).max(LIMITS.listOptions.max).optional(),
  }),
]);
type Ajuste = z.infer<typeof ColunaBody>;

/** Id do campo a partir do nome ("Placa do carro" → "placa_do_carro"), sem repetir na entidade. */
export function idDoCampo(rotulo: string, usados: readonly string[]): string {
  let base = normalizarRotulo(rotulo).replace(/ /g, "_").slice(0, 34);
  if (!/^[a-z]/.test(base)) base = `campo_${base}`.slice(0, 34);
  if (base.length < 2) base = "campo";
  let id = base;
  for (let n = 2; usados.includes(id); n++) id = `${base}_${n}`;
  return id;
}

function aplicar(config: ConfigDraft, ajuste: Ajuste): ConfigDraft {
  const nova = structuredClone(config);
  if (ajuste.acao === "incluir") {
    const usados = nova.campos.filter((c) => c.entidade === ajuste.entidade).map((c) => c.id);
    nova.campos.push({
      id: idDoCampo(ajuste.rotulo, usados),
      entidade: ajuste.entidade,
      rotulo: ajuste.rotulo,
      tipo: ajuste.tipo,
      ...(ajuste.tipo === "lista" ? { opcoes: ajuste.opcoes ?? [] } : {}),
      // Os registros que já existem não têm o valor: a coluna nova não pode ser obrigatória.
      obrigatorio: false,
    });
    return nova;
  }
  const campo = /^campo:([a-z]+):([a-z0-9_]+)$/.exec(ajuste.chave);
  if (campo) {
    const alvo = nova.campos.find((c) => c.entidade === campo[1] && c.id === campo[2]);
    if (!alvo) throw validationFailed("Esta coluna não existe neste sistema.");
    alvo.rotulo = ajuste.rotulo;
    return nova;
  }
  if (!(ROTULOS_CAMPOS_CHAVES as readonly string[]).includes(ajuste.chave)) {
    throw validationFailed("Esta coluna não pode ser renomeada.");
  }
  const chave = ajuste.chave as keyof typeof ROTULOS_CAMPOS;
  const rotulos = { ...nova.aparencia.rotulos_campos };
  // Voltar ao nome padrão apaga o ajuste (a tela usa o padrão).
  if (normalizarRotulo(ajuste.rotulo) === normalizarRotulo(ROTULOS_CAMPOS[chave].padrao)) {
    delete rotulos[chave];
  } else {
    rotulos[chave] = ajuste.rotulo;
  }
  nova.aparencia.rotulos_campos = rotulos;
  return nova;
}

const desatualizado = () =>
  new AppError(
    409,
    "versao_desatualizada",
    "O sistema foi alterado em outra tela. Recarregue e tente de novo.",
  );

/** POST /systems/:systemId/colunas — renomeia ou inclui uma coluna no sistema ativo. */
export const ajustarColuna: Handler = async (ctx) => {
  const user = await authenticate(ctx, ctx.auth);
  requireAdmin(user);
  const systemId = ctx.params.systemId ?? "";
  const system = await requireSystemAccess(ctx.env.DB, user, systemId);
  const ajuste = parse(ColunaBody, await readJson(ctx.request));
  const cmd = { scope: systemId, actorId: user.id, command: "coluna.ajustar", body: ajuste };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return resposta(ctx, systemId, started.statusCode);
  if (system.status !== "active") throw conflict("Só um sistema ativo tem colunas para ajustar.");

  const db = ctx.env.DB;
  const ativa = await db
    .prepare(
      `SELECT v.id, v.config_json FROM systems s JOIN model_versions v ON v.id = s.active_version_id
       WHERE s.id = ?`,
    )
    .bind(systemId)
    .first<{ id: string; config_json: string }>();
  if (!ativa) throw conflict("Este sistema ainda não foi ativado.");
  const atual = JSON.parse(ativa.config_json) as ConfigDraft;
  const proposta = aplicar(atual, ajuste);

  const resultado = validateDraft(proposta);
  const issues: IssueDto[] = resultado.draft
    ? [...resultado.issues, ...compatibilidadeComAtiva(atual, resultado.draft)]
    : resultado.issues;
  const bloqueio = issues.find((i) => i.severity === "bloqueante");
  if (!resultado.draft || bloqueio) {
    throw validationFailed(bloqueio?.message ?? "Ajuste inválido.");
  }

  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  const hash = await sha256Hex(canonicalJson(resultado.draft));
  try {
    await db.batch([
      ...(await versaoStatements(ctx, {
        id,
        systemId,
        userId: user.id,
        origem: "formulario",
        draft: resultado.draft,
        issues,
        now,
      })),
      db
        .prepare(
          "INSERT INTO approvals (id, system_id, model_version_id, hash, actor_id, decision, created_at) VALUES (?, ?, ?, ?, ?, 'approved', ?)",
        )
        .bind(crypto.randomUUID(), systemId, id, hash, user.id, now),
      db
        .prepare("UPDATE model_versions SET status = 'approved' WHERE id = ? AND status = 'valid'")
        .bind(id),
      // Aplica só se a ativa ainda for a que foi ajustada (outra troca no meio recusa).
      db
        .prepare(
          `UPDATE systems SET active_version_id = ?, updated_at = ?
           WHERE id = ? AND status = 'active' AND active_version_id = ?`,
        )
        .bind(id, now, systemId, ativa.id),
      // Sem troca, desfaz o lote inteiro (action NULL viola o NOT NULL): nada fica gravado.
      db
        .prepare(
          `INSERT INTO audit_events (system_id, action, created_at)
           SELECT ?, NULL, ? WHERE changes() = 0`,
        )
        .bind(systemId, now),
      db
        .prepare(
          `INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at)
           VALUES (?, ?, 'system.coluna', 'model_version', ?, json_object('acao', ?), ?)`,
        )
        .bind(systemId, user.id, id, ajuste.acao, now),
      recordStatement(ctx, cmd, started, id, 200, now),
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      /NOT NULL constraint failed: audit_events\.action/.test(error.message)
    ) {
      // A mesma operação (mesma chave) pode ter sido aplicada pela requisição gêmea.
      const replay = await replayAfterRace(ctx, cmd, started);
      if (replay?.kind === "replay") return resposta(ctx, systemId, replay.statusCode);
      throw desatualizado();
    }
    if (!isUnique(error)) throw error;
    const replay = await replayAfterRace(ctx, cmd, started);
    if (replay?.kind === "replay") return resposta(ctx, systemId, replay.statusCode);
    throw desatualizado();
  }
  return resposta(ctx, systemId, 200);
};

async function resposta(ctx: RequestContext, systemId: string, status: number) {
  const row = await ctx.env.DB.prepare(
    `SELECT v.config_json FROM systems s JOIN model_versions v ON v.id = s.active_version_id
     WHERE s.id = ?`,
  )
    .bind(systemId)
    .first<{ config_json: string }>();
  return json({ config: row ? (JSON.parse(row.config_json) as ConfigDraft) : null }, { status });
}
