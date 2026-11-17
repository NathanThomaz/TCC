import { z } from "zod";
import type { AssuntoDto, EstadoPedidoDto, PedidoDto, PedidoGeralDto } from "../../shared/api";
import { topicoGravado } from "../../shared/api";
import {
  authenticate,
  ehDonoDoNexus,
  requireAdmin,
  requireSystemAccess,
  type AuthUser,
} from "../auth/session";
import { readJson } from "../http/body";
import { AppError, conflict, notFound } from "../http/errors";
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
  system_id: string;
  created_by: string;
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

interface PedidoGeralRow extends PedidoRow {
  system_name: string;
  requester_email: string;
  requester_name: string | null;
}

interface EventoRow {
  request_id: string;
  actor_id: string | null;
  kind: "estado" | "comentario";
  status: EstadoPedidoDto | null;
  note: string | null;
  created_at: number;
}

const NOTA_INICIAL = "Pedido registrado para avaliação, sem previsão de implementação.";

const COLUNAS = `r.id, r.system_id, r.created_by, r.title, r.topic, r.origin, r.original_request,
  r.context, r.proposed_rule, r.examples_json, r.acceptance_json, r.status, r.created_at`;

/** Id do dono do Nexus (o desenvolvedor), mesmo critério de ehDonoDoNexus. */
async function idDoDesenvolvedor(db: D1Database): Promise<string | null> {
  const dono = await db
    .prepare(
      "SELECT id FROM users WHERE role = 'admin' AND created_by IS NULL AND self_signup = 0 ORDER BY created_at, rowid LIMIT 1",
    )
    .first<{ id: string }>();
  return dono?.id ?? null;
}

function montar(p: PedidoRow, eventos: EventoRow[], desenvolvedor: string | null): PedidoDto {
  const doPedido = eventos.filter((e) => e.request_id === p.id);
  // Resposta do desenvolvedor: comentário do dono do Nexus num pedido que não é dele.
  const doDesenvolvedor = (e: EventoRow) =>
    e.actor_id !== null && e.actor_id === desenvolvedor && e.actor_id !== p.created_by;
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
      .map((e) => ({ texto: e.note!, em: e.created_at, doDesenvolvedor: doDesenvolvedor(e) })),
    criadoEm: p.created_at,
  };
}

export async function pedidosDoSistema(db: D1Database, systemId: string): Promise<PedidoDto[]> {
  const [pedidos, eventos, desenvolvedor] = await Promise.all([
    db
      .prepare(
        `SELECT ${COLUNAS} FROM dev_requests r WHERE r.system_id = ? ORDER BY r.created_at, r.id`,
      )
      .bind(systemId)
      .all<PedidoRow>(),
    db
      .prepare(
        `SELECT e.request_id, e.actor_id, e.kind, e.status, e.note, e.created_at
         FROM dev_request_events e JOIN dev_requests r ON r.id = e.request_id
         WHERE r.system_id = ? ORDER BY e.created_at, e.rowid`,
      )
      .bind(systemId)
      .all<EventoRow>(),
    idDoDesenvolvedor(db),
  ]);
  return pedidos.results.map((p) => montar(p, eventos.results, desenvolvedor));
}

