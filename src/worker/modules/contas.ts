import { z } from "zod";
import type { ContaDto, ContasApiBody } from "../../shared/api";
import { authenticate, requireAdmin, type AuthUser } from "../auth/session";
import { readJson } from "../http/body";
import { AppError, conflict, notFound, unavailable } from "../http/errors";
import { beginIdempotent, recordStatement, replayAfterRace } from "../http/idempotency";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import { isUnique, parse, triggerConflict } from "./comum";

// Contas secundárias mínimas (seção 7 e ADR-002, P0): o administrador convida por e-mail, define
// os sistemas que cada conta opera, revoga acessos e desativa contas. Não há cadastro público
// nem senha conhecida pelo administrador: o Firebase envia o link de definir senha (que também
// confirma o e-mail). Desativar bloqueia o login, invalida as sessões e revoga os acessos, então
// reativar exige revisar os acessos de novo (seção 7). Secundário nunca gerencia contas (T02).

interface ContaRow {
  id: string;
  email: string;
  display_name: string | null;
  status: ContaDto["status"];
  firebase_uid: string | null;
}

async function administrador(ctx: RequestContext): Promise<AuthUser> {
  const user = await authenticate(ctx, ctx.auth);
  requireAdmin(user);
  return user;
}

async function carregarConta(ctx: RequestContext, admin: AuthUser, id: string): Promise<ContaRow> {
  // Conta de outro administrador responde 404 (não revela que existe).
  const row = await ctx.env.DB.prepare(
    "SELECT id, email, display_name, status, firebase_uid FROM users WHERE id = ? AND owner_id = ? AND role = 'secondary'",
  )
    .bind(id, admin.id)
    .first<ContaRow>();
  if (!row) throw notFound();
  return row;
}

async function listar(ctx: RequestContext, admin: AuthUser, so?: string): Promise<ContaDto[]> {
  const db = ctx.env.DB;
  const { results: contas } = await db
    .prepare(
      `SELECT id, email, display_name, status, firebase_uid FROM users
       WHERE owner_id = ?1 AND role = 'secondary' AND (?2 IS NULL OR id = ?2)
       ORDER BY email COLLATE NOCASE LIMIT 200`,
    )
    .bind(admin.id, so ?? null)
    .all<ContaRow>();
  const { results: sistemas } = await db
    .prepare(
      "SELECT id, name FROM systems WHERE owner_id = ? AND status <> 'archived' ORDER BY created_at",
    )
    .bind(admin.id)
    .all<{ id: string; name: string }>();
  const { results: acessos } = await db
    .prepare(
      `SELECT a.user_id, a.system_id FROM system_access a JOIN users u ON u.id = a.user_id
       WHERE u.owner_id = ? AND a.status = 'active'`,
    )
    .bind(admin.id)
    .all<{ user_id: string; system_id: string }>();
  const ativos = new Set(acessos.map((a) => `${a.user_id}:${a.system_id}`));
  return contas.map((c) => ({
    id: c.id,
    email: c.email,
    nome: c.display_name,
    status: c.status,
    sistemas: sistemas.map((s) => ({
      id: s.id,
      nome: s.name,
      ativo: ativos.has(`${c.id}:${s.id}`),
    })),
  }));
}

async function uma(ctx: RequestContext, admin: AuthUser, id: string): Promise<ContaDto> {
  const [conta] = await listar(ctx, admin, id);
  if (!conta) throw notFound();
  return conta;
}

const conviteIndisponivel = () =>
  unavailable("O envio de convites não está configurado neste ambiente.");

export const listarContas: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const body: ContasApiBody = { contas: await listar(ctx, admin) };
  return json(body);
};

const ConviteBody = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  nome: z.string().trim().min(1).max(120).optional(),
  sistemas: z.array(z.string().min(1).max(100)).max(50).default([]),
});

