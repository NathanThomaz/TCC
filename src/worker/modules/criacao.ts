import { z } from "zod";
import type {
  CriacaoApiBody,
  IssueDto,
  MensagemDto,
  RequisitoDto,
  VersionDto,
} from "../../shared/api";
import { LIMITS } from "../../shared/contract/catalog";
import { configDraftGeminiSchema } from "../../shared/contract/gemini-schema";
import type { ConfigDraft } from "../../shared/contract/schema";
import { validateDraft } from "../../shared/contract/validate";
import { authenticate, requireAdmin, requireSystemAccess, type AuthUser } from "../auth/session";
import { readJson } from "../http/body";
import { AppError, conflict, notFound } from "../http/errors";
import {
  beginIdempotent,
  recordStatement,
  replayAfterRace,
  type IdempotencyOutcome,
  type IdempotentCommand,
} from "../http/idempotency";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import type { PedidoIa } from "../ia/gemini";
import { chamarComOrcamento, iaNaoConfigurada } from "../ia/orcamento";
import {
  instrucoesCorrecao,
  instrucoesLevantamento,
  instrucoesModelagem,
  levantamentoGeminiSchema,
  LevantamentoSchema,
  pedidoCorrecao,
  type Levantamento,
} from "../ia/prompts";
import { isUnique, parse, triggerCode } from "./comum";
import { versaoStatements } from "./systems";

// Criação por conversa (seção 8). A IA conversa, extrai requisitos e propõe a configuração; o
// usuário confirma cada requisito (a IA nunca confirma), pede a geração e, se houver erro, pede a
// correção (T08). Toda configuração passa pelo mesmo validador do formulário e vira uma versão
// comum (T33), aprovada e ativada pelo mesmo fluxo. Falha ou limite da IA não apaga nada (T30).

const HISTORICO = 20;

interface Contexto {
  user: AuthUser;
  systemId: string;
  nome: string;
  status: "draft" | "active" | "archived";
}

async function abrir(ctx: RequestContext): Promise<Contexto> {
  const user = await authenticate(ctx, ctx.auth);
  // Chat de criação é só do administrador (seção 15).
  requireAdmin(user);
  const systemId = ctx.params.systemId ?? "";
  const system = await requireSystemAccess(ctx.env.DB, user, systemId);
  const row = await ctx.env.DB.prepare("SELECT name FROM systems WHERE id = ?")
    .bind(systemId)
    .first<{ name: string }>();
  return { user, systemId, nome: row?.name ?? "", status: system.status };
}

function exigirRascunho(c: Contexto) {
  if (c.status !== "draft") {
    throw conflict("A criação por conversa vale para sistemas em rascunho.");
  }
}

// ---- Leitura do estado ----

interface MensagemRow {
  id: string;
  role: MensagemDto["papel"];
  content: string;
  data_json: string;
  created_at: number;
}

interface RequisitoRow {
  code: string;
  text: string;
  status: RequisitoDto["status"];
  origin: RequisitoDto["origem"];
}

async function conversa(ctx: RequestContext, c: Contexto): Promise<string> {
  const db = ctx.env.DB;
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO conversations (id, system_id, user_id, kind, created_at) VALUES (?, ?, ?, 'criacao', ?)",
      )
      .bind(crypto.randomUUID(), c.systemId, c.user.id, ctx.clock.now()),
    db.prepare("INSERT OR IGNORE INTO creation_state (system_id) VALUES (?)").bind(c.systemId),
  ]);
  const row = await db
    .prepare(
      "SELECT id FROM conversations WHERE system_id = ? AND user_id = ? AND kind = 'criacao'",
    )
    .bind(c.systemId, c.user.id)
    .first<{ id: string }>();
  if (!row) throw notFound();
  return row.id;
}

async function mensagens(ctx: RequestContext, conversaId: string): Promise<MensagemDto[]> {
  const { results } = await ctx.env.DB.prepare(
    "SELECT id, role, content, data_json, created_at FROM messages WHERE conversation_id = ? ORDER BY seq",
  )
    .bind(conversaId)
    .all<MensagemRow>();
  return results.map((m) => {
    const dados = JSON.parse(m.data_json) as { perguntas?: string[]; foraDoCatalogo?: string[] };
    return {
      id: m.id,
      papel: m.role,
      texto: m.content,
      perguntas: dados.perguntas ?? [],
      foraDoCatalogo: dados.foraDoCatalogo ?? [],
      criadoEm: m.created_at,
    };
  });
}

