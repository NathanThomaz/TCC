import { z } from "zod";
import type { AtendimentoDto } from "../../../shared/api";
import { planejarAtendimento } from "../../../shared/dominio/agenda";
import { readJson } from "../../http/body";
import { AppError, conflict, notFound, validationFailed } from "../../http/errors";
import { beginIdempotent, recordStatement, replayAfterRace } from "../../http/idempotency";
import { json } from "../../http/responses";
import type { Handler, RequestContext } from "../../http/router";
import { isUnique, parse, triggerConflict } from "../comum";
import { abrirOperacao, camposValidos, lerCampos } from "./contexto";

// Agenda (seção 13 e ADR-002, item 3). Sobreposição por profissional, par coerente e transições
// de estado também são barrados no D1 (migration 0003). Nada muda sozinho pelo relógio: o início
// e a conclusão são registrados pelo usuário (AGE-08).

interface AtendimentoRow {
  id: string;
  customer_id: string;
  customer_name: string;
  professional_id: string;
  professional_name: string;
  service_type: string;
  start_at: number;
  end_at: number;
  status: AtendimentoDto["status"];
  pair_id: string | null;
  pair_position: 1 | 2 | null;
  sale_id: string | null;
  extra_json: string;
  cancel_reason: string | null;
}

const SELECT_ATENDIMENTO = `
  SELECT a.*, c.name AS customer_name, p.name AS professional_name FROM appointments a
  JOIN customers c ON c.id = a.customer_id AND c.system_id = a.system_id
  JOIN professionals p ON p.id = a.professional_id AND p.system_id = a.system_id`;

function publicAtendimento(row: AtendimentoRow, now: number): AtendimentoDto {
  return {
    id: row.id,
    cliente: row.customer_id,
    nomeCliente: row.customer_name,
    profissional: row.professional_id,
    nomeProfissional: row.professional_name,
    tipo: row.service_type,
    inicio: row.start_at,
    fim: row.end_at,
    status: row.status,
    atrasado: row.status === "scheduled" && row.start_at < now,
    par: row.pair_id,
    posicaoNoPar: row.pair_position,
    venda: row.sale_id,
    campos: lerCampos(row.extra_json),
    motivoCancelamento: row.cancel_reason,
  };
}

const instante = z.number().int().min(1).max(8_640_000_000_000);
const AgendarBody = z.object({
  cliente: z.string().min(1).max(100),
  profissional: z.string().min(1).max(100),
  tipo: z.string().min(2).max(40),
  inicio: instante,
  inicioSegundo: instante.optional(),
  venda: z.string().min(1).max(100).optional(),
  campos: z.unknown().optional(),
});
const RemarcarBody = z.object({ inicio: instante, inicioSegundo: instante.optional() });
const CancelarBody = z.object({ motivo: z.string().trim().min(3).max(300) });

const MENSAGENS = {
  conflito_agenda: "O profissional já tem atendimento nesse horário (AGE-05).",
  par_incoerente: "O par precisa do mesmo profissional, com o segundo depois do primeiro.",
  cadastro_inativo: "Cliente ou profissional inativo não recebe novos atendimentos.",
  atendimento_iniciado: "Atendimento já iniciado não é remarcado.",
  primeiro_nao_concluido:
    "Registre a conclusão do primeiro atendimento do par antes de iniciar o segundo.",
  retirada_preservada:
    "O primeiro atendimento do par já foi iniciado: o segundo é preservado e não pode ser cancelado (AGE-09).",
  transicao_de_status_invalida: "Este atendimento não está no estado que permite essa ação.",
};

async function carregarAtendimento(ctx: RequestContext, systemId: string, id: string) {
  const row = await ctx.env.DB.prepare(`${SELECT_ATENDIMENTO} WHERE a.id = ? AND a.system_id = ?`)
    .bind(id, systemId)
    .first<AtendimentoRow>();
  if (!row) throw notFound();
  return row;
}

