import { z } from "zod";
import type { ContaDto, ContasApiBody } from "../../shared/api";
import { authenticate, ehDonoDoNexus, requireAdmin, type AuthUser } from "../auth/session";
import { readJson } from "../http/body";
import { AppError, conflict, notFound, unavailable, validationFailed } from "../http/errors";
import { beginIdempotent, recordStatement, replayAfterRace } from "../http/idempotency";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import { isUnique, parse, triggerConflict } from "./comum";

// Contas secundárias mínimas (seção 7 e ADR-002, P0): o administrador cria a conta, define os
// sistemas que ela opera, revoga acessos e desativa contas. Não há cadastro público. Desde
// 2026-11-13 (pedido do dono), o administrador pode definir a senha e mandá-la à pessoa, sem
// validação por e-mail; o link de definir senha por e-mail continua como alternativa. O dono do
// Nexus (primeiro administrador) também cria administradores independentes, com dados próprios.
// Desativar bloqueia o login, invalida as sessões e revoga os acessos, então reativar exige
// revisar os acessos de novo (seção 7). Secundário nunca gerencia contas (T02).

interface ContaRow {
  id: string;
  email: string;
  role: ContaDto["papel"];
  display_name: string | null;
  status: ContaDto["status"];
  firebase_uid: string | null;
  invited_uid: string | null;
  invite_sent_at: number | null;
  provider_sync: "desativar" | "reativar" | null;
}

async function administrador(ctx: RequestContext): Promise<AuthUser> {
  const user = await authenticate(ctx, ctx.auth);
  requireAdmin(user);
  return user;
}

