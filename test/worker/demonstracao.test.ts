import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { executarCenario, NOMES_SISTEMAS, type Corpo } from "../../scripts/demonstracao/cenario";
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

    // Recusas aceitas: só as que o próprio negócio provoca (limite de crédito, técnico ocupado).
    for (const chave of Object.keys(resumo.recusas)) {
      expect(chave).toMatch(/^(a prazo recusado|agenda|venda sem estoque|evento sem barril)/);
    }

    const [distribuidora, estudio, restaurante] = resumo.sistemas.map((x) => x.id);
    const painel = await chamar("GET", `/systems/${distribuidora}/painel`);
    expect(painel.status).toBe(200);
    expect(painel.body.painel?.vendas?.mes.quantidade).toBeGreaterThan(0);
    expect((await chamar("GET", `/systems/${estudio}/financeiro`)).status).toBe(200);
    expect((await chamar("GET", `/systems/${restaurante}/estoque`)).status).toBe(200);

    // A conta é única e recebeu o nome; nada ficou fora dela.
    const usuarios = await env.DB.prepare("SELECT email, display_name FROM users").all();
    expect(usuarios.results).toEqual([
      { email: "demo@example.com", display_name: "Conta de demonstração" },
    ]);
  }, 120_000);
});