/**
 * Convida uma conta secundária: grava a conta pendente e os vínculos, e depois pede ao Firebase o
 * link de definir senha. Se o envio falhar, a conta fica pendente e o convite pode ser reenviado.
 */
export const convidarConta: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const body = parse(ConviteBody, await readJson(ctx.request));
  const cmd = { scope: "global", actorId: admin.id, command: "conta.convidar", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    return json(
      { conta: await uma(ctx, admin, started.resourceId) },
      { status: started.statusCode },
    );
  }
  const contas = ctx.auth?.contas;
  if (!contas) throw conviteIndisponivel();

  const db = ctx.env.DB;
  const existente = await db
    .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .bind(body.email)
    .first<{ id: string }>();
  if (existente) throw new AppError(409, "email_em_uso", "Já existe uma conta com este e-mail.");

  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  const sistemas = [...new Set(body.sistemas)];
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO users (id, email, display_name, role, status, owner_id, created_at, updated_at)
           VALUES (?, ?, ?, 'secondary', 'pending', ?, ?, ?)`,
        )
        .bind(id, body.email, body.nome ?? null, admin.id, now, now),
      // O trigger system_access_coherent_insert recusa sistema de outro administrador.
      ...sistemas.map((s) =>
        db
          .prepare(
            "INSERT INTO system_access (user_id, system_id, status, granted_by, created_at, updated_at) VALUES (?, ?, 'active', ?, ?, ?)",
          )
          .bind(id, s, admin.id, now, now),
      ),
      db
        .prepare(
          `INSERT INTO audit_events (actor_id, action, target_type, target_id, details_json, created_at)
           VALUES (?, 'conta.convidada', 'user', ?, json_object('sistemas', ?), ?)`,
        )
        .bind(admin.id, id, sistemas.length, now),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind === "replay") {
      return json(
        { conta: await uma(ctx, admin, replay.resourceId) },
        { status: replay.statusCode },
      );
    }
    if (isUnique(error))
      throw new AppError(409, "email_em_uso", "Já existe uma conta com este e-mail.");
    if (error instanceof Error && /FOREIGN KEY/i.test(error.message)) {
      throw new AppError(422, "sistema_invalido", "Um dos sistemas não existe.");
    }
    triggerConflict(error, { acesso_incoerente: "Um dos sistemas não pertence a você." });
  }

  let conviteEnviado = true;
  try {
    await contas.invite(body.email);
  } catch (error) {
    conviteEnviado = false;
    ctx.log.warn("conta.convite_falhou", { error });
  }
  const resposta: ContasApiBody = { conta: await uma(ctx, admin, id), conviteEnviado };
  return json(resposta, { status: 201 });
};

/** Reenvia o link de definir senha a uma conta que ainda não fez o primeiro acesso. */
export const reenviarConvite: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const conta = await carregarConta(ctx, admin, ctx.params.id ?? "");
  if (conta.status !== "pending") throw conflict("Esta conta já fez o primeiro acesso.");
  const contas = ctx.auth?.contas;
  if (!contas) throw conviteIndisponivel();
  try {
    await contas.invite(conta.email);
  } catch (error) {
    ctx.log.warn("conta.convite_falhou", { error });
    throw unavailable("Não foi possível enviar o convite agora. Tente de novo.");
  }
  return json({ conta: await uma(ctx, admin, conta.id), conviteEnviado: true });
};

const AcessoBody = z.object({ sistema: z.string().min(1).max(100), ativo: z.boolean() });

/** Concede ou revoga o acesso a um sistema; revogado, a API e o histórico ficam bloqueados (T03). */
export const definirAcesso: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const conta = await carregarConta(ctx, admin, ctx.params.id ?? "");
  const { sistema, ativo } = parse(AcessoBody, await readJson(ctx.request));
  if (ativo && conta.status === "disabled") {
    throw conflict("Reative a conta antes de conceder acessos.");
  }
  const alvo = await ctx.env.DB.prepare("SELECT status FROM systems WHERE id = ? AND owner_id = ?")
    .bind(sistema, admin.id)
    .first<{ status: string }>();
  if (!alvo) throw notFound();
  if (ativo && alvo.status === "archived") throw conflict("Sistema arquivado não recebe acessos.");
  const db = ctx.env.DB;
  const now = ctx.clock.now();
  const status = ativo ? "active" : "revoked";
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO system_access (user_id, system_id, status, granted_by, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?5)
           ON CONFLICT (user_id, system_id) DO UPDATE SET status = ?3, updated_at = ?5
           WHERE system_access.status <> ?3`,
        )
        .bind(conta.id, sistema, status, admin.id, now),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) SELECT ?, ?, ?, 'user', ?, ? WHERE changes() = 1",
        )
        .bind(sistema, admin.id, ativo ? "acesso.concedido" : "acesso.revogado", conta.id, now),
    ]);
  } catch (error) {
    triggerConflict(error, { acesso_incoerente: "Este sistema não pertence a você." });
  }
  return json({ conta: await uma(ctx, admin, conta.id) });
};