async function carregarConta(ctx: RequestContext, admin: AuthUser, id: string): Promise<ContaRow> {
  // Conta de outro administrador responde 404 (não revela que existe).
  const row = await ctx.env.DB.prepare(
    `SELECT id, email, role, display_name, status, firebase_uid, invited_uid, invite_sent_at, provider_sync
     FROM users WHERE id = ?1
       AND ((owner_id = ?2 AND role = 'secondary') OR (created_by = ?2 AND role = 'admin'))`,
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
      `SELECT id, email, role, display_name, status, firebase_uid FROM users
       WHERE ((owner_id = ?1 AND role = 'secondary') OR (created_by = ?1 AND role = 'admin'))
         AND (?2 IS NULL OR id = ?2)
       ORDER BY role DESC, email COLLATE NOCASE LIMIT 200`,
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
    papel: c.role,
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

/**
 * Pede o link de definir senha e grava que saiu (e o uid do Firebase, para poder desativar a conta
 * antes do primeiro acesso). Falha não desfaz a conta: ela fica pendente e o envio é retomado.
 */
async function enviarConvite(
  ctx: RequestContext,
  conta: { id: string; email: string },
): Promise<boolean> {
  const contas = ctx.auth?.contas;
  if (!contas) return false;
  try {
    const uid = await contas.invite(conta.email);
    await ctx.env.DB.prepare(
      "UPDATE users SET invited_uid = COALESCE(invited_uid, ?), invite_sent_at = ?, updated_at = max(updated_at, ?) WHERE id = ?",
    )
      .bind(uid, ctx.clock.now(), ctx.clock.now(), conta.id)
      .run();
    return true;
  } catch (error) {
    ctx.log.warn("conta.convite_falhou", { error });
    return false;
  }
}

/**
 * Cria o acesso no Firebase com a senha definida pelo administrador (e-mail dado como confirmado)
 * e grava o uid, para a conta poder ser desativada antes do primeiro acesso. A senha não é gravada.
 */
/** Tempo depois do qual uma reserva de provisionamento sem conclusão pode ser retomada. */
const RESERVA_MS = 2 * 60_000;

async function criarAcesso(
  ctx: RequestContext,
  conta: { id: string; email: string; display_name: string | null },
  senha: string,
): Promise<boolean> {
  const contas = ctx.auth?.contas;
  if (!contas) return false;
  const db = ctx.env.DB;
  const now = ctx.clock.now();
  // Reserva o provisionamento: só uma requisição cria o acesso por vez. Concluído = uid gravado
  // (invited_uid); reservado = invite_sent_at sem uid, que expira se a requisição morrer no meio.
  // Uma repetição atrasada encontra o acesso concluído e não sobrescreve senha definida depois.
  const reserva = await db
    .prepare(
      `UPDATE users SET invite_sent_at = ?1, updated_at = max(updated_at, ?1)
       WHERE id = ?2 AND status = 'pending' AND invited_uid IS NULL
         AND (invite_sent_at IS NULL OR invite_sent_at < ?1 - ${RESERVA_MS})`,
    )
    .bind(now, conta.id)
    .run();
  if (reserva.meta.changes !== 1) {
    const atual = await db
      .prepare("SELECT invited_uid FROM users WHERE id = ?")
      .bind(conta.id)
      .first<{ invited_uid: string | null }>();
    // Com uid, o acesso já existe; sem uid, outra requisição está criando agora.
    return (atual?.invited_uid ?? null) !== null;
  }
  const liberar = () =>
    db.prepare("UPDATE users SET invite_sent_at = NULL WHERE id = ?").bind(conta.id).run();
  try {
    const existente = await contas.findUid(conta.email);
    if (existente && (await uidDeOutraConta(ctx, existente, conta.id))) {
      await liberar();
      throw loginDeOutraConta();
    }
    const uid = await contas.createWithPassword(
      conta.email,
      senha,
      conta.display_name ?? undefined,
      existente,
    );
    await db
      .prepare(
        "UPDATE users SET invited_uid = COALESCE(invited_uid, ?), updated_at = max(updated_at, ?) WHERE id = ?",
      )
      .bind(uid, now, conta.id)
      .run();
    return true;
  } catch (error) {
    if (error instanceof AppError) throw error;
    ctx.log.warn("conta.acesso_falhou", { error });
    await liberar();
    return false;
  }
}

/** O uid do Firebase já pertence a outra conta do Nexus (vinculada ou convidada)? */
async function uidDeOutraConta(ctx: RequestContext, uid: string, conta: string | null) {
  const dono = await ctx.env.DB.prepare(
    "SELECT id FROM users WHERE (firebase_uid = ?1 OR invited_uid = ?1) AND (?2 IS NULL OR id <> ?2) LIMIT 1",
  )
    .bind(uid, conta)
    .first<{ id: string }>();
  return dono !== null;
}

/**
 * Com o cadastro aberto (ADR-009), qualquer pessoa vira administrador: um login do Firebase sem
 * vínculo com esta conta pode ser de alguém que se cadastrou e ainda não confirmou o e-mail. Só o
 * dono do Nexus reaproveita esse login (com senha nova ou link); os demais recebem 409.
 */
async function exigirLoginLivre(
  ctx: RequestContext,
  admin: AuthUser,
  email: string,
  uidDaConta: string | null,
) {
  const contas = ctx.auth?.contas;
  if (!contas || (await ehDonoDoNexus(ctx.env.DB, admin))) return;
  let existente: string | null;
  try {
    existente = await contas.findUid(email);
  } catch (error) {
    ctx.log.warn("conta.consulta_login_falhou", { error });
    throw unavailable("Não foi possível conferir o login agora. Tente de novo.");
  }
  if (existente && existente !== uidDaConta) {
    throw new AppError(
      409,
      "email_ja_tem_login",
      "Este e-mail já tem um login criado pela própria pessoa. Peça para ela entrar no Nexus com ele, ou use outro e-mail.",
    );
  }
}

const loginDeOutraConta = () =>
  new AppError(
    409,
    "email_em_uso",
    "Este e-mail já é o login de outra conta do Nexus. Use outro e-mail.",
  );

/**
 * Repetição do convite: se o acesso não saiu (falha ou interrupção), tenta de novo agora, com a
 * senha do próprio pedido (que nunca é gravada) ou, sem senha, pelo link por e-mail.
 */
async function respostaDoConvite(
  ctx: RequestContext,
  admin: AuthUser,
  id: string,
  status: number,
  senha?: string,
) {
  const conta = await carregarConta(ctx, admin, id);
  // Com senha, pronto é o acesso criado (uid gravado); sem senha, o link de e-mail ter saído.
  const pronto = senha ? conta.invited_uid !== null : conta.invite_sent_at !== null;
  if (!pronto && conta.status === "pending") {
    await exigirLoginLivre(ctx, admin, conta.email, conta.invited_uid);
  }
  const feito =
    pronto ||
    (conta.status === "pending" &&
      (senha ? await criarAcesso(ctx, conta, senha) : await enviarConvite(ctx, conta)));
  const body: ContasApiBody = {
    conta: await uma(ctx, admin, id),
    ...(senha ? { acessoCriado: feito } : { conviteEnviado: feito }),
  };
  return json(body, { status });
}

const conviteIndisponivel = () =>
  unavailable("O envio de convites não está configurado neste ambiente.");

export const listarContas: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const body: ContasApiBody = { contas: await listar(ctx, admin) };
  return json(body);
};

const senha = z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(128);
const ConviteBody = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  nome: z.string().trim().min(1).max(120).optional(),
  sistemas: z.array(z.string().min(1).max(100)).max(50).default([]),
  /** Senha definida pelo administrador; sem ela, vai o link de definir senha por e-mail. */
  senha: senha.optional(),
  papel: z.enum(["secondary", "admin"]).default("secondary"),
});