/** Todos os pedidos de todos os sistemas, do mais novo ao mais antigo (só o desenvolvedor). */
async function todosOsPedidos(db: D1Database): Promise<PedidoGeralDto[]> {
  const [pedidos, eventos, desenvolvedor] = await Promise.all([
    db
      .prepare(
        `SELECT ${COLUNAS}, s.name AS system_name, u.email AS requester_email,
                u.display_name AS requester_name
         FROM dev_requests r
         JOIN systems s ON s.id = r.system_id AND s.deleted_at IS NULL
         JOIN users u ON u.id = r.created_by
         ORDER BY r.created_at DESC, r.id`,
      )
      .all<PedidoGeralRow>(),
    db
      .prepare(
        `SELECT request_id, actor_id, kind, status, note, created_at
         FROM dev_request_events ORDER BY created_at, rowid`,
      )
      .all<EventoRow>(),
    idDoDesenvolvedor(db),
  ]);
  return pedidos.results.map((p) => ({
    ...montar(p, eventos.results, desenvolvedor),
    sistema: { id: p.system_id, nome: p.system_name },
    pedidoPor: { nome: p.requester_name, email: p.requester_email },
  }));
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
        p.assunto ? topicoGravado(p.assunto) : null,
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

// ---- Rotas do desenvolvedor (/api/v1/pedidos), só o dono do Nexus ----
// Ele vê os pedidos de todas as contas, decide o andamento (em análise, implementado ou recusado)
// e responde com comentários; quem pediu vê tudo na página de pedidos do sistema.

const ESCOPO_DESENVOLVEDOR = "global";

async function exigirDesenvolvedor(ctx: RequestContext): Promise<AuthUser> {
  const user = await authenticate(ctx, ctx.auth);
  if (!(await ehDonoDoNexus(ctx.env.DB, user))) {
    throw new AppError(403, "so_o_dono", "Só o dono do Nexus vê os pedidos de todas as contas.");
  }
  return user;
}

async function responderGeral(ctx: RequestContext, id: string, status = 200) {
  const pedido = (await todosOsPedidos(ctx.env.DB)).find((p) => p.id === id);
  if (!pedido) throw notFound();
  return json({ pedido }, { status });
}

async function exigirPedidoGeral(
  ctx: RequestContext,
): Promise<{ id: string; status: EstadoPedidoDto }> {
  const row = await ctx.env.DB.prepare("SELECT id, status FROM dev_requests WHERE id = ?")
    .bind(ctx.params.pedidoId ?? "")
    .first<{ id: string; status: EstadoPedidoDto }>();
  if (!row) throw notFound();
  return row;
}

export const listarTodosPedidos: Handler = async (ctx) => {
  await exigirDesenvolvedor(ctx);
  return json({ pedidos: await todosOsPedidos(ctx.env.DB) });
};

/** Transições do desenvolvedor: as do trigger da 0006, menos o cancelamento (que é do dono). */
const PROXIMOS: Partial<Record<EstadoPedidoDto, EstadoPedidoDto[]>> = {
  aberto: ["em_analise", "implementado", "recusado"],
  em_analise: ["implementado", "recusado"],
};

const MudancaEstado = z.object({
  estado: z.enum(["em_analise", "implementado", "recusado"]),
  nota: z.string().trim().min(1).max(1000).optional(),
});

export const mudarEstadoPedido: Handler = async (ctx) => {
  const user = await exigirDesenvolvedor(ctx);
  const body = parse(MudancaEstado, await readJson(ctx.request));
  const atual = await exigirPedidoGeral(ctx);
  const id = atual.id;
  const cmd = {
    scope: ESCOPO_DESENVOLVEDOR,
    actorId: user.id,
    command: `pedido.estado:${id}`,
    body,
  };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return responderGeral(ctx, id, started.statusCode);
  const invalida = () =>
    conflict("Esse pedido não pode ir para esse estado. Atualize a página e confira o estado.");
  if (!PROXIMOS[atual.status]?.includes(body.estado)) throw invalida();
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  let mudou: boolean;
  try {
    const [update] = await db.batch([
      db
        .prepare(
          `UPDATE dev_requests SET status = ?, updated_at = max(updated_at, ?)
           WHERE id = ? AND status = ?`,
        )
        .bind(body.estado, now, id, atual.status),
      db
        .prepare(
          `INSERT INTO dev_request_events (id, request_id, actor_id, kind, status, note, created_at)
           SELECT ?, ?, ?, 'estado', ?, ?, ? WHERE changes() = 1`,
        )
        .bind(crypto.randomUUID(), id, user.id, body.estado, body.nota ?? null, now),
      recordIfChanged(ctx, cmd, started, id, 200, now),
    ]);
    mudou = (update?.meta.changes ?? 0) === 1;
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind !== "replay") throw error;
    return responderGeral(ctx, id, replay.statusCode);
  }
  // Entre a leitura e o lote o estado mudou (outra mudança ou o cancelamento de quem pediu): nada
  // desta requisição foi gravado. Se foi a mesma chave repetida em paralelo, responde como ela.
  if (!mudou) {
    const replay = await replayAfterRace(ctx, cmd, started);
    if (replay?.kind === "replay") return responderGeral(ctx, id, replay.statusCode);
    throw invalida();
  }
  return responderGeral(ctx, id);
};

export const comentarComoDesenvolvedor: Handler = async (ctx) => {
  const user = await exigirDesenvolvedor(ctx);
  const body = parse(Comentario, await readJson(ctx.request));
  const { id } = await exigirPedidoGeral(ctx);
  const cmd = {
    scope: ESCOPO_DESENVOLVEDOR,
    actorId: user.id,
    command: `pedido.responder:${id}`,
    body,
  };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return responderGeral(ctx, id, started.statusCode);
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
  return responderGeral(ctx, id, 201);
};
