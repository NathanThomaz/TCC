import { z } from "zod";
import type { ClienteDto, ProdutoDto, ProfissionalDto, ResumoPessoaDto } from "../../../shared/api";
import type { FieldEntity, ModuleId } from "../../../shared/contract/catalog";
import type { ConfigDraft } from "../../../shared/contract/schema";
import { readJson } from "../../http/body";
import { notFound, validationFailed } from "../../http/errors";
import { beginIdempotent, recordStatement, replayAfterRace } from "../../http/idempotency";
import { json } from "../../http/responses";
import type { Handler, RequestContext } from "../../http/router";
import { isUnique, parse, triggerConflict } from "../comum";
import { abrirOperacao, camposValidos, filtroDaQuery, lerCampos } from "./contexto";

// Cadastros (seção 14): clientes, produtos e profissionais pertencem a um sistema, são
// inativados e reativados (sem exclusão) e novas operações não selecionam inativos.

const STATUS = ["active", "inactive"] as const;
const nome = z.string().trim().min(1).max(120);
const StatusBody = z.object({ status: z.enum(STATUS) });

interface PessoaRow {
  id: string;
  name: string;
  status: (typeof STATUS)[number];
  extra_json: string;
}

function publicPessoa(row: PessoaRow): ClienteDto & ProfissionalDto {
  return { id: row.id, nome: row.name, status: row.status, campos: lerCampos(row.extra_json) };
}

// ---- Clientes e profissionais (mesma forma) ----

interface Pessoa {
  table: "customers" | "professionals";
  /** Coluna que liga vendas e atendimentos ao cadastro. */
  coluna: "customer_id" | "professional_id";
  modulo: ModuleId;
  entidade: FieldEntity;
  chave: "cliente" | "profissional";
  plural: "clientes" | "profissionais";
  inativo: Record<string, string>;
}

const CLIENTES: Pessoa = {
  table: "customers",
  coluna: "customer_id",
  modulo: "clientes",
  entidade: "clientes",
  chave: "cliente",
  plural: "clientes",
  inativo: {},
};
const PROFISSIONAIS: Pessoa = {
  table: "professionals",
  coluna: "professional_id",
  modulo: "profissionais",
  entidade: "profissionais",
  chave: "profissional",
  plural: "profissionais",
  inativo: {
    profissional_com_atendimento:
      "Este profissional tem atendimentos pendentes: cancele-os antes de inativar.",
  },
};

const PessoaBody = z.object({ nome, campos: z.unknown().optional() });

async function carregarPessoa(ctx: RequestContext, p: Pessoa, systemId: string, id: string) {
  const row = await ctx.env.DB.prepare(
    `SELECT id, name, status, extra_json FROM ${p.table} WHERE id = ? AND system_id = ?`,
  )
    .bind(id, systemId)
    .first<PessoaRow>();
  if (!row) throw notFound();
  return row;
}

function listarPessoas(p: Pessoa): Handler {
  return async (ctx) => {
    const op = await abrirOperacao(ctx, p.modulo);
    const status = filtroDaQuery(ctx.url, "status", STATUS);
    const db = ctx.env.DB;
    const tem = (m: ModuleId) => op.config.modulos.includes(m);
    const [{ results }, vendas, agenda] = await Promise.all([
      db
        .prepare(
          `SELECT id, name, status, extra_json, created_at FROM ${p.table}
           WHERE system_id = ?1 AND (?2 IS NULL OR status = ?2) ORDER BY name COLLATE NOCASE LIMIT 500`,
        )
        .bind(op.systemId, status)
        .all<PessoaRow & { created_at: number }>(),
      // Só cliente compra; profissional só tem atendimentos.
      p.table === "customers" && tem("vendas")
        ? db
            .prepare(
              `SELECT customer_id AS id, COUNT(*) AS n, SUM(total_cents) AS total, MAX(completed_at) AS ultima
               FROM sales WHERE system_id = ? AND status = 'completed' GROUP BY customer_id`,
            )
            .bind(op.systemId)
            .all<{ id: string; n: number; total: number; ultima: number }>()
        : null,
      tem("agenda")
        ? db
            .prepare(
              `SELECT ${p.coluna} AS id, COUNT(*) AS n,
                 MIN(CASE WHEN status = 'scheduled' AND start_at >= ?2 THEN start_at END) AS proximo
               FROM appointments WHERE system_id = ?1 AND status <> 'cancelled' GROUP BY ${p.coluna}`,
            )
            .bind(op.systemId, ctx.clock.now())
            .all<{ id: string; n: number; proximo: number | null }>()
        : null,
    ]);
    const porVenda = new Map(vendas?.results.map((v) => [v.id, v]));
    const porAgenda = new Map(agenda?.results.map((a) => [a.id, a]));
    return json({
      [p.plural]: results.map((row) => {
        const resumo: ResumoPessoaDto = { desde: row.created_at };
        if (vendas) {
          const v = porVenda.get(row.id);
          resumo.compras = v?.n ?? 0;
          resumo.totalCentavos = v?.total ?? 0;
          resumo.ultimaCompra = v?.ultima ?? null;
        }
        if (agenda) {
          const a = porAgenda.get(row.id);
          resumo.atendimentos = a?.n ?? 0;
          resumo.proximoAtendimento = a?.proximo ?? null;
        }
        return { ...publicPessoa(row), resumo };
      }),
    });
  };
}