async function carregarPar(ctx: RequestContext, systemId: string, pairId: string) {
  const { results } = await ctx.env.DB.prepare(
    `${SELECT_ATENDIMENTO} WHERE a.pair_id = ? AND a.system_id = ? ORDER BY a.pair_position`,
  )
    .bind(pairId, systemId)
    .all<AtendimentoRow>();
  return results;
}

/** Atendimento + o outro do par, quando houver. */
async function respostaAtendimento(
  ctx: RequestContext,
  systemId: string,
  id: string,
  status = 200,
) {
  const row = await carregarAtendimento(ctx, systemId, id);
  const rows = row.pair_id ? await carregarPar(ctx, systemId, row.pair_id) : [row];
  const now = ctx.clock.now();
  return json({ atendimentos: rows.map((r) => publicAtendimento(r, now)) }, { status });
}

export async function atendimentosDaVenda(
  ctx: RequestContext,
  systemId: string,
  saleId: string,
): Promise<AtendimentoDto[]> {
  const { results } = await ctx.env.DB.prepare(
    `${SELECT_ATENDIMENTO} WHERE a.sale_id = ? AND a.system_id = ? ORDER BY a.start_at`,
  )
    .bind(saleId, systemId)
    .all<AtendimentoRow>();
  const now = ctx.clock.now();
  return results.map((r) => publicAtendimento(r, now));
}

/** Lista por período (padrão: de hoje em diante, 31 dias) e, opcionalmente, por profissional. */
export const listarAgenda: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "agenda");
  const now = ctx.clock.now();
  const numero = (nome: string, padrao: number) => {
    const valor = ctx.url.searchParams.get(nome);
    if (valor === null || valor === "") return padrao;
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0) throw validationFailed(`Filtro ${nome} inválido.`);
    return n;
  };
  const de = numero("de", now - 24 * 3_600_000);
  const ate = numero("ate", de + 31 * 24 * 3_600_000);
  if (ate <= de || ate - de > 92 * 24 * 3_600_000) {
    throw validationFailed("Período inválido (máximo de 92 dias).");
  }
  const profissional = ctx.url.searchParams.get("profissional");
  const { results } = await ctx.env.DB.prepare(
    `${SELECT_ATENDIMENTO} WHERE a.system_id = ?1 AND a.start_at < ?3 AND a.end_at > ?2
       AND (?4 IS NULL OR a.professional_id = ?4)
     ORDER BY a.start_at LIMIT 500`,
  )
    .bind(op.systemId, de, ate, profissional)
    .all<AtendimentoRow>();
  return json({ atendimentos: results.map((r) => publicAtendimento(r, now)) });
};

