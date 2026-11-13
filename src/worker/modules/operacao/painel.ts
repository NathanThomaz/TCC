import type { PainelDto } from "../../../shared/api";
import { deCampoLocal, paraCampoLocal } from "../../../shared/dominio/agenda";
import { json } from "../../http/responses";
import type { Handler } from "../../http/router";
import { abrirOperacao } from "./contexto";

// Painel do sistema ativo: números calculados no backend (nunca pela IA), no fuso do Nexus, só
// dos módulos que o sistema tem. Mesma conta que a consulta usa: vendas concluídas pelo dia da
// conclusão, sem as canceladas; disponível = físico − reservas ativas não vencidas.

/** Quantos produtos aparecem no estoque crítico. */
const CRITICOS = 6;

export const obterPainel: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, null);
  const db = ctx.env.DB;
  const agora = ctx.clock.now();
  const hoje = paraCampoLocal(agora).slice(0, 10);
  const [ano, mes, dia] = hoje.split("-").map(Number) as [number, number, number];
  const iso = (a: number, m: number, d: number) =>
    new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10);
  const inicioHoje = deCampoLocal(`${hoje}T00:00`)!;
  const inicioAmanha = deCampoLocal(`${iso(ano, mes, dia + 1)}T00:00`)!;
  const inicioMes = deCampoLocal(`${iso(ano, mes, 1)}T00:00`)!;
  const inicioProximoMes = deCampoLocal(`${iso(ano, mes + 1, 1)}T00:00`)!;
  const tem = (m: string) => op.config.modulos.includes(m as never);
  const s = op.systemId;
  const painel: PainelDto = { hoje };

  if (tem("vendas")) {
    const soma = (de: number, ate: number) =>
      db
        .prepare(
          "SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS total FROM sales WHERE system_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?",
        )
        .bind(s, de, ate)
        .first<{ n: number; total: number }>();
    const [dia_, mes_, abertas, canceladas, ultimas, clientesNoMes] = await Promise.all([
      soma(inicioHoje, inicioAmanha),
      soma(inicioMes, inicioProximoMes),
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM sales WHERE system_id = ? AND status = 'draft' AND (expires_at IS NULL OR expires_at > ?)",
        )
        .bind(s, agora)
        .first<{ n: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM sales WHERE system_id = ? AND status = 'cancelled' AND cancelled_at >= ? AND cancelled_at < ?",
        )
        .bind(s, inicioMes, inicioProximoMes)
        .first<{ n: number }>(),
      db
        .prepare(
          `SELECT s.id, c.name AS cliente, s.total_cents, s.completed_at FROM sales s
           JOIN customers c ON c.system_id = s.system_id AND c.id = s.customer_id
           WHERE s.system_id = ? AND s.status = 'completed' ORDER BY s.completed_at DESC LIMIT 5`,
        )
        .bind(s)
        .all<{ id: string; cliente: string; total_cents: number; completed_at: number }>(),
      db
        .prepare(
          "SELECT COUNT(DISTINCT customer_id) AS n FROM sales WHERE system_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?",
        )
        .bind(s, inicioMes, inicioProximoMes)
        .first<{ n: number }>(),
    ]);
    painel.vendas = {
      hoje: { quantidade: dia_?.n ?? 0, totalCentavos: dia_?.total ?? 0 },
      mes: { quantidade: mes_?.n ?? 0, totalCentavos: mes_?.total ?? 0 },
      abertas: abertas?.n ?? 0,
      canceladasNoMes: canceladas?.n ?? 0,
      clientesNoMes: clientesNoMes?.n ?? 0,
      ultimas: ultimas.results.map((v) => ({
        id: v.id,
        cliente: v.cliente,
        totalCentavos: v.total_cents,
        concluidaEm: v.completed_at,
      })),
    };
  }

  if (tem("produtos")) {
    const regra = op.config.regras.find(
      (r): r is { tipo: "estoque_minimo"; unidades: number; requisitos: string[] } =>
        (r.tipo as string) === "estoque_minimo",
    );
    const minimo = regra?.unidades ?? null;
    const { results } = await db
      .prepare(
        `SELECT p.id, p.name, p.physical, p.retail_cents,
           (SELECT COALESCE(SUM(r.quantity), 0) FROM reservations r
             WHERE r.product_id = p.id AND r.status = 'active' AND r.expires_at > ?1) AS reserved
         FROM products p WHERE p.system_id = ?2 AND p.status = 'active'`,
      )
      .bind(agora, s)
      .all<{
        id: string;
        name: string;
        physical: number;
        retail_cents: number;
        reserved: number;
      }>();
    const produtos = results.map((p) => ({
      id: p.id,
      nome: p.name,
      fisico: p.physical,
      reservado: p.reserved,
      disponivel: p.physical - p.reserved,
    }));
    painel.estoque = {
      produtosAtivos: produtos.length,
      semEstoque: produtos.filter((p) => p.disponivel <= 0).length,
      minimo,
      abaixoDoMinimo: minimo === null ? null : produtos.filter((p) => p.disponivel < minimo).length,
      criticos: [...produtos]
        .sort((a, b) => a.disponivel - b.disponivel || a.nome.localeCompare(b.nome, "pt-BR"))
        .slice(0, CRITICOS),
      unidades: results.reduce((soma, p) => soma + p.physical, 0),
      valorVarejoCentavos: results.reduce((soma, p) => soma + p.physical * p.retail_cents, 0),
    };
  }

  if (tem("clientes")) {
    const r = await db
      .prepare(
        `SELECT SUM(status = 'active') AS ativos, SUM(status = 'inactive') AS inativos,
           SUM(created_at >= ?2 AND created_at < ?3) AS novos
         FROM customers WHERE system_id = ?1`,
      )
      .bind(s, inicioMes, inicioProximoMes)
      .first<{ ativos: number | null; inativos: number | null; novos: number | null }>();
    painel.clientes = {
      ativos: r?.ativos ?? 0,
      inativos: r?.inativos ?? 0,
      novosNoMes: r?.novos ?? 0,
    };
  }

  if (tem("agenda")) {
    const [contagem, proximos, periodo] = await Promise.all([
      db
        .prepare(
          `SELECT SUM(status = 'scheduled') AS agendados, SUM(status = 'in_progress') AS em_atendimento,
             SUM(status = 'done') AS concluidos
           FROM appointments WHERE system_id = ? AND start_at >= ? AND start_at < ?`,
        )
        .bind(s, inicioHoje, inicioAmanha)
        .first<{
          agendados: number | null;
          em_atendimento: number | null;
          concluidos: number | null;
        }>(),
      db
        .prepare(
          `SELECT a.id, a.start_at, a.service_type, c.name AS cliente, p.name AS profissional
           FROM appointments a
           JOIN customers c ON c.system_id = a.system_id AND c.id = a.customer_id
           JOIN professionals p ON p.system_id = a.system_id AND p.id = a.professional_id
           WHERE a.system_id = ? AND a.status IN ('scheduled', 'in_progress') AND a.end_at > ?
           ORDER BY a.start_at LIMIT 5`,
        )
        .bind(s, agora)
        .all<{
          id: string;
          start_at: number;
          service_type: string;
          cliente: string;
          profissional: string;
        }>(),
      db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM appointments WHERE system_id = ?1 AND status = 'scheduled'
                AND start_at >= ?2 AND start_at < ?2 + 7 * 86400000) AS semana,
             (SELECT COUNT(*) FROM appointments WHERE system_id = ?1 AND status = 'done'
                AND done_at >= ?3 AND done_at < ?4) AS concluidos,
             (SELECT COUNT(*) FROM appointments WHERE system_id = ?1 AND status = 'cancelled'
                AND cancelled_at >= ?3 AND cancelled_at < ?4) AS cancelados,
             (SELECT COUNT(*) FROM professionals WHERE system_id = ?1 AND status = 'active')
                AS profissionais`,
        )
        .bind(s, agora, inicioMes, inicioProximoMes)
        .first<{ semana: number; concluidos: number; cancelados: number; profissionais: number }>(),
    ]);
    const rotulo = (id: string) =>
      op.config.tipos_atendimento.find((t) => t.id === id)?.rotulo ?? id;
    painel.agenda = {
      hoje: {
        agendados: contagem?.agendados ?? 0,
        emAtendimento: contagem?.em_atendimento ?? 0,
        concluidos: contagem?.concluidos ?? 0,
      },
      proximos7Dias: periodo?.semana ?? 0,
      concluidosNoMes: periodo?.concluidos ?? 0,
      canceladosNoMes: periodo?.cancelados ?? 0,
      profissionaisAtivos: periodo?.profissionais ?? 0,
      proximos: proximos.results.map((a) => ({
        id: a.id,
        inicio: a.start_at,
        tipo: rotulo(a.service_type),
        cliente: a.cliente,
        profissional: a.profissional,
      })),
    };
  }

  return json({ painel });
};