function criarPessoa(p: Pessoa): Handler {
  return async (ctx) => {
    const op = await abrirOperacao(ctx, p.modulo);
    const body = parse(PessoaBody, await readJson(ctx.request));
    const cmd = { scope: op.systemId, actorId: op.user.id, command: `${p.chave}.create`, body };
    const started = await beginIdempotent(ctx, cmd);
    if (started.kind === "replay") {
      const row = await carregarPessoa(ctx, p, op.systemId, started.resourceId);
      return json({ [p.chave]: publicPessoa(row) }, { status: started.statusCode });
    }
    const extra = camposValidos(op.config, p.entidade, body.campos);
    const id = crypto.randomUUID();
    const now = ctx.clock.now();
    const db = ctx.env.DB;
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO ${p.table} (id, system_id, name, extra_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, op.systemId, body.nome, extra, op.user.id, now, now),
        db
          .prepare(
            "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(op.systemId, op.user.id, `${p.chave}.created`, p.chave, id, now),
        recordStatement(ctx, cmd, started, id, 201, now),
      ]);
    } catch (error) {
      const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
      if (replay?.kind !== "replay") throw error;
      const row = await carregarPessoa(ctx, p, op.systemId, replay.resourceId);
      return json({ [p.chave]: publicPessoa(row) }, { status: replay.statusCode });
    }
    return json(
      { [p.chave]: publicPessoa(await carregarPessoa(ctx, p, op.systemId, id)) },
      { status: 201 },
    );
  };
}

function editarPessoa(p: Pessoa): Handler {
  return async (ctx) => {
    const op = await abrirOperacao(ctx, p.modulo);
    const id = ctx.params.id ?? "";
    await carregarPessoa(ctx, p, op.systemId, id);
    const body = parse(PessoaBody, await readJson(ctx.request));
    const extra = camposValidos(op.config, p.entidade, body.campos);
    const now = ctx.clock.now();
    const db = ctx.env.DB;
    // Editar dados cadastrais não muda operações já registradas (elas guardam o que precisam).
    await db.batch([
      db
        .prepare(
          `UPDATE ${p.table} SET name = ?, extra_json = ?, updated_at = max(updated_at, ?) WHERE id = ? AND system_id = ?`,
        )
        .bind(body.nome, extra, now, id, op.systemId),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(op.systemId, op.user.id, `${p.chave}.updated`, p.chave, id, now),
    ]);
    return json({ [p.chave]: publicPessoa(await carregarPessoa(ctx, p, op.systemId, id)) });
  };
}

function statusPessoa(p: Pessoa): Handler {
  return async (ctx) => {
    const op = await abrirOperacao(ctx, p.modulo);
    const id = ctx.params.id ?? "";
    const atual = await carregarPessoa(ctx, p, op.systemId, id);
    const { status } = parse(StatusBody, await readJson(ctx.request));
    if (atual.status === status) return json({ [p.chave]: publicPessoa(atual) });
    await mudarStatus(ctx, op, p.table, p.chave, id, status, p.inativo);
    return json({ [p.chave]: publicPessoa(await carregarPessoa(ctx, p, op.systemId, id)) });
  };
}

