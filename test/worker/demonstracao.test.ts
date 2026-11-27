import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  executarCenario,
  instante,
  NOMES_SISTEMAS,
  type Corpo,
} from "../../scripts/demonstracao/cenario";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { limparBanco } from "../limpar-banco";

// Massa de dados da demonstração (scripts/demonstracao): o cenário roda inteiro pela API, sobre o
// D1 local com as migrations reais, sem nenhuma recusa inesperada. Período curto para o teste.

let agora = Date.UTC(2026, 10, 1);
const IDENTIDADE: VerifiedToken = {
  uid: "uid-demo",
  email: "demo@example.com",
  emailVerified: true,
  authTime: Date.UTC(2026, 0, 1),
};
const app = createApp({
  clock: { now: () => agora },
  auth: () => ({
    verify: (token) =>
      token === "token-demo-0000000000000"
        ? Promise.resolve(IDENTIDADE)
        : Promise.reject(new InvalidTokenError("x")),
    lookup: () => Promise.resolve({ validSince: null, disabled: false }),
  }),
});

async function chamar(metodo: string, caminho: string, corpo?: unknown) {
  const response = await app(
    new Request(`https://app.test/api/v1${caminho}`, {
      method: metodo,
      headers: {
        authorization: "Bearer token-demo-0000000000000",
        ...(corpo === undefined ? {} : { "content-type": "application/json" }),
        ...(metodo === "POST" ? { "idempotency-key": crypto.randomUUID() } : {}),
      },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    }),
    env,
  );
  return { status: response.status, body: await response.json<Corpo>() };
}

beforeEach(async () => {
  await limparBanco();
});