const StatusBody = z.object({ status: z.enum(["active", "disabled"]) });

/**
 * Desativar: bloqueia o login (D1 e Firebase), invalida as sessões emitidas (valid_since) e revoga
 * todos os acessos. Reativar: volta a entrar, mas sem acessos até o administrador revisá-los; as
 * sessões antigas continuam inválidas. Recuperar a senha não reativa (seção 7).
 */
export const definirStatusConta: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const conta = await carregarConta(ctx, admin, ctx.params.id ?? "");
  const { status } = parse(StatusBody, await readJson(ctx.request));
  const db = ctx.env.DB;
  const now = ctx.clock.now();
  const contas = ctx.auth?.contas;

  if (status === "disabled") {
    if (conta.status !== "disabled") {
      // D1 primeiro: é ele que a API consulta em toda requisição, então o bloqueio vale já.
      await db.batch([
        db
          .prepare(
            `UPDATE users SET status = 'disabled', valid_since = max(COALESCE(valid_since, 0), ?),
               valid_since_checked_at = ?, updated_at = ? WHERE id = ?`,
          )
          .bind(now, now, now, conta.id),
        db
          .prepare(
            "UPDATE system_access SET status = 'revoked', updated_at = ? WHERE user_id = ? AND status = 'active'",
          )
          .bind(now, conta.id),
        db
          .prepare(
            "INSERT INTO audit_events (actor_id, action, target_type, target_id, created_at) VALUES (?, 'conta.desativada', 'user', ?, ?)",
          )
          .bind(admin.id, conta.id, now),
      ]);
      if (conta.firebase_uid && contas) {
        // Melhor esforço: o login já está bloqueado pelo D1; o Firebase só reforça.
        await contas.disable(conta.firebase_uid).catch((error: unknown) => {
          ctx.log.warn("conta.desativar_firebase_falhou", { error });
        });
      }
    }
    return json({ conta: await uma(ctx, admin, conta.id) });
  }

  if (conta.status === "disabled") {
    // Sem reativar no Firebase, a próxima consulta de revogação desativaria de novo.
    if (conta.firebase_uid) {
      if (!contas) throw conviteIndisponivel();
      try {
        await contas.enable(conta.firebase_uid);
      } catch (error) {
        ctx.log.warn("conta.reativar_firebase_falhou", { error });
        throw unavailable("Não foi possível reativar a conta agora. Tente de novo.");
      }
    }
    await db.batch([
      db
        .prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND status = 'disabled'")
        .bind(conta.firebase_uid ? "active" : "pending", now, conta.id),
      db
        .prepare(
          "INSERT INTO audit_events (actor_id, action, target_type, target_id, created_at) VALUES (?, 'conta.reativada', 'user', ?, ?)",
        )
        .bind(admin.id, conta.id, now),
    ]);
  }
  return json({ conta: await uma(ctx, admin, conta.id) });
};