async function mudarStatus(
  ctx: RequestContext,
  op: { systemId: string; user: { id: string } },
  table: string,
  alvo: string,
  id: string,
  status: (typeof STATUS)[number],
  recusas: Record<string, string>,
) {
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE ${table} SET status = ?, updated_at = max(updated_at, ?) WHERE id = ? AND system_id = ? AND status <> ?`,
        )
        .bind(status, now, id, op.systemId, status),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1",
        )
        .bind(
          op.systemId,
          op.user.id,
          `${alvo}.${status === "active" ? "reactivated" : "inactivated"}`,
          alvo,
          id,
          now,
        ),
    ]);
  } catch (error) {
    triggerConflict(error, recusas);
  }
}

export const listarClientes = listarPessoas(CLIENTES);
export const criarCliente = criarPessoa(CLIENTES);
export const editarCliente = editarPessoa(CLIENTES);
export const statusCliente = statusPessoa(CLIENTES);
export const listarProfissionais = listarPessoas(PROFISSIONAIS);
export const criarProfissional = criarPessoa(PROFISSIONAIS);
export const editarProfissional = editarPessoa(PROFISSIONAIS);
export const statusProfissional = statusPessoa(PROFISSIONAIS);

// ---- Produtos ----

interface ProdutoRow {
  id: string;
  name: string;
  status: (typeof STATUS)[number];
  retail_cents: number;
  wholesale_cents: number | null;
  units_per_box: number | null;
  physical: number;
  reserved: number;
  extra_json: string;
}

const centavos = z.number().int().min(1).max(100_000_000);
const ProdutoBody = z.object({
  nome,
  varejoCentavos: centavos,
  atacadoCentavos: centavos.nullable().optional(),
  unidadesPorCaixa: z.number().int().min(2).max(1000).nullable().optional(),
  campos: z.unknown().optional(),
});
type ProdutoBody = z.infer<typeof ProdutoBody>;

export function publicProduto(row: ProdutoRow): ProdutoDto {
  return {
    id: row.id,
    nome: row.name,
    status: row.status,
    varejoCentavos: row.retail_cents,
    atacadoCentavos: row.wholesale_cents,
    unidadesPorCaixa: row.units_per_box,
    fisico: row.physical,
    reservado: row.reserved,
    disponivel: row.physical - row.reserved,
    campos: lerCampos(row.extra_json),
  };
}

/** Produtos com o reservado ativo no instante `now` (EST-05: soma das reservas não vencidas). */
export const SELECT_PRODUTO = `
  SELECT p.id, p.name, p.status, p.retail_cents, p.wholesale_cents, p.units_per_box, p.physical,
         p.extra_json,
         (SELECT COALESCE(SUM(r.quantity), 0) FROM reservations r
          WHERE r.product_id = p.id AND r.status = 'active' AND r.expires_at > ?1) AS reserved
  FROM products p`;

export async function carregarProduto(
  ctx: RequestContext,
  systemId: string,
  id: string,
): Promise<ProdutoRow> {
  const row = await ctx.env.DB.prepare(`${SELECT_PRODUTO} WHERE p.id = ?2 AND p.system_id = ?3`)
    .bind(ctx.clock.now(), id, systemId)
    .first<ProdutoRow>();
  if (!row) throw notFound();
  return row;
}

export async function listarProdutosDoSistema(
  ctx: RequestContext,
  systemId: string,
  status: string | null,
) {
  const { results } = await ctx.env.DB.prepare(
    `${SELECT_PRODUTO} WHERE p.system_id = ?2 AND (?3 IS NULL OR p.status = ?3)
     ORDER BY p.name COLLATE NOCASE LIMIT 500`,
  )
    .bind(ctx.clock.now(), systemId, status)
    .all<ProdutoRow>();
  return results.map(publicProduto);
}

/** PRE-01/PRE-05: preço de atacado e fator da caixa seguem as regras da configuração ativa. */
function precosDoProduto(config: ConfigDraft, body: ProdutoBody) {
  const temAtacado = config.regras.some((r) => r.tipo === "limite_atacado");
  const temCaixa = config.regras.some((r) => r.tipo === "unidades_por_caixa");
  const atacado = body.atacadoCentavos ?? null;
  const caixa = body.unidadesPorCaixa ?? null;
  if (temAtacado && atacado === null) {
    throw validationFailed("Informe o preço de atacado: este sistema vende no atacado (PRE-01).");
  }
  if (!temAtacado && atacado !== null) {
    throw validationFailed("Este sistema não tem preço de atacado.");
  }
  if (!temCaixa && caixa !== null) {
    throw validationFailed("Este sistema não vende em caixas.");
  }
  return { atacado, caixa };
}

export const listarProdutos: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "produtos");
  const status = filtroDaQuery(ctx.url, "status", STATUS);
  return json({ produtos: await listarProdutosDoSistema(ctx, op.systemId, status) });
};

export const criarProduto: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "produtos");
  const body = parse(ProdutoBody, await readJson(ctx.request));
  const cmd = { scope: op.systemId, actorId: op.user.id, command: "produto.create", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") {
    const row = await carregarProduto(ctx, op.systemId, started.resourceId);
    return json({ produto: publicProduto(row) }, { status: started.statusCode });
  }
  const { atacado, caixa } = precosDoProduto(op.config, body);
  const extra = camposValidos(op.config, "produtos", body.campos);
  const id = crypto.randomUUID();
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  try {
    await db.batch([
      // EST-01: o físico começa em zero (default da coluna); só entradas o aumentam.
      db
        .prepare(
          `INSERT INTO products (id, system_id, name, retail_cents, wholesale_cents, units_per_box, extra_json, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          op.systemId,
          body.nome,
          body.varejoCentavos,
          atacado,
          caixa,
          extra,
          op.user.id,
          now,
          now,
        ),
      db
        .prepare(
          "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'produto.created', 'produto', ?, ?)",
        )
        .bind(op.systemId, op.user.id, id, now),
      recordStatement(ctx, cmd, started, id, 201, now),
    ]);
  } catch (error) {
    const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
    if (replay?.kind !== "replay") throw error;
    const row = await carregarProduto(ctx, op.systemId, replay.resourceId);
    return json({ produto: publicProduto(row) }, { status: replay.statusCode });
  }
  return json(
    { produto: publicProduto(await carregarProduto(ctx, op.systemId, id)) },
    { status: 201 },
  );
};