/** AGE-01 a AGE-06: agenda um atendimento ou o par (mesmo profissional, segundo após o primeiro). */
export const agendar: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "agenda");
  const body = parse(AgendarBody, await readJson(ctx.request));
  const cmd = { scope: op.systemId, actorId: op.user.id, command: "agenda.create", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    return respostaAtendimento(ctx, op.systemId, started.resourceId, started.statusCode);
  }
  const now = ctx.clock.now();
  const plano = planejarAtendimento(op.config, body, now);
  if ("erro" in plano) throw new AppError(422, plano.erro.code, plano.erro.message);
  const extra = camposValidos(op.config, "agendamentos", body.campos);
  if (body.venda !== undefined) {
    if (!op.config.modulos.includes("vendas"))
      throw validationFailed("Este sistema não tem vendas.");
    const venda = await ctx.env.DB.prepare(
      "SELECT status FROM sales WHERE id = ? AND system_id = ?",
    )
      .bind(body.venda, op.systemId)
      .first<{ status: string }>();
    if (!venda) throw validationFailed("Venda não encontrada neste sistema.");
    if (venda.status !== "draft" && venda.status !== "completed") {
      throw conflict("Só venda em rascunho ou concluída recebe serviços vinculados.");
    }
  }

  const ids = plano.planos.map(() => crypto.randomUUID());
  const firstId = ids[0] ?? "";
  const pairId = plano.planos.length === 2 ? crypto.randomUUID() : null;
  const db = ctx.env.DB;
  try {
    await db.batch([
      ...plano.planos.map((p, index) =>
        db
          .prepare(
            `INSERT INTO appointments
               (id, system_id, customer_id, professional_id, service_type, start_at, end_at, pair_id, pair_position,
                sale_id, extra_json, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            ids[index] ?? "",
            op.systemId,
            body.cliente,
            body.profissional,
            p.tipo,
            p.intervalo.inicio,
            p.intervalo.fim,
            pairId,
            pairId ? index + 1 : null,
            body.venda ?? null,
            extra,
            op.user.id,
            now,
            now,
          ),
      ),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'agenda.created', 'atendimento', ?, ?)",
        )
        .bind(op.systemId, op.user.id, firstId, now),
      recordStatement(ctx, cmd, started, firstId, 201, now),
    ]);
  } catch (error) {
    if (isUnique(error)) {
      const replay = await replayAfterRace(ctx, cmd, started);
      if (replay?.kind === "replay") {
        return respostaAtendimento(ctx, op.systemId, replay.resourceId, replay.statusCode);
      }
    }
    if (error instanceof Error && /FOREIGN KEY/i.test(error.message)) {
      throw validationFailed("Cliente ou profissional não encontrado neste sistema.");
    }
    triggerConflict(error, MENSAGENS);
  }
  return respostaAtendimento(ctx, op.systemId, firstId, 201);
};

/**
 * AGE-07: remarcar revalida os horários; conflito preserva os anteriores (lote único). No par
 * ainda não iniciado, remarca-se pelo primeiro, informando os dois horários; iniciado o primeiro,
 * só o segundo pode ser remarcado, sempre depois do fim do primeiro. Durações já registradas
 * não mudam (seção 13).
 */
export const remarcar: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "agenda");
  const id = ctx.params.id ?? "";
  const body = parse(RemarcarBody, await readJson(ctx.request));
  const alvo = await carregarAtendimento(ctx, op.systemId, id);
  if (alvo.status !== "scheduled") throw conflict(MENSAGENS.atendimento_iniciado);
  const now = ctx.clock.now();
  if (body.inicio < now) {
    throw new AppError(422, "horario_no_passado", "Não é possível remarcar para o passado.");
  }
  const novo = (row: AtendimentoRow, inicio: number) => ({
    id: row.id,
    inicio,
    fim: inicio + (row.end_at - row.start_at),
  });

  let mudancas: { id: string; inicio: number; fim: number }[];
  if (!alvo.pair_id) {
    mudancas = [novo(alvo, body.inicio)];
  } else {
    const [primeiro, segundo] = await carregarPar(ctx, op.systemId, alvo.pair_id);
    if (!primeiro || !segundo) throw conflict(MENSAGENS.par_incoerente);
    if (alvo.pair_position === 1) {
      if (body.inicioSegundo === undefined) {
        throw new AppError(
          422,
          "segundo_horario_obrigatorio",
          "Informe também o novo horário do segundo atendimento do par.",
        );
      }
      const a = novo(primeiro, body.inicio);
      const b = novo(segundo, body.inicioSegundo);
      if (b.inicio < a.fim) {
        throw new AppError(
          422,
          "segundo_antes_do_fim",
          "O segundo atendimento começa depois do fim do primeiro.",
        );
      }
      mudancas = [a, b];
    } else {
      if (primeiro.status === "scheduled") {
        throw new AppError(
          409,
          "remarcar_pelo_primeiro",
          "Com o par ainda não iniciado, remarque pelo primeiro atendimento, com os dois horários.",
        );
      }
      if (body.inicio < primeiro.end_at) {
        throw new AppError(
          422,
          "segundo_antes_do_fim",
          "O segundo atendimento começa depois do fim do primeiro.",
        );
      }
      mudancas = [novo(segundo, body.inicio)];
    }
  }

  const db = ctx.env.DB;
  try {
    await db.batch([
      ...mudancas.map((m) =>
        db
          .prepare(
            `UPDATE appointments SET start_at = ?, end_at = ?, updated_at = max(updated_at, ?)
             WHERE id = ? AND system_id = ? AND status = 'scheduled'`,
          )
          .bind(m.inicio, m.fim, now, m.id, op.systemId),
      ),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, 'agenda.rescheduled', 'atendimento', ?, ?, ?)",
        )
        .bind(
          op.systemId,
          op.user.id,
          id,
          JSON.stringify({ antes: alvo.start_at, depois: body.inicio }),
          now,
        ),
    ]);
  } catch (error) {
    triggerConflict(error, MENSAGENS);
  }
  return respostaAtendimento(ctx, op.systemId, id);
};

/** Transição registrada pelo usuário: iniciar (scheduled → in_progress) ou concluir (→ done). */
function transicao(destino: "in_progress" | "done"): Handler {
  const origem = destino === "in_progress" ? "scheduled" : "in_progress";
  const coluna = destino === "in_progress" ? "started_at" : "done_at";
  return async (ctx) => {
    const op = await abrirOperacao(ctx, "agenda");
    const id = ctx.params.id ?? "";
    const atual = await carregarAtendimento(ctx, op.systemId, id);
    if (atual.status === destino) return respostaAtendimento(ctx, op.systemId, id);
    if (atual.status !== origem) throw conflict(MENSAGENS.transicao_de_status_invalida);
    const now = ctx.clock.now();
    const db = ctx.env.DB;
    try {
      await db.batch([
        db
          .prepare(
            `UPDATE appointments SET status = ?, ${coluna} = ?, updated_at = max(updated_at, ?)
             WHERE id = ? AND system_id = ? AND status = ?`,
          )
          .bind(destino, now, now, id, op.systemId, origem),
        db
          .prepare(
            "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) SELECT ?, ?, ?, 'atendimento', ?, ? WHERE changes() = 1",
          )
          .bind(
            op.systemId,
            op.user.id,
            destino === "in_progress" ? "agenda.started" : "agenda.done",
            id,
            now,
          ),
      ]);
    } catch (error) {
      triggerConflict(error, MENSAGENS);
    }
    return respostaAtendimento(ctx, op.systemId, id);
  };
}

export const iniciarAtendimento = transicao("in_progress");
export const concluirAtendimento = transicao("done");

/**
 * AGE-09: cancelar o par enquanto o primeiro não começou cancela os dois; iniciado o primeiro, o
 * segundo é preservado. CAN-07: atendimento sem venda tem cancelamento próprio.
 */
export const cancelarAtendimento: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "agenda");
  const id = ctx.params.id ?? "";
  const { motivo } = parse(CancelarBody, await readJson(ctx.request));
  const atual = await carregarAtendimento(ctx, op.systemId, id);
  if (atual.status === "cancelled") return respostaAtendimento(ctx, op.systemId, id);
  if (atual.status !== "scheduled") {
    throw conflict("Atendimento iniciado ou concluído não é cancelado.");
  }
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  const alvo = atual.pair_id
    ? db
        .prepare(
          `UPDATE appointments SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?,
             updated_at = max(updated_at, ?) WHERE pair_id = ? AND system_id = ? AND status = 'scheduled'`,
        )
        .bind(now, op.user.id, motivo, now, atual.pair_id, op.systemId)
    : db
        .prepare(
          `UPDATE appointments SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?,
             updated_at = max(updated_at, ?) WHERE id = ? AND system_id = ? AND status = 'scheduled'`,
        )
        .bind(now, op.user.id, motivo, now, id, op.systemId);
  try {
    await db.batch([
      alvo,
      db
        .prepare(
          `INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at)
           SELECT ?, ?, 'agenda.cancelled', 'atendimento', ?, json_object('motivo', ?), ? WHERE changes() >= 1`,
        )
        .bind(op.systemId, op.user.id, id, motivo, now),
    ]);
  } catch (error) {
    triggerConflict(error, MENSAGENS);
  }
  return respostaAtendimento(ctx, op.systemId, id);
};
