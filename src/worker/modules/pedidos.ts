import { z } from "zod";
import type { AssuntoDto, EstadoPedidoDto, PedidoDto } from "../../shared/api";
import { authenticate, requireAdmin, requireSystemAccess, type AuthUser } from "../auth/session";
import { readJson } from "../http/body";
import { conflict, notFound } from "../http/errors";
import {
  beginIdempotent,
  recordIfChanged,
  recordStatement,
  replayAfterRace,
} from "../http/idempotency";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import type { PedidoDesenvolvedorIa } from "../ia/prompts";
import { isUnique, parse } from "./comum";

// Pedidos ao desenvolvedor (ADR-004): o que o catálogo não cobre vira uma ficha com regra proposta,
// exemplos e critérios de aceite. A ficha não muda; o andamento fica no estado e no histórico. O
// dono acompanha, comenta e pode cancelar um pedido aberto; as demais decisões são do desenvolvedor.

interface PedidoRow {
  id: string;
  title: string;
  topic: AssuntoDto | null;
  origin: PedidoDto["origem"];
  original_request: string;
  context: string | null;
  proposed_rule: string | null;
  examples_json: string;
  acceptance_json: string;
  status: EstadoPedidoDto;
  created_at: number;
}

interface EventoRow {
  request_id: string;
  kind: "estado" | "comentario";
  status: EstadoPedidoDto | null;
  note: string | null;
  created_at: number;
}

const NOTA_INICIAL = "Pedido registrado para avaliação, sem previsão de implementação.";

export async function pedidosDoSistema(db: D1Database, systemId: string): Promise<PedidoDto[]> {
  const [pedidos, eventos] = await Promise.all([
    db
      .prepare(
        `SELECT id, title, topic, origin, original_request, context, proposed_rule, examples_json,
                acceptance_json, status, created_at
         FROM dev_requests WHERE system_id = ? ORDER BY created_at, id`,
      )
      .bind(systemId)
      .all<PedidoRow>(),
    db
      .prepare(
        `SELECT e.request_id, e.kind, e.status, e.note, e.created_at
         FROM dev_request_events e JOIN dev_requests r ON r.id = e.request_id
         WHERE r.system_id = ? ORDER BY e.created_at, e.rowid`,
      )
      .bind(systemId)
      .all<EventoRow>(),
  ]);
  return pedidos.results.map((p) => {
    const doPedido = eventos.results.filter((e) => e.request_id === p.id);
    return {
      id: p.id,
      titulo: p.title,
      assunto: p.topic,
      origem: p.origin,
      pedidoOriginal: p.original_request,
      contexto: p.context,
      regraProposta: p.proposed_rule,
      exemplos: JSON.parse(p.examples_json) as PedidoDto["exemplos"],
      criteriosAceite: JSON.parse(p.acceptance_json) as string[],
      estado: p.status,
      historico: doPedido
        .filter((e) => e.kind === "estado")
        .map((e) => ({ estado: e.status!, em: e.created_at, nota: e.note })),
      comentarios: doPedido
        .filter((e) => e.kind === "comentario")
        .map((e) => ({ texto: e.note!, em: e.created_at })),
      criadoEm: p.created_at,
    };
  });
}