describe("massa de dados da demonstração", () => {
  it("cria os três sistemas e o movimento do período sem recusas inesperadas", async () => {
    const resumo = await executarCenario({
      chamar,
      relogio: (t) => (agora = t),
      ate: "2026-11-20",
      dias: 12,
      nomeConta: "Conta de demonstração",
    });

    expect(resumo.sistemas.map((x) => x.nome)).toEqual(Object.values(NOMES_SISTEMAS));
    const c = resumo.contagem;
    expect(c.sistemas).toBe(3);
    expect(c.produtos).toBeGreaterThan(70);
    expect(c.clientes).toBeGreaterThan(90);
    expect(c["vendas concluídas"]).toBeGreaterThan(50);
    expect(c.compras).toBeGreaterThan(3);
    expect(c["contas a pagar pagas"]).toBeGreaterThan(0);
    expect(c["contas a receber lançadas"]).toBeGreaterThan(0);
    expect(c["saídas (Uso na cozinha)"]).toBeGreaterThan(5);

    expect(c["atendimentos agendados"]).toBeGreaterThan(0);
    expect(c["atendimentos agendados"]! % 2).toBe(0); // sempre o par instalação/retirada

    // Recusas aceitas: só as que o próprio negócio provoca (limite de crédito, técnico ocupado).
    const aceitas = [
      "a prazo recusado: limite_credito",
      "agenda: conflito_agenda",
      "agenda: sem técnico livre",
      "venda sem estoque",
      "evento sem barril",
    ];
    for (const chave of Object.keys(resumo.recusas)) expect(aceitas).toContain(chave);

    const [distribuidora, estudio, restaurante] = resumo.sistemas.map((x) => x.id);
    const painel = await chamar("GET", `/systems/${distribuidora}/painel`);
    expect(painel.status).toBe(200);
    expect(painel.body.painel?.vendas?.mes.quantidade).toBeGreaterThan(0);
    expect((await chamar("GET", `/systems/${estudio}/financeiro`)).status).toBe(200);
    expect((await chamar("GET", `/systems/${restaurante}/estoque`)).status).toBe(200);

    // Nenhum rascunho de venda sobrou segurando estoque.
    const rascunhos = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM sales WHERE status = 'draft'",
    ).first<{ n: number }>();
    expect(rascunhos?.n).toBe(0);

    // A conta é única e recebeu o nome; nada ficou fora dela.
    const usuarios = await env.DB.prepare("SELECT email, display_name FROM users").all();
    expect(usuarios.results).toEqual([
      { email: "demo@example.com", display_name: "Conta de demonstração" },
    ]);
  }, 120_000);

  it("para a carga quando a agenda falha por outro motivo que não o técnico ocupado", async () => {
    const comFalha = async (metodo: string, caminho: string, corpo?: unknown) =>
      metodo === "POST" && caminho.endsWith("/agenda")
        ? { status: 500, body: { error: { code: "erro_interno" } } as Corpo }
        : chamar(metodo, caminho, corpo);
    await expect(
      executarCenario({
        chamar: comFalha,
        relogio: (t) => (agora = t),
        ate: "2026-11-20",
        dias: 12,
      }),
    ).rejects.toThrow(/agendar chopeira: HTTP 500/);
  }, 120_000);

  it("carga no meio do dia: nada depois do instante real nem venda aberta pela metade", async () => {
    const opcoes = { chamar, relogio: (t: number) => (agora = t), ate: "2026-11-20", dias: 7 };
    // Mesma semente, mesmos horários: uma venda do último dia mostra onde cortar no meio dela.
    await executarCenario(opcoes);
    const venda = await env.DB.prepare(
      `SELECT created_at, completed_at FROM sales
       WHERE status = 'completed' AND created_at >= ? ORDER BY created_at LIMIT 1`,
    )
      .bind(instante("2026-11-20", 0, 0))
      .first<{ created_at: number; completed_at: number }>();
    expect(venda).not.toBeNull();
    const corte = Math.floor((venda!.created_at + venda!.completed_at) / 2);
    expect(corte).toBeGreaterThan(venda!.created_at);

    await limparBanco();
    await executarCenario({ ...opcoes, limite: corte });
    const depois = await env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM sales WHERE created_at > ?1 OR status = 'draft')
            + (SELECT COUNT(*) FROM stock_movements WHERE created_at > ?1)
            + (SELECT COUNT(*) FROM financial_entries WHERE created_at > ?1) AS n`,
    )
      .bind(corte)
      .first<{ n: number }>();
    expect(depois?.n).toBe(0);
  }, 120_000);

  /**
   * Primeira carga (de 09/11, com a mensalidade de novembro) cortada em `corte`, continuação até
   * 02/12 (atravessa o dia 1º, quando as mensalidades de dezembro são lançadas). Confere que nada
   * se repete, nada é gravado no passado e nenhum cadastro é criado.
   */
  async function cortarEContinuar(corte: number, ateDaPrimeira: string) {
    const primeira = await executarCenario({
      chamar,
      relogio: (t) => (agora = t),
      ate: ateDaPrimeira,
      dias: Math.round((corte - instante("2026-11-09", 12)) / 86_400_000) + 1,
      limite: corte,
    });
    const desde = (await env.DB.prepare(
      `SELECT MAX(t) AS t FROM (SELECT MAX(created_at) AS t FROM stock_movements
           UNION ALL SELECT MAX(max(created_at, COALESCE(paid_at, 0))) FROM financial_entries
           UNION ALL SELECT MAX(created_at) FROM sales)`,
    ).first<{ t: number }>())!.t;
    expect(desde).toBeLessThanOrEqual(corte);
    const contar = async () =>
      env.DB.prepare(
        `SELECT (SELECT COUNT(*) FROM sales) AS vendas, (SELECT COUNT(*) FROM customers) AS clientes,
           (SELECT COUNT(*) FROM products) AS produtos, (SELECT COUNT(*) FROM systems) AS sistemas,
           (SELECT COUNT(*) FROM stock_movements WHERE created_at <= ?1)
             + (SELECT COUNT(*) FROM sales WHERE created_at <= ?1)
             + (SELECT COUNT(*) FROM financial_entries WHERE created_at <= ?1) AS passado`,
      )
        .bind(desde)
        .first<{
          vendas: number;
          clientes: number;
          produtos: number;
          sistemas: number;
          passado: number;
        }>();
    const antes = await contar();
    const segunda = await executarCenario({
      chamar,
      relogio: (t) => (agora = t),
      ate: "2026-12-02",
      continuar: { desde },
    });
    expect(segunda.sistemas).toEqual(primeira.sistemas);
    const aceitas = [
      "a prazo recusado: limite_credito",
      "agenda: conflito_agenda",
      "agenda: sem técnico livre",
      "venda sem estoque",
      "evento sem barril",
    ];
    for (const chave of Object.keys(segunda.recusas)) expect(aceitas).toContain(chave);
    expect(segunda.contagem["vendas concluídas"]).toBeGreaterThan(10);
    expect(segunda.contagem.sistemas).toBeUndefined();
    expect(segunda.contagem.produtos).toBeUndefined();

    const depois = await contar();
    expect(depois?.sistemas).toBe(antes?.sistemas);
    expect(depois?.clientes).toBe(antes?.clientes);
    expect(depois?.produtos).toBe(antes?.produtos);
    expect(depois?.passado).toBe(antes?.passado);
    expect(depois!.vendas).toBeGreaterThan(antes!.vendas);
    const vendasDia2 = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM sales WHERE status = 'completed' AND completed_at >= ?",
    )
      .bind(instante("2026-12-02", 0, 0))
      .first<{ n: number }>();
    expect(vendasDia2?.n).toBeGreaterThan(0);

    // Contas fixas e mensalidades não se repetem; as de dezembro saem uma por aluno de novembro.
    const repetidas = await env.DB.prepare(
      `SELECT description, due_date, COUNT(*) AS n FROM financial_entries
       WHERE description NOT LIKE 'Venda a prazo%' AND description NOT LIKE 'Locação de chopeira%'
         AND description NOT LIKE 'Aula avulsa%' AND description NOT LIKE 'Mensalidade%'
       GROUP BY system_id, description, due_date HAVING COUNT(*) > 1`,
    ).all();
    expect(repetidas.results).toEqual([]);
    const mensalidades = await env.DB.prepare(
      `SELECT SUM(due_date = '2026-11-10') AS nov, SUM(due_date = '2026-12-10') AS dez
       FROM financial_entries WHERE description LIKE 'Mensalidade de %'`,
    ).first<{ nov: number; dez: number }>();
    // E nenhuma falta: as quatro contas fixas que vencem em 10/12 (três lançadas em 30/11, entre
    // 8h05 e 8h55, e a internet do estúdio em 02/12) existem uma vez cada.
    const contasDe10 = await env.DB.prepare(
      `SELECT description FROM financial_entries
       WHERE due_date = '2026-12-10' AND description LIKE '% - dezembro' ORDER BY description`,
    ).all<{ description: string }>();
    expect(contasDe10.results.map((r) => r.description)).toEqual([
      "Contabilidade - dezembro",
      "Honorários do contador - dezembro",
      "Internet - dezembro",
      "Internet e telefone - dezembro",
    ]);
    expect(mensalidades?.nov).toBeGreaterThan(30);
    expect(mensalidades?.dez).toBe(mensalidades?.nov);
    // Nenhum rascunho aberto nem atendimento "agendado" no passado.
    const pendentes = await env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM sales WHERE status = 'draft') AS rascunhos,
         (SELECT COUNT(*) FROM appointments WHERE status IN ('scheduled', 'in_progress')
            AND start_at < ?) AS atrasados`,
    )
      .bind(instante("2026-12-02", 20, 0))
      .first<{ rascunhos: number; atrasados: number }>();
    expect(pendentes).toEqual({ rascunhos: 0, atrasados: 0 });
    return desde;
  }

  it("continuar: corte antes das contas do dia (segunda, 7h45)", async () => {
    // O último registro é o combustível das 7h40: a continuação começa no mesmo dia, antes das
    // contas fixas das 8h, e não pode relançar as que já foram lançadas.
    const desde = await cortarEContinuar(instante("2026-11-30", 7, 45), "2026-11-30");
    expect(desde).toBeGreaterThan(instante("2026-11-30", 7, 0));
  }, 180_000);

  it("continuar: corte no meio das contas e das mensalidades (revisão do Codex)", async () => {
    // 30/11 às 8h40: parte das contas que vencem em 10/12 já foi lançada (8h05–8h55), e o novo
    // sorteio pode pôr uma das que faltam antes do corte.
    await cortarEContinuar(instante("2026-11-30", 8, 40), "2026-11-30");
    await limparBanco();
    // 01/12 às 8h10: o lote das mensalidades de dezembro (8h00–8h22) ficou pela metade.
    await cortarEContinuar(instante("2026-12-01", 8, 10), "2026-12-01");
  }, 300_000);
});