/**
 * Convida uma conta secundária: grava a conta pendente e os vínculos, e depois pede ao Firebase o
 * link de definir senha. Se o envio falhar, a conta fica pendente e o convite pode ser reenviado.
 */
export const convidarConta: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const body = parse(ConviteBody, await readJson(ctx.request));
  // A senha não entra no registro de idempotência (nem o hash dela): só o fato de ter sido definida.
  const cmd = {
    scope: "global",
    actorId: admin.id,
    command: "conta.convidar",
    body: { ...body, senha: body.senha ? "definida" : null },
  };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    return respostaDoConvite(ctx, admin, started.resourceId, started.statusCode, body.senha);
  }
  if (!ctx.auth?.contas) throw conviteIndisponivel();
  // Login do Firebase que já pertence a outra conta do Nexus não é reaproveitado (nem a senha dele
  // trocada): o e-mail no Firebase pode ter mudado sem o D1 saber.
  if (body.senha) {
    let existente: string | null;
    try {
      existente = await ctx.auth.contas.findUid(body.email);
    } catch (error) {
      ctx.log.warn("conta.consulta_login_falhou", { error });
      throw unavailable("Não foi possível conferir o login agora. Tente de novo.");
    }
    if (existente && (await uidDeOutraConta(ctx, existente, null))) throw loginDeOutraConta();
  }
  await exigirLoginLivre(ctx, admin, body.email, null);
  const novoAdmin = body.papel === "admin";
  if (novoAdmin) {
    if (!(await ehDonoDoNexus(ctx.env.DB, admin))) {
      throw new AppError(403, "so_o_dono", "Só o dono do Nexus cria administradores.");
    }
    if (body.sistemas.length) {
      throw validationFailed("Administrador independente tem os próprios sistemas, sem acessos.");
    }
  }

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
          `INSERT INTO users (id, email, display_name, role, status, owner_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        )
        .bind(
          id,
          body.email,
          body.nome ?? null,
          novoAdmin ? "admin" : "secondary",
          novoAdmin ? null : admin.id,
          admin.id,
          now,
          now,
        ),
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
           VALUES (?, ?, 'user', ?, json_object('sistemas', ?, 'papel', ?), ?)`,
        )
        .bind(
          admin.id,
          body.senha ? "conta.criada_com_senha" : "conta.convidada",
          id,
          sistemas.length,
          body.papel,
          now,
        ),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind === "replay") {
      return respostaDoConvite(ctx, admin, replay.resourceId, replay.statusCode, body.senha);
    }
    if (isUnique(error))
      throw new AppError(409, "email_em_uso", "Já existe uma conta com este e-mail.");
    if (error instanceof Error && /FOREIGN KEY/i.test(error.message)) {
      throw new AppError(422, "sistema_invalido", "Um dos sistemas não existe.");
    }
    triggerConflict(error, { acesso_incoerente: "Um dos sistemas não pertence a você." });
  }

  return respostaDoConvite(ctx, admin, id, 201, body.senha);
};