/** Instruções que registram um pedido e o primeiro estado do histórico (no lote de quem chama). */
export function inserirPedido(
  db: D1Database,
  p: {
    id: string;
    systemId: string;
    userId: string;
    origem: PedidoDto["origem"];
    mensagem: string | null;
    titulo: string;
    assunto: AssuntoDto | null;
    pedidoOriginal: string;
    contexto: string | null;
    regraProposta: string | null;
    exemplos: PedidoDto["exemplos"];
    criteriosAceite: string[];
    now: number;
  },
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `INSERT INTO dev_requests
           (id, system_id, created_by, origin, origin_message_id, title, topic, original_request,
            context, proposed_rule, examples_json, acceptance_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        p.id,
        p.systemId,
        p.userId,
        p.origem,
        p.mensagem,
        p.titulo,
        p.assunto,
        p.pedidoOriginal,
        p.contexto,
        p.regraProposta,
        JSON.stringify(p.exemplos),
        JSON.stringify(p.criteriosAceite),
        p.now,
        p.now,
      ),
    db
      .prepare(
        `INSERT INTO dev_request_events (id, request_id, actor_id, kind, status, note, created_at)
         VALUES (?, ?, ?, 'estado', 'aberto', ?, ?)`,
      )
      .bind(crypto.randomUUID(), p.id, p.userId, NOTA_INICIAL, p.now),
  ];
}

/** Pedido que a IA registrou na conversa (a ficha completa vem dela). */
export function pedidoDaConversa(
  db: D1Database,
  ia: PedidoDesenvolvedorIa,
  c: { systemId: string; userId: string; mensagem: string; now: number },
): { id: string; instrucoes: D1PreparedStatement[] } {
  const id = crypto.randomUUID();
  return {
    id,
    instrucoes: inserirPedido(db, {
      id,
      systemId: c.systemId,
      userId: c.userId,
      origem: "conversa",
      mensagem: c.mensagem,
      titulo: ia.titulo,
      assunto: ia.assunto,
      pedidoOriginal: ia.pedido_original,
      contexto: ia.contexto,
      regraProposta: ia.regra_proposta,
      exemplos: ia.exemplos,
      criteriosAceite: ia.criterios_aceite,
      now: c.now,
    }),
  };
}

// ---- Rotas (/api/v1/systems/:systemId/pedidos), só do administrador ----

async function abrir(ctx: RequestContext): Promise<{ user: AuthUser; systemId: string }> {
  const user = await authenticate(ctx, ctx.auth);
  requireAdmin(user);
  const systemId = ctx.params.systemId ?? "";
  await requireSystemAccess(ctx.env.DB, user, systemId);
  return { user, systemId };
}

async function responder(ctx: RequestContext, systemId: string, id: string, status = 200) {
  const pedido = (await pedidosDoSistema(ctx.env.DB, systemId)).find((p) => p.id === id);
  if (!pedido) throw notFound();
  return json({ pedido }, { status });
}

export const listarPedidos: Handler = async (ctx) => {
  const { systemId } = await abrir(ctx);
  return json({ pedidos: await pedidosDoSistema(ctx.env.DB, systemId) });
};

const NovoPedido = z.object({
  titulo: z.string().trim().min(3).max(120),
  pedido: z.string().trim().min(3).max(2000),
});

/** Modo avançado: "Precisa de algo que não está aqui?" vira pedido com as palavras do dono. */
export const criarPedido: Handler = async (ctx) => {
  const { user, systemId } = await abrir(ctx);
  const body = parse(NovoPedido, await readJson(ctx.request));
  const cmd = { scope: systemId, actorId: user.id, command: "pedido.criar", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    return responder(ctx, systemId, started.resourceId, started.statusCode);
  }
  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    await db.batch([
      ...inserirPedido(db, {
        id,
        systemId,
        userId: user.id,
        origem: "formulario",
        mensagem: null,
        titulo: body.titulo,
        assunto: null,
        pedidoOriginal: body.pedido,
        contexto: null,
        regraProposta: null,
        exemplos: [],
        criteriosAceite: [],
        now,
      }),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind !== "replay") throw error;
    return responder(ctx, systemId, replay.resourceId, replay.statusCode);
  }
  return responder(ctx, systemId, id, 201);
};

async function exigirPedido(ctx: RequestContext, systemId: string): Promise<string> {
  const id = ctx.params.pedidoId ?? "";
  const row = await ctx.env.DB.prepare("SELECT id FROM dev_requests WHERE id = ? AND system_id = ?")
    .bind(id, systemId)
    .first<{ id: string }>();
  if (!row) throw notFound();
  return row.id;
}

const Comentario = z.object({ texto: z.string().trim().min(1).max(1000) });

export const comentarPedido: Handler = async (ctx) => {
  const { user, systemId } = await abrir(ctx);
  const body = parse(Comentario, await readJson(ctx.request));
  const id = await exigirPedido(ctx, systemId);
  const cmd = { scope: systemId, actorId: user.id, command: `pedido.comentar:${id}`, body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return responder(ctx, systemId, id, started.statusCode);
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO dev_request_events (id, request_id, actor_id, kind, status, note, created_at)
           VALUES (?, ?, ?, 'comentario', NULL, ?, ?)`,
        )
        .bind(crypto.randomUUID(), id, user.id, body.texto, now),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind !== "replay") throw error;
  }
  return responder(ctx, systemId, id, 201);
};

/** O dono desiste de um pedido ainda aberto; em análise ou decidido, a decisão é do desenvolvedor. */
export const cancelarPedido: Handler = async (ctx) => {
  const { user, systemId } = await abrir(ctx);
  const id = await exigirPedido(ctx, systemId);
  const body = {};
  const cmd = { scope: systemId, actorId: user.id, command: `pedido.cancelar:${id}`, body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return responder(ctx, systemId, id, started.statusCode);
  const db = ctx.env.DB;
  const naoAberto = () => conflict("Só um pedido aberto pode ser cancelado.");
  const atual = await db
    .prepare("SELECT status FROM dev_requests WHERE id = ?")
    .bind(id)
    .first<{ status: EstadoPedidoDto }>();
  if (atual?.status !== "aberto") throw naoAberto();
  const now = ctx.clock.now();
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE dev_requests SET status = 'cancelado', updated_at = max(updated_at, ?)
           WHERE id = ? AND system_id = ? AND status = 'aberto'`,
        )
        .bind(now, id, systemId),
      db
        .prepare(
          `INSERT INTO dev_request_events (id, request_id, actor_id, kind, status, note, created_at)
           SELECT ?, ?, ?, 'estado', 'cancelado', 'Cancelado por você.', ? WHERE changes() = 1`,
        )
        .bind(crypto.randomUUID(), id, user.id, now),
      recordIfChanged(ctx, cmd, started, id, 200, now),
    ]);
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind !== "replay") throw error;
    return responder(ctx, systemId, id, replay.statusCode);
  }
  // Entre a leitura e o lote o desenvolvedor pode ter mudado o estado: aí nada foi gravado.
  const pedido = (await pedidosDoSistema(db, systemId)).find((p) => p.id === id)!;
  if (pedido.estado !== "cancelado") throw naoAberto();
  return json({ pedido });
};
