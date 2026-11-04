import { z } from "zod";
import type { ConsultaApiBody, MensagemConsultaDto } from "../../../shared/api";
import type { ModuleId } from "../../../shared/contract/catalog";
import type { ConfigDraft } from "../../../shared/contract/schema";
import {
  deCampoLocal,
  formatarDataHora,
  FUSO,
  paraCampoLocal,
} from "../../../shared/dominio/agenda";
import { formatarCentavos } from "../../../shared/dominio/precos";
import { readJson } from "../../http/body";
import { AppError } from "../../http/errors";
import { beginIdempotent, recordStatement, replayAfterRace } from "../../http/idempotency";
import { json } from "../../http/responses";
import type { Handler, RequestContext } from "../../http/router";
import { aposIa, chamarComOrcamento, iaNaoConfigurada } from "../../ia/orcamento";
import {
  consultaGeminiSchema,
  ConsultaSchema,
  instrucoesConsulta,
  type Consulta,
} from "../../ia/prompts";
import { isUnique, parse } from "../comum";
import { abrirOperacao, type Operacao } from "./contexto";

// Chat de consulta (seção 15): SOMENTE LEITURA. A IA só classifica a pergunta em uma intenção
// permitida e extrai período, produto e profissional; o backend autoriza, consulta com SQL
// parametrizado e monta a resposta com os números reais, os filtros e a origem. A IA não escreve
// a resposta, então não há número inventado; sem dados, a resposta diz que não há. Conversa
// separada por usuário + sistema (T29); um sistema por vez.

const DIA = 24 * 3_600_000;

interface MensagemRow {
  id: string;
  role: MensagemConsultaDto["papel"];
  content: string;
  data_json: string;
  created_at: number;
}

async function conversaDe(ctx: RequestContext, op: Operacao): Promise<string> {
  const db = ctx.env.DB;
  await db
    .prepare(
      "INSERT OR IGNORE INTO conversations (id, system_id, user_id, kind, created_at) VALUES (?, ?, ?, 'consulta', ?)",
    )
    .bind(crypto.randomUUID(), op.systemId, op.user.id, ctx.clock.now())
    .run();
  const row = await db
    .prepare(
      "SELECT id FROM conversations WHERE system_id = ? AND user_id = ? AND kind = 'consulta'",
    )
    .bind(op.systemId, op.user.id)
    .first<{ id: string }>();
  return row?.id ?? "";
}

async function estado(ctx: RequestContext, op: Operacao, status = 200): Promise<Response> {
  const conversa = await conversaDe(ctx, op);
  const { results } = await ctx.env.DB.prepare(
    "SELECT id, role, content, data_json, created_at FROM messages WHERE conversation_id = ? ORDER BY seq DESC LIMIT 100",
  )
    .bind(conversa)
    .all<MensagemRow>();
  const mensagens = results.reverse().map((m): MensagemConsultaDto => {
    const d = JSON.parse(m.data_json) as { intencao?: string; filtros?: string[]; origem?: string };
    return {
      id: m.id,
      papel: m.role,
      texto: m.content,
      intencao: d.intencao ?? null,
      filtros: d.filtros ?? [],
      origem: d.origem ?? null,
      criadoEm: m.created_at,
    };
  });
  const body: ConsultaApiBody = { mensagens, iaDisponivel: ctx.ia !== undefined };
  return json(body, { status });
}

export const obterConsulta: Handler = async (ctx) => estado(ctx, await abrirOperacao(ctx, null));

// ---- Respostas calculadas pelo backend ----

interface Resposta {
  texto: string;
  filtros: string[];
  origem: string;
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** [início do dia "de", início do dia seguinte a "ate") em ms UTC, no fuso do Nexus. */
function intervalo(periodo: NonNullable<Consulta["periodo"]>): { de: number; ate: number } | null {
  const [ano, mes, dia] = periodo.ate.split("-").map(Number) as [number, number, number];
  const seguinte = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10);
  const de = deCampoLocal(`${periodo.de}T00:00`);
  const ate = deCampoLocal(`${seguinte}T00:00`);
  if (de === null || ate === null || ate <= de || ate - de > 400 * DIA) return null;
  return { de, ate };
}