/** Define uma nova senha para a conta (esqueceu, ou o acesso ainda não tinha sido criado). */
export const definirSenha: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const conta = await carregarConta(ctx, admin, ctx.params.id ?? "");
  const nova = parse(z.object({ senha }), await readJson(ctx.request)).senha;
  if (conta.status === "disabled") throw conflict("Reative a conta antes de trocar a senha.");
  const contas = ctx.auth?.contas;
  if (!contas) throw conviteIndisponivel();
  const uid = await uidNoFirebase(ctx, conta.id);
  if (!uid) await exigirLoginLivre(ctx, admin, conta.email, null);
  try {
    if (uid) await contas.setPassword(uid, nova);
    else if (!(await criarAcesso(ctx, conta, nova))) throw new Error("acesso não criado");
  } catch (error) {
    if (error instanceof AppError) throw error;
    ctx.log.warn("conta.senha_falhou", { error });
    throw unavailable("Não foi possível trocar a senha agora. Tente de novo.");
  }
  const now = ctx.clock.now();
  await ctx.env.DB.prepare(
    "INSERT INTO audit_events (actor_id, action, target_type, target_id, created_at) VALUES (?, 'conta.senha_definida', 'user', ?, ?)",
  )
    .bind(admin.id, conta.id, now)
    .run();
  return json({ conta: await uma(ctx, admin, conta.id), acessoCriado: true });
};

/** Reenvia o link de definir senha a uma conta que ainda não fez o primeiro acesso. */
export const reenviarConvite: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const conta = await carregarConta(ctx, admin, ctx.params.id ?? "");
  if (conta.status !== "pending") throw conflict("Esta conta já fez o primeiro acesso.");
  if (!ctx.auth?.contas) throw conviteIndisponivel();
  await exigirLoginLivre(ctx, admin, conta.email, conta.invited_uid);
  if (!(await enviarConvite(ctx, conta))) {
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
  if (conta.role === "admin") {
    throw validationFailed("Administrador independente tem os próprios sistemas, sem acessos.");
  }
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
    triggerConflict(error, {
      acesso_incoerente: "Este sistema não pertence a você.",
      conta_desativada: "Reative a conta antes de conceder acessos.",
    });
  }
  return json({ conta: await uma(ctx, admin, conta.id) });
};

const StatusBody = z.object({ status: z.enum(["active", "disabled"]) });

/** uid atual no Firebase (relido: o primeiro acesso pode ter acabado de preenchê-lo). */
async function uidNoFirebase(ctx: RequestContext, id: string): Promise<string | null> {
  const row = await ctx.env.DB.prepare("SELECT firebase_uid, invited_uid FROM users WHERE id = ?")
    .bind(id)
    .first<{ firebase_uid: string | null; invited_uid: string | null }>();
  return row?.firebase_uid ?? row?.invited_uid ?? null;
}

