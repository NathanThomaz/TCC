import { describe, expect, it } from "vitest";
import type { InicioDto, ResumoSistemaDto } from "../../shared/api";
import { alertasDoInicio, totaisDoInicio } from "./Inicio";

// Tela inicial: o que precisa de atenção e os totais do dia vêm dos painéis de cada sistema.

const DIA = 86_400_000;
const AGORA = Date.UTC(2026, 10, 13, 15);
const sistema = (id: string, status: "draft" | "active", atualizadoEm = AGORA) => ({
  id,
  nome: `Sistema ${id}`,
  status,
  versaoAtiva: status === "active" ? "v1" : null,
  criadoEm: 1,
  atualizadoEm,
});
const resumo: ResumoSistemaDto = {
  vendas: {
    hoje: { quantidade: 2, totalCentavos: 3000 },
    mes: { quantidade: 5, totalCentavos: 9000 },
  },
  clientesAtivos: 7,
  estoque: { criticos: 2, comMinimo: true },
};
const dados: InicioDto = {
  hoje: "2026-11-13",
  sistemas: [
    {
      sistema: sistema("a", "active"),
      modelo: "comercio",
      modulos: ["clientes", "produtos", "vendas", "estoque"],
      corPrimaria: "#1f4e79",
      resumo,
      pedidosAbertos: 1,
      ultimaAtividade: AGORA,
    },
    {
      sistema: sistema("b", "active"),
      modelo: "comercio",
      modulos: ["clientes", "produtos", "vendas", "estoque"],
      corPrimaria: null,
      resumo: { ...resumo, estoque: { criticos: 0, comMinimo: true } },
      pedidosAbertos: 0,
      ultimaAtividade: AGORA,
    },
    {
      sistema: sistema("c", "draft", AGORA - 10 * DIA),
      modelo: null,
      modulos: [],
      corPrimaria: null,
      resumo: null,
      pedidosAbertos: 0,
      ultimaAtividade: AGORA - 5 * DIA,
    },
  ],
  truncado: false,
  pedidos: { abertos: 1, emAnalise: 0, implementados: 0 },
  ia: null,
};

describe("tela inicial", () => {
  it("soma vendas e clientes dos sistemas ativos", () => {
    expect(totaisDoInicio(dados)).toMatchObject({
      vendasHoje: 6000,
      qtdHoje: 4,
      vendasMes: 18000,
      clientes: 14,
      temVendas: true,
      temAgenda: false,
    });
  });

  it("lista o que precisa de atenção, do mais urgente ao menos", () => {
    const alertas = alertasDoInicio(dados, AGORA);
    expect(alertas.map((a) => a.id)).toEqual(["a-estoque", "a-pedidos", "c-rascunho"]);
    expect(alertas[2]!.texto).toBe("rascunho parado há 5 dias");
  });

  it("rascunho recente não vira alerta", () => {
    const recente = {
      ...dados,
      // Criado há 10 dias, mas a configuração mexeu ontem: não está parado.
      sistemas: [{ ...dados.sistemas[2]!, ultimaAtividade: AGORA - DIA }],
    };
    expect(alertasDoInicio(recente, AGORA)).toEqual([]);
  });
});
