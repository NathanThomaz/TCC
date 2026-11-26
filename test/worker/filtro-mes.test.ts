import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { executarCenario, instante, type Corpo } from "../../scripts/demonstracao/cenario";
import {
  limitesDoMes,
  mesesDoFiltro,
  mesValido,
  rotuloDoMes,
} from "../../src/shared/dominio/periodo";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { limparBanco } from "../limpar-banco";

// Filtro de mês da tela inicial e do painel (pedido do dono, 2026-11-23): ?mes=AAAA-MM muda só os
// números "do mês". Dados da massa de demonstração atravessando a virada de outubro para novembro.

const TOKEN = "token-filtro-mes-0000000";
const IDENTIDADE: VerifiedToken = {
  uid: "uid-filtro",
  email: "filtro@example.com",
  emailVerified: true,
  authTime: Date.UTC(2026, 0, 1),
};
let agora = Date.UTC(2026, 9, 1);
const app = createApp({
  clock: { now: () => agora },
  auth: () => ({
    verify: (token) =>
      token === TOKEN ? Promise.resolve(IDENTIDADE) : Promise.reject(new InvalidTokenError("x")),
    lookup: () => Promise.resolve({ validSince: null, disabled: false }),
  }),
});

async function chamar(metodo: string, caminho: string, corpo?: unknown) {
  const response = await app(
    new Request(`https://app.test/api/v1${caminho}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        ...(corpo === undefined ? {} : { "content-type": "application/json" }),
        ...(metodo === "POST" ? { "idempotency-key": crypto.randomUUID() } : {}),
      },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    }),
    env,
  );
  return { status: response.status, body: await response.json<Corpo>() };
}

let distribuidora = "";

/** Vendas concluídas no mês, direto no banco (a conta que o painel deve repetir). */
async function vendasDoMes(mes: string) {
  const { inicio, fim } = limitesDoMes(mes);
  return env.DB.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS total FROM sales
     WHERE system_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?`,
  )
    .bind(distribuidora, inicio, fim)
    .first<{ n: number; total: number }>();
}

beforeAll(async () => {
  await limparBanco();
  const resumo = await executarCenario({
    chamar,
    relogio: (t) => (agora = t),
    ate: "2026-11-05",
    dias: 14,
  });
  distribuidora = resumo.sistemas[0]!.id;
  agora = instante("2026-11-05", 20, 0);
}, 120_000);

describe("filtro de mês", () => {
  it("o painel mostra o mês escolhido nos números do mês e mantém os de hoje", async () => {
    const atual = await chamar("GET", `/systems/${distribuidora}/painel`);
    const outubro = await chamar("GET", `/systems/${distribuidora}/painel?mes=2026-10`);
    expect(atual.status).toBe(200);
    expect(outubro.status).toBe(200);
    expect(atual.body.painel?.mes).toBe("2026-11");
    expect(outubro.body.painel?.mes).toBe("2026-10");

    const nov = await vendasDoMes("2026-11");
    const out = await vendasDoMes("2026-10");
    expect(out?.n).toBeGreaterThan(0);
    expect(atual.body.painel?.vendas?.mes).toEqual({
      quantidade: nov?.n,
      totalCentavos: nov?.total,
    });
    expect(outubro.body.painel?.vendas?.mes).toEqual({
      quantidade: out?.n,
      totalCentavos: out?.total,
    });
    // Os outros números do mês seguem o filtro: as formas de pagamento somam as vendas do mês, e
    // as compras do mês batem com o banco.
    const somaFormas = (outubro.body.painel?.pagamentos ?? []).reduce(
      (t, f) => t + f.quantidade,
      0,
    );
    expect(somaFormas).toBe(out?.n);
    const { inicio, fim } = limitesDoMes("2026-10");
    const compras = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM purchases WHERE system_id = ? AND status = 'completed'
         AND created_at >= ? AND created_at < ?`,
    )
      .bind(distribuidora, inicio, fim)
      .first<{ n: number }>();
    expect(outubro.body.painel?.compras?.noMes.quantidade).toBe(compras?.n);
    expect(compras?.n).toBeGreaterThan(0);

    // Hoje e o estado atual não dependem do filtro.
    expect(outubro.body.painel?.vendas?.hoje).toEqual(atual.body.painel?.vendas?.hoje);
    expect(outubro.body.painel?.estoque).toEqual(atual.body.painel?.estoque);
    expect(outubro.body.painel?.financeiro?.aReceber).toEqual(
      atual.body.painel?.financeiro?.aReceber,
    );
  });

  it("a tela inicial soma as vendas do mês escolhido", async () => {
    const r = await chamar("GET", "/inicio?mes=2026-10");
    expect(r.status).toBe(200);
    expect(r.body.inicio?.mes).toBe("2026-10");
    const item = r.body.inicio?.sistemas.find((s) => s.sistema.id === distribuidora);
    const out = await vendasDoMes("2026-10");
    expect(item?.resumo?.vendas?.mes.totalCentavos).toBe(out?.total);
    expect((await chamar("GET", "/inicio")).body.inicio?.mes).toBe("2026-11");
  });

  it("recusa mês futuro ou mal escrito", async () => {
    for (const mes of ["2026-12", "2026-13", "2026-1", "outubro", ""]) {
      expect((await chamar("GET", `/systems/${distribuidora}/painel?mes=${mes}`)).status, mes).toBe(
        422,
      );
      expect((await chamar("GET", `/inicio?mes=${mes}`)).status, mes).toBe(422);
    }
  });

  it("calendário do filtro no fuso de Brasília", () => {
    expect(limitesDoMes("2026-11")).toEqual({
      inicio: Date.UTC(2026, 10, 1, 3),
      fim: Date.UTC(2026, 11, 1, 3),
    });
    expect(mesesDoFiltro("2026-12-02", 3)).toEqual(["2026-12", "2026-11", "2026-10"]);
    expect(mesesDoFiltro("2026-01-15", 2)).toEqual(["2026-01", "2025-12"]);
    expect(mesValido("2026-11", "2026-11-30")).toBe(true);
    expect(mesValido("2026-12", "2026-11-30")).toBe(false);
    expect(rotuloDoMes("2026-12", "2026-12-02")).toBe("no mês");
    expect(rotuloDoMes("2026-11", "2026-12-02")).toBe("em novembro");
    expect(rotuloDoMes("2025-12", "2026-01-10")).toBe("em dezembro de 2025");
  });
});