/**
 * Leva a desativação ao Firebase e só então limpa a pendência. Falhou, a pendência fica e repetir a
 * desativação tenta de novo. Uma reativação que vier depois limpa a pendência e prevalece; se esta
 * chamada chegar atrasada ao Firebase, a conta volta a ser desativada na próxima consulta de
 * revogação (o desencontro sempre termina no lado seguro).
 */
async function sincronizarDesativacao(ctx: RequestContext, id: string) {
  const contas = ctx.auth?.contas;
  const uid = await uidNoFirebase(ctx, id);
  const limpar = () =>
    ctx.env.DB.prepare(
      "UPDATE users SET provider_sync = NULL WHERE id = ? AND status = 'disabled' AND provider_sync = 'desativar'",
    )
      .bind(id)
      .run();
  if (!uid) return limpar(); // ainda não existe conta no Firebase
  if (!contas) return;
  try {
    await contas.disable(uid);
    await limpar();
  } catch (error) {
    ctx.log.warn("conta.desativar_firebase_falhou", { error });
  }
}

/**
 * Desativar: bloqueia o login no D1 na hora (a API consulta toda requisição), invalida as sessões
 * emitidas até o fim do segundo corrente (o Firebase guarda o corte em segundos) e revoga os
 * acessos pelo trigger users_disabled_revokes_access; depois, desativa no Firebase. Reativar:
 * reativa no Firebase primeiro e volta sem acessos, para o administrador revisá-los. Recuperar a
 * senha não reativa (seção 7).
 */
export const definirStatusConta: Handler = async (ctx) => {
  const admin = await administrador(ctx);
  const conta = await carregarConta(ctx, admin, ctx.params.id ?? "");
  const { status } = parse(StatusBody, await readJson(ctx.request));
  const db = ctx.env.DB;
  const now = ctx.clock.now();

  if (status === "disabled") {
    if (conta.status !== "disabled") {
      const corte = Math.floor(now / 1000) * 1000 + 1000;
      await db.batch([
        db
          .prepare(
            `UPDATE users SET status = 'disabled', provider_sync = 'desativar',
               valid_since = max(COALESCE(valid_since, 0), ?), valid_since_checked_at = ?, updated_at = max(updated_at, ?)
             WHERE id = ? AND status <> 'disabled'`,
          )
          .bind(corte, now, now, conta.id),
        db
          .prepare(
            "INSERT INTO audit_events (actor_id, action, target_type, target_id, created_at) SELECT ?, 'conta.desativada', 'user', ?, ? WHERE changes() = 1",
          )
          .bind(admin.id, conta.id, now),
      ]);
    }
    const atual = await carregarConta(ctx, admin, conta.id);
    if (atual.provider_sync === "desativar") await sincronizarDesativacao(ctx, conta.id);
    return json({ conta: await uma(ctx, admin, conta.id) });
  }

  if (conta.status === "disabled") {
    // Sem reativar no Firebase, a próxima consulta de revogação desativaria de novo.
    const uid = await uidNoFirebase(ctx, conta.id);
    if (uid) {
      const contas = ctx.auth?.contas;
      if (!contas) throw conviteIndisponivel();
      try {
        await contas.enable(uid);
      } catch (error) {
        ctx.log.warn("conta.reativar_firebase_falhou", { error });
        throw unavailable("Não foi possível reativar a conta agora. Tente de novo.");
      }
    }
    await db.batch([
      db
        .prepare(
          `UPDATE users SET status = CASE WHEN firebase_uid IS NULL THEN 'pending' ELSE 'active' END,
             provider_sync = NULL, updated_at = max(updated_at, ?) WHERE id = ? AND status = 'disabled'`,
        )
        .bind(now, conta.id),
      db
        .prepare(
          "INSERT INTO audit_events (actor_id, action, target_type, target_id, created_at) SELECT ?, 'conta.reativada', 'user', ?, ? WHERE changes() = 1",
        )
        .bind(admin.id, conta.id, now),
    ]);
  }
  return json({ conta: await uma(ctx, admin, conta.id) });
};