async function requisitosVivos(ctx: RequestContext, systemId: string): Promise<RequisitoDto[]> {
  const { results } = await ctx.env.DB.prepare(
    `SELECT code, text, status, origin FROM requirements
     WHERE system_id = ? AND status <> 'substituido' ORDER BY length(code), code`,
  )
    .bind(systemId)
    .all<RequisitoRow>();
  return results.map((r) => ({
    codigo: r.code,
    texto: r.text,
    status: r.status,
    origem: r.origin,
  }));
}

async function ultimaVersao(ctx: RequestContext, systemId: string) {
  const db = ctx.env.DB;
  const v = await db
    .prepare(
      "SELECT id, version, hash, origin, status, created_at, config_json FROM model_versions WHERE system_id = ? ORDER BY version DESC LIMIT 1",
    )
    .bind(systemId)
    .first<{
      id: string;
      version: number;
      hash: string;
      origin: VersionDto["origem"];
      status: VersionDto["status"];
      created_at: number;
      config_json: string;
    }>();
  if (!v) return { versao: null, issues: [] as IssueDto[], draft: null };
  const run = await db
    .prepare(
      "SELECT issues_json FROM validation_runs WHERE model_version_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(v.id)
    .first<{ issues_json: string }>();
  const versao: VersionDto = {
    id: v.id,
    versao: v.version,
    hash: v.hash,
    origem: v.origin,
    status: v.status,
    criadoEm: v.created_at,
  };
  return {
    versao,
    issues: run ? (JSON.parse(run.issues_json) as IssueDto[]) : [],
    draft: JSON.parse(v.config_json) as ConfigDraft,
  };
}

// ---- Revisão do estado: nada é gravado sobre um estado que mudou enquanto a IA respondia ----

async function revisaoAtual(ctx: RequestContext, systemId: string): Promise<number> {
  const row = await ctx.env.DB.prepare("SELECT revision FROM creation_state WHERE system_id = ?")
    .bind(systemId)
    .first<{ revision: number }>();
  return row?.revision ?? 0;
}

const estadoAlterado = () =>
  new AppError(
    409,
    "estado_alterado",
    "Os requisitos mudaram em outra tela enquanto isto era feito. Nada foi gravado: confira e tente de novo.",
  );

/** Primeiro (rápido): a revisão que o usuário viu ainda é a atual? */
async function exigirRevisao(ctx: RequestContext, c: Contexto, esperada: number) {
  if ((await revisaoAtual(ctx, c.systemId)) !== esperada) throw estadoAlterado();
}

/**
 * Depois (atômico): a mesma conferência dentro do lote. O trigger creation_state_revision recusa se
 * outra gravação passou na frente, e creation_state_only_draft se o sistema deixou de ser rascunho.
 */
function guarda(db: D1Database, systemId: string, esperada: number): D1PreparedStatement {
  return db
    .prepare("UPDATE creation_state SET revision = ? WHERE system_id = ?")
    .bind(esperada + 1, systemId);
}

/** Lote recusado: repetição da mesma chave devolve o resultado; guardas viram 409 claros. */
async function falhaDoLote(
  ctx: RequestContext,
  c: Contexto,
  error: unknown,
  idem?: { cmd: IdempotentCommand; started: Extract<IdempotencyOutcome, { kind: "new" }> },
): Promise<Response> {
  if (idem) {
    const replay = await replayAfterRace(ctx, idem.cmd, idem.started);
    if (replay?.kind === "replay") return estado(ctx, c, replay.statusCode);
  }
  const codigo = triggerCode(error, ["estado_alterado", "sistema_nao_rascunho"]);
  if (codigo === "estado_alterado") throw estadoAlterado();
  if (codigo === "sistema_nao_rascunho") {
    throw conflict("O sistema foi ativado; a criação por conversa não altera mais nada.");
  }
  if (isUnique(error)) throw estadoAlterado();
  throw error;
}

async function estado(ctx: RequestContext, c: Contexto, status = 200): Promise<Response> {
  const conversaId = await conversa(ctx, c);
  const { versao, issues } = await ultimaVersao(ctx, c.systemId);
  const body: CriacaoApiBody = {
    revisao: await revisaoAtual(ctx, c.systemId),
    mensagens: await mensagens(ctx, conversaId),
    requisitos: await requisitosVivos(ctx, c.systemId),
    iaDisponivel: ctx.ia !== undefined,
    versao,
    issues,
  };
  return json(body, { status });
}

export const obterCriacao: Handler = async (ctx) => estado(ctx, await abrir(ctx));

// ---- Requisitos: mescla da proposta da IA e atos do usuário ----

/** Maior número de código já usado no sistema (inclusive substituídos: código não é reaproveitado). */
async function maiorCodigo(ctx: RequestContext, systemId: string): Promise<number> {
  const row = await ctx.env.DB.prepare(
    "SELECT COALESCE(MAX(CAST(substr(code, 5) AS INTEGER)), 0) AS n FROM requirements WHERE system_id = ?",
  )
    .bind(systemId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

const codigoDe = (n: number) => `REQ-${String(n).padStart(2, "0")}`;
const normalizar = (texto: string) => texto.trim().replace(/\s+/g, " ").toLowerCase();

export interface Mescla {
  novos: { codigo: string; texto: string }[];
  /** Requisito existente reescrito pela IA: o anterior vira substituído e o novo fica pendente. */
  reescritos: { codigo: string; texto: string; eraConfirmado: boolean }[];
}

/**
 * Mescla a lista proposta pela IA com os requisitos vivos. A IA não remove nem confirma: código
 * existente com texto igual fica como está; texto diferente gera versão nova pendente (T06);
 * sem código (ou código desconhecido) vira requisito novo, se já não houver um igual.
 */
export function mesclarRequisitos(
  vivos: RequisitoDto[],
  propostos: Levantamento["requisitos"],
  maior: number,
): Mescla {
  const porCodigo = new Map(vivos.map((r) => [r.codigo, r]));
  const textos = new Set(vivos.map((r) => normalizar(r.texto)));
  const mescla: Mescla = { novos: [], reescritos: [] };
  let proximo = maior;
  let total = vivos.length;
  for (const p of propostos) {
    const existente = p.codigo ? porCodigo.get(p.codigo) : undefined;
    if (existente) {
      if (normalizar(existente.texto) !== normalizar(p.texto)) {
        mescla.reescritos.push({
          codigo: existente.codigo,
          texto: p.texto.trim(),
          eraConfirmado: existente.status === "confirmado",
        });
        textos.add(normalizar(p.texto));
      }
      porCodigo.delete(existente.codigo); // o mesmo código não é reescrito duas vezes
      continue;
    }
    if (textos.has(normalizar(p.texto)) || total >= LIMITS.requirements) continue;
    proximo += 1;
    total += 1;
    textos.add(normalizar(p.texto));
    mescla.novos.push({ codigo: codigoDe(proximo), texto: p.texto.trim() });
  }
  return mescla;
}

function inserirRequisito(
  db: D1Database,
  r: {
    systemId: string;
    codigo: string;
    texto: string;
    origem: "ia" | "usuario";
    mensagem: string | null;
    confirmadoPor: string | null;
    now: number;
  },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO requirements
         (id, system_id, code, text, status, origin, origin_message_id, confirmed_by, confirmed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      r.systemId,
      r.codigo,
      r.texto,
      r.confirmadoPor ? "confirmado" : "pendente",
      r.origem,
      r.mensagem,
      r.confirmadoPor,
      r.confirmadoPor ? r.now : null,
      r.now,
      r.now,
    );
}

function substituir(db: D1Database, systemId: string, codigo: string, now: number) {
  return db
    .prepare(
      `UPDATE requirements SET status = 'substituido', updated_at = max(updated_at, ?)
       WHERE system_id = ? AND code = ? AND status <> 'substituido'`,
    )
    .bind(now, systemId, codigo);
}

/**
 * Mudou o conjunto confirmado: versões geradas pela conversa deixam de valer, inclusive aprovadas
 * (T06: alteração exige nova aprovação). O sistema é rascunho, então nada ativo é afetado.
 */
function invalidarVersoesDaConversa(db: D1Database, systemId: string) {
  return db
    .prepare(
      `UPDATE model_versions SET status = 'superseded'
       WHERE system_id = ? AND origin = 'chat' AND status IN ('valid', 'approved')`,
    )
    .bind(systemId);
}

function auditar(db: D1Database, c: Contexto, acao: string, alvo: string, now: number) {
  return db
    .prepare(
      "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, ?, 'requisito', ?, ?)",
    )
    .bind(c.systemId, c.user.id, acao, alvo, now);
}

// ---- Conversa ----

const revisao = z.number().int().min(0);
const MensagemBody = z.object({ texto: z.string().trim().min(1).max(2000), revisao });
const RevisaoBody = z.object({ revisao });
const TextoBody = z.object({ texto: z.string().trim().min(3).max(400), revisao });
const CorrigirBody = z.object({ versao: z.string().min(1).max(100), revisao });

function lerJsonDaIa<T>(texto: string, schema: z.ZodType<T>): T {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    throw respostaInvalida();
  }
  const r = schema.safeParse(valor);
  if (!r.success) throw respostaInvalida();
  return r.data;
}

const respostaInvalida = () =>
  new AppError(
    502,
    "resposta_ia_invalida",
    "A IA respondeu fora do formato esperado. Nada foi alterado; tente de novo.",
  );

const chaveDoPedido = (ctx: RequestContext) => ctx.request.headers.get("idempotency-key") ?? "";

/**
 * Uma rodada da conversa: a mensagem do usuário, a resposta da IA e as mudanças de requisitos
 * são gravadas juntas, só depois de a IA responder e só se nada mudou nesse meio-tempo (revisão).
 * Se a IA falhar, nada muda e o texto pode ser reenviado (a tela o mantém).
 */
export const enviarMensagem: Handler = async (ctx) => {
  const c = await abrir(ctx);
  const body = parse(MensagemBody, await readJson(ctx.request));
  const cmd = { scope: c.systemId, actorId: c.user.id, command: "criacao.mensagem", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return estado(ctx, c, started.statusCode);
  exigirRascunho(c);
  if (!ctx.ia) throw iaNaoConfigurada();

  const conversaId = await conversa(ctx, c);
  await exigirRevisao(ctx, c, body.revisao);
  const historico = (await mensagens(ctx, conversaId)).slice(-HISTORICO);
  const vivos = await requisitosVivos(ctx, c.systemId);
  const maior = await maiorCodigo(ctx, c.systemId);
  const pedido: PedidoIa = {
    instrucoes: instrucoesLevantamento(
      c.nome,
      vivos.map((r) => ({ codigo: r.codigo, texto: r.texto, status: r.status })),
    ),
    mensagens: [
      ...historico.map((m) => ({
        papel: m.papel === "usuario" ? ("usuario" as const) : ("modelo" as const),
        texto: m.texto,
      })),
      { papel: "usuario", texto: body.texto },
    ],
    schema: levantamentoGeminiSchema(),
  };
  const resposta = await chamarComOrcamento(
    ctx,
    ctx.ia,
    {
      sistema: c.systemId,
      usuario: c.user.id,
      finalidade: "levantamento",
      chave: chaveDoPedido(ctx),
    },
    pedido,
  );
  const ia = lerJsonDaIa(resposta.texto, LevantamentoSchema);
  // Calculada sobre o estado da revisão lida; a guarda garante que é o mesmo na gravação.
  const mescla = mesclarRequisitos(vivos, ia.requisitos, maior);

  const db = ctx.env.DB;
  const now = ctx.clock.now();
  const idUsuario = crypto.randomUUID();
  const idIa = crypto.randomUUID();
  const inserirMensagem = (id: string, papel: string, texto: string, dados: object) =>
    db
      .prepare(
        `INSERT INTO messages (id, conversation_id, seq, role, content, data_json, created_at)
         SELECT ?, ?, COALESCE(MAX(seq), 0) + 1, ?, ?, ?, ? FROM messages WHERE conversation_id = ?`,
      )
      .bind(id, conversaId, papel, texto, JSON.stringify(dados), now, conversaId);
  const algumConfirmadoMudou = mescla.reescritos.some((r) => r.eraConfirmado);
  try {
    await db.batch([
      guarda(db, c.systemId, body.revisao),
      inserirMensagem(idUsuario, "usuario", body.texto, {}),
      inserirMensagem(idIa, "assistente", ia.resposta, {
        perguntas: ia.perguntas,
        foraDoCatalogo: ia.fora_do_catalogo,
      }),
      ...mescla.reescritos.flatMap((r) => [
        substituir(db, c.systemId, r.codigo, now),
        inserirRequisito(db, {
          systemId: c.systemId,
          codigo: r.codigo,
          texto: r.texto,
          origem: "ia",
          mensagem: idIa,
          confirmadoPor: null,
          now,
        }),
      ]),
      ...mescla.novos.map((r) =>
        inserirRequisito(db, {
          systemId: c.systemId,
          codigo: r.codigo,
          texto: r.texto,
          origem: "ia",
          mensagem: idIa,
          confirmadoPor: null,
          now,
        }),
      ),
      ...(algumConfirmadoMudou ? [invalidarVersoesDaConversa(db, c.systemId)] : []),
      auditar(db, c, "criacao.mensagem", idIa, now),
      recordStatement(ctx, cmd, started, idIa, 201, now),
    ]);
  } catch (error) {
    return falhaDoLote(ctx, c, error, { cmd, started });
  }
  return estado(ctx, c, 201);
};

// ---- Atos do usuário sobre os requisitos ----
// Cada ato envia a revisão que a tela mostrava: confirmar, editar ou descartar vale para o texto
// que o usuário viu; se a IA ou outra tela mudou algo, o ato é recusado e a tela recarrega.

async function requisitoVivo(ctx: RequestContext, c: Contexto, codigo: string) {
  const row = await ctx.env.DB.prepare(
    "SELECT code, text, status, origin FROM requirements WHERE system_id = ? AND code = ? AND status <> 'substituido'",
  )
    .bind(c.systemId, codigo)
    .first<RequisitoRow>();
  if (!row) throw notFound();
  return row;
}

/** Ato do usuário sobre o estado da revisão enviada (lote único com a guarda). */
async function atoDoUsuario(
  ctx: RequestContext,
  c: Contexto,
  esperada: number,
  instrucoes: (db: D1Database, now: number) => D1PreparedStatement[],
  idem?: { cmd: IdempotentCommand; started: Extract<IdempotencyOutcome, { kind: "new" }> },
): Promise<Response> {
  const db = ctx.env.DB;
  const now = ctx.clock.now();
  try {
    await db.batch([guarda(db, c.systemId, esperada), ...instrucoes(db, now)]);
  } catch (error) {
    return falhaDoLote(ctx, c, error, idem);
  }
  return estado(ctx, c, idem ? 201 : 200);
}

/** Confirmar é ato do usuário, um requisito por vez (seção 8, passo 3). */
export const confirmarRequisito: Handler = async (ctx) => {
  const c = await abrir(ctx);
  exigirRascunho(c);
  const { revisao: esperada } = parse(RevisaoBody, await readJson(ctx.request));
  const codigo = ctx.params.codigo ?? "";
  await conversa(ctx, c);
  const atual = await requisitoVivo(ctx, c, codigo);
  if (atual.status === "confirmado") return estado(ctx, c); // repetição inofensiva
  await exigirRevisao(ctx, c, esperada);
  return atoDoUsuario(ctx, c, esperada, (db, now) => [
    db
      .prepare(
        `UPDATE requirements SET status = 'confirmado', confirmed_by = ?, confirmed_at = ?, updated_at = max(updated_at, ?)
         WHERE system_id = ? AND code = ? AND status = 'pendente'`,
      )
      .bind(c.user.id, now, now, c.systemId, codigo),
    invalidarVersoesDaConversa(db, c.systemId),
    auditar(db, c, "requisito.confirmado", codigo, now),
  ]);
};

/** O usuário reescreve: a versão anterior vira substituída e o texto dele já vale como confirmado. */
export const editarRequisito: Handler = async (ctx) => {
  const c = await abrir(ctx);
  exigirRascunho(c);
  const { texto, revisao: esperada } = parse(TextoBody, await readJson(ctx.request));
  const codigo = ctx.params.codigo ?? "";
  await conversa(ctx, c);
  const atual = await requisitoVivo(ctx, c, codigo);
  if (normalizar(atual.text) === normalizar(texto) && atual.status === "confirmado") {
    return estado(ctx, c);
  }
  await exigirRevisao(ctx, c, esperada);
  return atoDoUsuario(ctx, c, esperada, (db, now) => [
    substituir(db, c.systemId, codigo, now),
    inserirRequisito(db, {
      systemId: c.systemId,
      codigo,
      texto,
      origem: "usuario",
      mensagem: null,
      confirmadoPor: c.user.id,
      now,
    }),
    invalidarVersoesDaConversa(db, c.systemId),
    auditar(db, c, "requisito.editado", codigo, now),
  ]);
};

/** Descartar tira o requisito da lista (fica no histórico como substituído). */
export const descartarRequisito: Handler = async (ctx) => {
  const c = await abrir(ctx);
  exigirRascunho(c);
  const { revisao: esperada } = parse(RevisaoBody, await readJson(ctx.request));
  const codigo = ctx.params.codigo ?? "";
  await conversa(ctx, c);
  await requisitoVivo(ctx, c, codigo);
  await exigirRevisao(ctx, c, esperada);
  return atoDoUsuario(ctx, c, esperada, (db, now) => [
    substituir(db, c.systemId, codigo, now),
    invalidarVersoesDaConversa(db, c.systemId),
    auditar(db, c, "requisito.descartado", codigo, now),
  ]);
};

/** O usuário acrescenta um requisito com as próprias palavras (já confirmado). */
export const adicionarRequisito: Handler = async (ctx) => {
  const c = await abrir(ctx);
  exigirRascunho(c);
  const body = parse(TextoBody, await readJson(ctx.request));
  const cmd = { scope: c.systemId, actorId: c.user.id, command: "criacao.requisito", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return estado(ctx, c, started.statusCode);
  await conversa(ctx, c);
  await exigirRevisao(ctx, c, body.revisao);
  // Limite e código lidos na revisão esperada; a guarda garante que nada mudou até a gravação.
  if ((await requisitosVivos(ctx, c.systemId)).length >= LIMITS.requirements) {
    throw conflict(`Limite de ${LIMITS.requirements} requisitos atingido.`);
  }
  const codigo = codigoDe((await maiorCodigo(ctx, c.systemId)) + 1);
  return atoDoUsuario(
    ctx,
    c,
    body.revisao,
    (db, now) => [
      inserirRequisito(db, {
        systemId: c.systemId,
        codigo,
        texto: body.texto,
        origem: "usuario",
        mensagem: null,
        confirmadoPor: c.user.id,
        now,
      }),
      invalidarVersoesDaConversa(db, c.systemId),
      auditar(db, c, "requisito.adicionado", codigo, now),
      recordStatement(ctx, cmd, started, codigo, 201, now),
    ],
    { cmd, started },
  );
};

// ---- Geração e correção da configuração ----

async function confirmadosSemPendencia(ctx: RequestContext, c: Contexto) {
  const vivos = await requisitosVivos(ctx, c.systemId);
  if (vivos.some((r) => r.status === "pendente")) {
    throw new AppError(
      409,
      "requisitos_pendentes",
      "Confirme, edite ou descarte os requisitos pendentes antes de gerar a configuração.",
    );
  }
  if (vivos.length === 0) {
    throw new AppError(409, "sem_requisitos", "Ainda não há requisitos confirmados.");
  }
  return vivos.map((r) => ({ codigo: r.codigo, texto: r.texto }));
}

/**
 * A lista de requisitos da configuração é a confirmada pelo usuário, não a que a IA devolveu:
 * a IA não acrescenta, remove nem confirma requisito por este caminho.
 */
function comRequisitosConfirmados(
  proposta: unknown,
  confirmados: { codigo: string; texto: string }[],
): unknown {
  if (typeof proposta !== "object" || proposta === null || Array.isArray(proposta)) return proposta;
  return {
    ...proposta,
    requisitos: confirmados.map((r) => ({ id: r.codigo, texto: r.texto, status: "confirmado" })),
  };
}

/**
 * Chama a IA e grava a versão só se a revisão ainda for a mesma: requisitos editados durante a
 * geração (ou sistema ativado nesse meio-tempo) desfazem a gravação, e nenhuma versão válida nasce
 * de requisitos velhos.
 */
async function gerarVersao(
  ctx: RequestContext,
  c: Contexto,
  esperada: number,
  idem: { cmd: IdempotentCommand; started: Extract<IdempotencyOutcome, { kind: "new" }> },
  confirmados: { codigo: string; texto: string }[],
  finalidade: "modelagem" | "correcao",
  pedido: PedidoIa,
): Promise<Response> {
  if (!ctx.ia) throw iaNaoConfigurada();
  const resposta = await chamarComOrcamento(
    ctx,
    ctx.ia,
    { sistema: c.systemId, usuario: c.user.id, finalidade, chave: chaveDoPedido(ctx) },
    pedido,
  );
  let proposta: unknown;
  try {
    proposta = JSON.parse(resposta.texto);
  } catch {
    throw respostaInvalida();
  }
  const result = validateDraft(comRequisitosConfirmados(proposta, confirmados));
  if (!result.draft) {
    // Estrutura fora do contrato: nada é gravado; o diagnóstico volta para o usuário decidir.
    return json({ versao: null, issues: result.issues }, { status: 422 });
  }
  const draft = result.draft;
  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    await db.batch([
      guarda(db, c.systemId, esperada),
      ...(await versaoStatements(ctx, {
        id,
        systemId: c.systemId,
        userId: c.user.id,
        origem: "chat",
        draft,
        issues: result.issues,
        now,
      })),
      recordStatement(ctx, idem.cmd, idem.started, id, 201, now),
    ]);
  } catch (error) {
    return falhaDoLote(ctx, c, error, idem);
  }
  return estado(ctx, c, 201);
}

/** Passos 5 a 7: gerar a configuração a partir dos requisitos confirmados e validar. */
export const gerarConfiguracao: Handler = async (ctx) => {
  const c = await abrir(ctx);
  const body = parse(RevisaoBody, await readJson(ctx.request));
  const cmd = { scope: c.systemId, actorId: c.user.id, command: "criacao.gerar", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return estado(ctx, c, started.statusCode);
  exigirRascunho(c);
  await conversa(ctx, c);
  await exigirRevisao(ctx, c, body.revisao);
  const confirmados = await confirmadosSemPendencia(ctx, c);
  return gerarVersao(ctx, c, body.revisao, { cmd, started }, confirmados, "modelagem", {
    instrucoes: instrucoesModelagem(c.nome, confirmados),
    mensagens: [
      { papel: "usuario", texto: "Gere a configuração a partir dos requisitos confirmados." },
    ],
    schema: configDraftGeminiSchema(),
  });
};

/** Passo 8: correção pela IA só quando o usuário pede, sobre uma versão com erro bloqueante (T08). */
export const corrigirConfiguracao: Handler = async (ctx) => {
  const c = await abrir(ctx);
  const body = parse(CorrigirBody, await readJson(ctx.request));
  const cmd = { scope: c.systemId, actorId: c.user.id, command: "criacao.corrigir", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return estado(ctx, c, started.statusCode);
  exigirRascunho(c);
  await conversa(ctx, c);
  await exigirRevisao(ctx, c, body.revisao);
  const db = ctx.env.DB;
  const versao = await db
    .prepare("SELECT config_json, status FROM model_versions WHERE id = ? AND system_id = ?")
    .bind(body.versao, c.systemId)
    .first<{ config_json: string; status: string }>();
  if (!versao) throw notFound();
  if (versao.status !== "invalid") {
    throw conflict("Só uma versão com erro bloqueante pede correção.");
  }
  const run = await db
    .prepare(
      "SELECT issues_json FROM validation_runs WHERE model_version_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(body.versao)
    .first<{ issues_json: string }>();
  const erros = (run ? (JSON.parse(run.issues_json) as IssueDto[]) : []).filter(
    (i) => i.severity === "bloqueante",
  );
  const confirmados = await confirmadosSemPendencia(ctx, c);
  return gerarVersao(ctx, c, body.revisao, { cmd, started }, confirmados, "correcao", {
    instrucoes: instrucoesCorrecao(c.nome, confirmados),
    mensagens: [
      {
        papel: "usuario",
        texto: pedidoCorrecao(JSON.parse(versao.config_json) as ConfigDraft, erros),
      },
    ],
    schema: configDraftGeminiSchema(),
  });
};