const semModulo = (nome: string): Resposta => ({
  texto: `Este sistema não tem o módulo de ${nome}, então não há o que consultar sobre isso.`,
  filtros: [],
  origem: "configuração ativa",
});

const temModulo = (config: ConfigDraft, m: ModuleId) => config.modulos.includes(m);

async function vendas(ctx: RequestContext, op: Operacao, c: Consulta): Promise<Resposta> {
  if (!temModulo(op.config, "vendas")) return semModulo("vendas");
  // Seção 15: sem período, pergunta antes de somar.
  if (!c.periodo) {
    return {
      texto: "De qual período? Por exemplo: hoje, esta semana, outubro ou de 01/11 a 04/11.",
      filtros: [],
      origem: "pergunta de esclarecimento (nenhum número foi calculado)",
    };
  }
  const faixa = intervalo(c.periodo);
  if (!faixa)
    return { texto: "Não entendi o período. Pode repetir as datas?", filtros: [], origem: "—" };
  const db = ctx.env.DB;
  const concluidas = await db
    .prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS total FROM sales WHERE system_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?",
    )
    .bind(op.systemId, faixa.de, faixa.ate)
    .first<{ n: number; total: number }>();
  const canceladas = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM sales WHERE system_id = ? AND status = 'cancelled' AND cancelled_at >= ? AND cancelled_at < ?",
    )
    .bind(op.systemId, faixa.de, faixa.ate)
    .first<{ n: number }>();
  const n = concluidas?.n ?? 0;
  const periodo = `${dataBr(c.periodo.de)} a ${dataBr(c.periodo.ate)}`;
  return {
    texto:
      n === 0
        ? `Não há vendas concluídas de ${periodo}.`
        : `De ${periodo}: ${n} ${n === 1 ? "venda concluída" : "vendas concluídas"}, total vendido de ${formatarCentavos(concluidas?.total ?? 0)}. ` +
          `Cancelamentos no período: ${canceladas?.n ?? 0}. O total vendido não é lucro nem dinheiro recebido.`,
    filtros: [`Período: ${periodo} (horário de Brasília)`],
    origem: "vendas concluídas pela data de conclusão, sem as canceladas",
  };
}

async function estoque(ctx: RequestContext, op: Operacao, c: Consulta): Promise<Resposta> {
  if (!temModulo(op.config, "estoque")) return semModulo("estoque");
  const { results } = await ctx.env.DB.prepare(
    `SELECT p.name, p.physical, (SELECT COALESCE(SUM(r.quantity), 0) FROM reservations r
       WHERE r.product_id = p.id AND r.status = 'active' AND r.expires_at > ?1) AS reserved
     FROM products p WHERE p.system_id = ?2 AND p.status = 'active'
       AND (?3 IS NULL OR instr(lower(p.name), lower(?3)) > 0)
     ORDER BY p.name COLLATE NOCASE LIMIT 20`,
  )
    .bind(ctx.clock.now(), op.systemId, c.produto)
    .all<{ name: string; physical: number; reserved: number }>();
  const filtros = c.produto ? [`Produto: contém “${c.produto}”`] : ["Todos os produtos ativos"];
  if (results.length === 0) {
    return {
      texto: c.produto
        ? `Nenhum produto ativo com “${c.produto}” no nome.`
        : "Não há produtos ativos.",
      filtros,
      origem: "saldos de estoque agora",
    };
  }
  return {
    texto: results
      .map(
        (p) =>
          `${p.name}: físico ${p.physical}, reservado ${p.reserved}, disponível ${p.physical - p.reserved}`,
      )
      .join("\n"),
    filtros,
    origem: "saldos de estoque agora (disponível = físico − reservado em pedidos abertos no prazo)",
  };
}

