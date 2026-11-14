import { z } from "zod";
import type { ConsumoContaDto, ConsumoDto } from "../../shared/api";
import { paraCampoLocal } from "../../shared/dominio/agenda";
import { authenticate, ehDonoDoNexus } from "../auth/session";
import { readJson } from "../http/body";
import { AppError, notFound } from "../http/errors";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import { consumoDoMes, limitePadraoCentavos } from "../ia/orcamento";
import { parse } from "./comum";

// Consumo da IA por conta (ADR-009): só o dono do Nexus vê quanto cada conta gastou no mês, em
// que etapa, e ajusta o limite de cada uma. Conta = um administrador e as contas secundárias dele.

async function exigirDono(ctx: RequestContext) {
  const user = await authenticate(ctx, ctx.auth);
  if (!(await ehDonoDoNexus(ctx.env.DB, user))) {
    throw new AppError(403, "so_o_dono", "Só o dono do Nexus vê e ajusta o consumo das contas.");
  }
  return user;
}

const FINALIDADES = ["levantamento", "modelagem", "correcao", "consulta"] as const;

/** Mesmo critério do teto: concluída pelo custo real; aberta ou incerta pelo valor reservado. */
const CUSTO = `CASE a.state WHEN 'concluido' THEN a.cost_micro_brl
  WHEN 'falhou' THEN COALESCE(a.cost_micro_brl, 0) ELSE a.reserved_micro_brl END`;

export const obterConsumo: Handler = async (ctx) => {
  const dono = await exigirDono(ctx);
  const db = ctx.env.DB;
  const agora = ctx.clock.now();
  const d = new Date(agora);
  const inicio = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const [contas, uso, sistemas] = await db.batch([
    db.prepare(
      `SELECT id, email, display_name, status, self_signup, created_at, ai_limit_cents
       FROM users WHERE role = 'admin' ORDER BY created_at, rowid`,
    ),
    db
      .prepare(
        `SELECT COALESCE(u.owner_id, u.id) AS conta, a.purpose AS finalidade, COUNT(*) AS n,
           COALESCE(SUM(${CUSTO}), 0) AS gasto
         FROM ai_usage a JOIN users u ON u.id = a.user_id
         WHERE a.created_at >= ? GROUP BY conta, a.purpose`,
      )
      .bind(inicio),
    db.prepare(
      "SELECT owner_id AS conta, COUNT(*) AS n FROM systems WHERE status <> 'archived' GROUP BY owner_id",
    ),
  ]);
  type Conta = {
    id: string;
    email: string;
    display_name: string | null;
    status: ConsumoContaDto["status"];
    self_signup: number;
    created_at: number;
    ai_limit_cents: number | null;
  };
  type Uso = { conta: string; finalidade: (typeof FINALIDADES)[number]; n: number; gasto: number };
  const linhasUso = (uso?.results ?? []) as Uso[];
  const porSistema = new Map(
    ((sistemas?.results ?? []) as { conta: string; n: number }[]).map((s) => [s.conta, s.n]),
  );
  const padrao = limitePadraoCentavos(ctx.env);
  const centavos = (micro: number) => Math.ceil(micro / 10_000);
  const lista: ConsumoContaDto[] = ((contas?.results ?? []) as Conta[]).map((c) => {
    const meu = linhasUso.filter((u) => u.conta === c.id);
    const ehDono = c.id === dono.id;
    return {
      id: c.id,
      email: c.email,
      nome: c.display_name,
      status: c.status,
      cadastro: c.self_signup === 1,
      dono: ehDono,
      criadoEm: c.created_at,
      sistemas: porSistema.get(c.id) ?? 0,
      chamadas: meu.reduce((s, u) => s + u.n, 0),
      gastoCentavos: centavos(meu.reduce((s, u) => s + u.gasto, 0)),
      porEtapa: FINALIDADES.map((f) => {
        const linha = meu.find((u) => u.finalidade === f);
        return {
          finalidade: f,
          chamadas: linha?.n ?? 0,
          gastoCentavos: centavos(linha?.gasto ?? 0),
        };
      }),
      limiteCentavos: ehDono ? null : (c.ai_limit_cents ?? padrao),
      limitePadrao: !ehDono && c.ai_limit_cents === null,
    };
  });
  // Mais gasto primeiro: é onde o dono precisa olhar.
  lista.sort((a, b) => b.gastoCentavos - a.gastoCentavos);
  const geral = await consumoDoMes(ctx.env, agora);
  const body: ConsumoDto = {
    mes: paraCampoLocal(agora).slice(0, 7),
    tetoCentavos: geral.tetoCentavos,
    gastoTotalCentavos: geral.gastoCentavos,
    limitePadraoCentavos: padrao,
    contas: lista,
  };
  return json({ consumo: body });
};

const LimiteBody = z.object({
  /** null volta ao padrão do Nexus. Até R$ 1.000,00 por mês. */
  limiteCentavos: z.number().int().min(0).max(100_000).nullable(),
});

/** Ajusta o limite mensal de IA de uma conta (o dono não tem limite por conta). */
export const definirLimite: Handler = async (ctx) => {
  const dono = await exigirDono(ctx);
  const id = ctx.params.id ?? "";
  const { limiteCentavos } = parse(LimiteBody, await readJson(ctx.request));
  if (id === dono.id) {
    throw new AppError(
      422,
      "dono_sem_limite",
      "A conta do dono do Nexus não tem limite por conta.",
    );
  }
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  const [r] = await db.batch([
    db
      .prepare(
        "UPDATE users SET ai_limit_cents = ?, updated_at = max(updated_at, ?) WHERE id = ? AND role = 'admin'",
      )
      .bind(limiteCentavos, now, id),
    db
      .prepare(
        `INSERT INTO audit_events (actor_id, action, target_type, target_id, details_json, created_at)
         SELECT ?, 'conta.limite_ia', 'user', ?, json_object('limite_centavos', CAST(? AS INTEGER)), ? WHERE changes() = 1`,
      )
      .bind(dono.id, id, limiteCentavos, now),
  ]);
  if ((r?.meta.changes ?? 0) === 0) throw notFound();
  return json({ ok: true });
};
