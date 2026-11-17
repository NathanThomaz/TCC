import type { SystemDto } from "../../shared/api";
import { authenticate, requireAdmin, requireSystemAccess } from "../auth/session";
import { AppError, conflict, notFound } from "../http/errors";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";
import { conflitoComDados } from "./operacao/contexto";

// Arquivar, reativar e excluir sistema (pedido do dono, 2026-11-16; migration 0015).
// - Arquivar: o sistema sai das telas das contas que operam e para de operar; os dados ficam e o
//   administrador pode reativar. Com venda reservada ou atendimento pendente, não arquiva: a tela
//   mostra o que falta concluir ou cancelar (decisão do dono).
// - Reativar: volta a ativo (se já foi ativado) ou a rascunho.
// - Excluir: só sistema que nunca foi ativado. Some de vez para o dono e libera o nome; a linha
//   fica porque o consumo da IA aponta para ela (limite mensal da conta).

interface Linha {
  id: string;
  name: string;
  status: SystemDto["status"];
  active_version_id: string | null;
  created_at: number;
  updated_at: number;
}

const paraDto = (r: Linha): SystemDto => ({
  id: r.id,
  nome: r.name,
  status: r.status,
  versaoAtiva: r.active_version_id,
  criadoEm: r.created_at,
  atualizadoEm: r.updated_at,
});

async function abrir(ctx: RequestContext) {
  const user = await authenticate(ctx, ctx.auth);
  requireAdmin(user);
  const systemId = ctx.params.systemId ?? "";
  await requireSystemAccess(ctx.env.DB, user, systemId);
  return { user, systemId, linha: await ler(ctx.env.DB, systemId) };
}

async function ler(db: D1Database, id: string): Promise<Linha> {
  const r = await db
    .prepare(
      `SELECT id, name, status, active_version_id, created_at, updated_at
       FROM systems WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(id)
    .first<Linha>();
  if (!r) throw notFound();
  return r;
}

// Pendências que impedem arquivar: venda em rascunho ainda reservando estoque e atendimento que
// não terminou (agendado ou em andamento).
const SEM_PENDENCIAS = `NOT EXISTS (SELECT 1 FROM sales WHERE system_id = ?1 AND status = 'draft' AND expires_at > ?2)
  AND NOT EXISTS (SELECT 1 FROM appointments WHERE system_id = ?1 AND status IN ('scheduled', 'in_progress'))`;

async function pendencias(db: D1Database, systemId: string, agora: number) {
  const r = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM sales WHERE system_id = ?1 AND status = 'draft' AND expires_at > ?2) AS vendas,
         (SELECT COUNT(*) FROM appointments WHERE system_id = ?1 AND status IN ('scheduled', 'in_progress')) AS atendimentos`,
    )
    .bind(systemId, agora)
    .first<{ vendas: number; atendimentos: number }>();
  return { vendasReservadas: r?.vendas ?? 0, atendimentos: r?.atendimentos ?? 0 };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export const arquivarSistema: Handler = async (ctx) => {
  const { user, systemId, linha } = await abrir(ctx);
  if (linha.status === "archived") return json({ sistema: paraDto(linha) });
  const db = ctx.env.DB;
  const agora = ctx.clock.now();
  // A conferência das pendências vai no próprio UPDATE: uma venda criada no meio impede.
  const [update] = await db.batch([
    db
      .prepare(
        `UPDATE systems SET status = 'archived', updated_at = max(updated_at, ?2)
         WHERE id = ?1 AND status IN ('draft', 'active') AND deleted_at IS NULL AND ${SEM_PENDENCIAS}`,
      )
      .bind(systemId, agora),
    db
      .prepare(
        `INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at)
         SELECT ?, ?, 'system.archived', 'system', ?, ? WHERE changes() = 1`,
      )
      .bind(systemId, user.id, systemId, agora),
  ]);
  if ((update?.meta.changes ?? 0) === 0) {
    const atual = await ler(db, systemId);
    if (atual.status === "archived") return json({ sistema: paraDto(atual) });
    const p = await pendencias(db, systemId, agora);
    const partes = [
      p.vendasReservadas
        ? plural(p.vendasReservadas, "venda com estoque reservado", "vendas com estoque reservado")
        : "",
      p.atendimentos
        ? plural(p.atendimentos, "atendimento pendente", "atendimentos pendentes")
        : "",
    ].filter(Boolean);
    return conflitoComDados(
      ctx,
      "sistema_com_pendencias",
      `Antes de inativar, conclua ou cancele: ${partes.join(" e ") || "as pendências"}.`,
      { pendencias: p },
    );
  }
  return json({ sistema: paraDto(await ler(db, systemId)) });
};

export const reativarSistema: Handler = async (ctx) => {
  const { user, systemId, linha } = await abrir(ctx);
  if (linha.status !== "archived") return json({ sistema: paraDto(linha) });
  const db = ctx.env.DB;
  const agora = ctx.clock.now();
  await db.batch([
    db
      .prepare(
        `UPDATE systems
         SET status = CASE WHEN active_version_id IS NULL THEN 'draft' ELSE 'active' END,
             updated_at = max(updated_at, ?)
         WHERE id = ? AND status = 'archived' AND deleted_at IS NULL`,
      )
      .bind(agora, systemId),
    db
      .prepare(
        `INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at)
         SELECT ?, ?, 'system.reactivated', 'system', ?, ? WHERE changes() = 1`,
      )
      .bind(systemId, user.id, systemId, agora),
  ]);
  return json({ sistema: paraDto(await ler(db, systemId)) });
};

export const excluirSistema: Handler = async (ctx) => {
  const { user, systemId, linha } = await abrir(ctx);
  if (linha.active_version_id !== null) {
    throw new AppError(
      409,
      "sistema_ja_usado",
      "Este sistema já foi ativado e tem histórico: ele pode ser inativado, mas não excluído.",
    );
  }
  const db = ctx.env.DB;
  const agora = ctx.clock.now();
  let mudou: number;
  try {
    const [update] = await db.batch([
      db
        .prepare(
          `UPDATE systems SET deleted_at = ?, name_key = NULL, updated_at = max(updated_at, ?)
           WHERE id = ? AND deleted_at IS NULL AND active_version_id IS NULL`,
        )
        .bind(agora, agora, systemId),
      db
        .prepare(
          `INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, details_json, created_at)
           SELECT ?, ?, 'system.deleted', 'system', ?, json_object('nome', ?), ? WHERE changes() = 1`,
        )
        .bind(systemId, user.id, systemId, linha.name, agora),
    ]);
    mudou = update?.meta.changes ?? 0;
  } catch (error) {
    if (String(error).includes("exclusao_invalida")) {
      throw conflict("Este sistema já foi ativado: ele pode ser inativado, mas não excluído.");
    }
    throw error;
  }
  if (mudou === 0) {
    // Outra exclusão venceu (mesmo resultado) ou o sistema foi ativado entre a leitura e o lote.
    const r = await db
      .prepare("SELECT deleted_at FROM systems WHERE id = ?")
      .bind(systemId)
      .first<{ deleted_at: number | null }>();
    if ((r?.deleted_at ?? null) === null) {
      throw conflict("Este sistema já foi ativado: ele pode ser inativado, mas não excluído.");
    }
  }
  return json({ excluido: true });
};