async function reservas(ctx: RequestContext, op: Operacao): Promise<Resposta> {
  if (!temModulo(op.config, "vendas")) return semModulo("vendas");
  const { results } = await ctx.env.DB.prepare(
    `SELECT c.name AS cliente, s.expires_at FROM sales s JOIN customers c ON c.id = s.customer_id
     WHERE s.system_id = ? AND s.status = 'draft' AND s.expires_at > ? ORDER BY s.expires_at LIMIT 20`,
  )
    .bind(op.systemId, ctx.clock.now())
    .all<{ cliente: string; expires_at: number }>();
  return {
    texto:
      results.length === 0
        ? "Não há pedidos abertos segurando estoque agora."
        : results
            .map((r) => `${r.cliente}: reserva vence em ${formatarDataHora(r.expires_at)}`)
            .join("\n"),
    filtros: ["Pedidos abertos com reserva no prazo"],
    origem: "rascunhos de venda agora",
  };
}

async function agenda(ctx: RequestContext, op: Operacao, c: Consulta): Promise<Resposta> {
  if (!temModulo(op.config, "agenda")) return semModulo("agenda");
  const hoje = paraCampoLocal(ctx.clock.now()).slice(0, 10);
  const periodo = c.periodo ?? { de: hoje, ate: hoje };
  const faixa = intervalo(periodo);
  if (!faixa)
    return { texto: "Não entendi o período. Pode repetir as datas?", filtros: [], origem: "—" };
  const { results } = await ctx.env.DB.prepare(
    `SELECT a.start_at, a.end_at, a.service_type, a.status, c.name AS cliente, p.name AS profissional
     FROM appointments a
     JOIN customers c ON c.id = a.customer_id AND c.system_id = a.system_id
     JOIN professionals p ON p.id = a.professional_id AND p.system_id = a.system_id
     WHERE a.system_id = ?1 AND a.status <> 'cancelled' AND a.start_at < ?3 AND a.end_at > ?2
       AND (?4 IS NULL OR instr(lower(p.name), lower(?4)) > 0)
     ORDER BY a.start_at LIMIT 30`,
  )
    .bind(op.systemId, faixa.de, faixa.ate, c.profissional)
    .all<{
      start_at: number;
      end_at: number;
      service_type: string;
      status: string;
      cliente: string;
      profissional: string;
    }>();
  const rotulo = (tipo: string) =>
    op.config.tipos_atendimento.find((t) => t.id === tipo)?.rotulo ?? tipo;
  const estados: Record<string, string> = {
    scheduled: "agendado",
    in_progress: "em atendimento",
    done: "concluído",
  };
  const filtros = [
    `Período: ${dataBr(periodo.de)} a ${dataBr(periodo.ate)} (horário de Brasília)`,
    ...(c.profissional ? [`Profissional: contém “${c.profissional}”`] : []),
  ];
  return {
    texto:
      results.length === 0
        ? "Não há atendimentos nesse período."
        : results
            .map((a) => {
              const hora = new Intl.DateTimeFormat("pt-BR", {
                timeZone: FUSO,
                hour: "2-digit",
                minute: "2-digit",
              });
              return `${formatarDataHora(a.start_at)}–${hora.format(a.end_at)} · ${rotulo(a.service_type)} · ${a.cliente} · ${a.profissional} · ${estados[a.status] ?? a.status}`;
            })
            .join("\n"),
    filtros,
    origem: "agenda (atendimentos não cancelados)",
  };
}

function regras(config: ConfigDraft): Resposta {
  const nome = (id: string) => config.tipos_atendimento.find((t) => t.id === id)?.rotulo ?? id;
  const linhas = config.regras.map((r) => {
    switch (r.tipo) {
      case "limite_atacado":
        return `Atacado a partir de ${formatarCentavos(r.valor_centavos)} em produtos, a preço de varejo.`;
      case "unidades_por_caixa":
        return `Caixa padrão com ${r.unidades} unidades; o preço da caixa é o da unidade vezes a quantidade.`;
      case "prazo_reserva":
        return `Um pedido aberto segura o estoque por ${r.minutos} minutos sem alteração.`;
      case "par_atendimento":
        return `${nome(r.primeiro)} e ${nome(r.segundo)} com o mesmo profissional, nessa ordem.`;
    }
  });
  return {
    texto: linhas.length ? linhas.join("\n") : "Este sistema não tem regras parametrizadas.",
    filtros: [],
    origem: "configuração aprovada e ativa",
  };
}

