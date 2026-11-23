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
});