/** Preço novo vale para itens adicionados daqui em diante; rascunhos e vendas guardam o seu. */
export const editarProduto: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "produtos");
  const id = ctx.params.id ?? "";
  await carregarProduto(ctx, op.systemId, id);
  const body = parse(ProdutoBody, await readJson(ctx.request));
  const { atacado, caixa } = precosDoProduto(op.config, body);
  const extra = camposValidos(op.config, "produtos", body.campos);
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  await db.batch([
    db
      .prepare(
        `UPDATE products SET name = ?, retail_cents = ?, wholesale_cents = ?, units_per_box = ?, extra_json = ?,
           updated_at = max(updated_at, ?) WHERE id = ? AND system_id = ?`,
      )
      .bind(body.nome, body.varejoCentavos, atacado, caixa, extra, now, id, op.systemId),
    db
      .prepare(
        "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'produto.updated', 'produto', ?, ?)",
      )
      .bind(op.systemId, op.user.id, id, now),
  ]);
  return json({ produto: publicProduto(await carregarProduto(ctx, op.systemId, id)) });
};

export const statusProduto: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, "produtos");
  const id = ctx.params.id ?? "";
  const atual = await carregarProduto(ctx, op.systemId, id);
  const { status } = parse(StatusBody, await readJson(ctx.request));
  if (atual.status !== status) {
    await mudarStatus(ctx, op, "products", "produto", id, status, {
      produto_com_reserva: "Este produto tem reserva ativa em um rascunho de venda.",
    });
  }
  return json({ produto: publicProduto(await carregarProduto(ctx, op.systemId, id)) });
};