const foraDoEscopo: Resposta = {
  texto:
    "Eu só consulto informações deste sistema. Para vender, cancelar, ajustar estoque ou agendar, use as telas do sistema.",
  filtros: [],
  origem: "chat de consulta (somente leitura)",
};

async function responder(ctx: RequestContext, op: Operacao, c: Consulta): Promise<Resposta> {
  switch (c.intencao) {
    case "vendas":
      return vendas(ctx, op, c);
    case "estoque":
      return estoque(ctx, op, c);
    case "reservas":
      return reservas(ctx, op);
    case "agenda":
      return agenda(ctx, op, c);
    case "regras":
      return regras(op.config);
    case "fora_do_escopo":
      return foraDoEscopo;
  }
}

// ---- Rota ----

const PerguntaBody = z.object({ texto: z.string().trim().min(1).max(500) });

export const perguntar: Handler = async (ctx) => {
  const op = await abrirOperacao(ctx, null);
  const body = parse(PerguntaBody, await readJson(ctx.request));
  const cmd = { scope: op.systemId, actorId: op.user.id, command: "consulta.pergunta", body };
  const started = await beginIdempotent(ctx, cmd);
  if (started.kind === "replay") return estado(ctx, op, started.statusCode);
  if (!ctx.ia) throw iaNaoConfigurada();

  const resposta = await chamarComOrcamento(
    ctx,
    ctx.ia,
    {
      sistema: op.systemId,
      usuario: op.user.id,
      finalidade: "consulta",
      chave: ctx.request.headers.get("idempotency-key") ?? "",
    },
    {
      instrucoes: instrucoesConsulta(
        op.config.aparencia.nome,
        paraCampoLocal(ctx.clock.now()).slice(0, 10),
      ),
      // Só a pergunta atual: cada consulta é independente e o histórico não vai para a IA.
      mensagens: [{ papel: "usuario", texto: body.texto }],
      schema: consultaGeminiSchema(),
    },
  );
  return aposIa(ctx, resposta.usoId, async () => {
    let consulta: Consulta;
    try {
      consulta = ConsultaSchema.parse(JSON.parse(resposta.texto));
    } catch {
      throw new AppError(
        502,
        "resposta_ia_invalida",
        "Não entendi a pergunta agora. Tente com outras palavras.",
      );
    }
    const r = await responder(ctx, op, consulta);

    const db = ctx.env.DB;
    const conversa = await conversaDe(ctx, op);
    const now = ctx.clock.now();
    const inserir = (id: string, papel: string, texto: string, dados: object) =>
      db
        .prepare(
          `INSERT INTO messages (id, conversation_id, seq, role, content, data_json, created_at)
         SELECT ?, ?, COALESCE(MAX(seq), 0) + 1, ?, ?, ?, ? FROM messages WHERE conversation_id = ?`,
        )
        .bind(id, conversa, papel, texto, JSON.stringify(dados), now, conversa);
    const idResposta = crypto.randomUUID();
    try {
      await db.batch([
        inserir(crypto.randomUUID(), "usuario", body.texto, {}),
        inserir(idResposta, "assistente", r.texto, {
          intencao: consulta.intencao,
          filtros: r.filtros,
          origem: r.origem,
        }),
        recordStatement(ctx, cmd, started, idResposta, 201, now),
      ]);
    } catch (error) {
      const replay = isUnique(error) ? await replayAfterRace(ctx, cmd, started) : null;
      if (replay?.kind === "replay") return estado(ctx, op, replay.statusCode);
      throw error;
    }
    return estado(ctx, op, 201);
  });
};
