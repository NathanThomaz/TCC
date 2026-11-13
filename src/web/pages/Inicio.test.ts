import { describe, expect, it } from "vitest";
import type { InicioDto, PainelDto } from "../../shared/api";
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
const painel: PainelDto = {
  hoje: "2026-11-13",
  vendas: {
    hoje: { quantidade: 2, totalCentavos: 3000 },
    mes: { quantidade: 5, totalCentavos: 9000 },
    abertas: 0,
    canceladasNoMes: 0,
    clientesNoMes: 2,
    ultimas: [],
  },
  estoque: {
    produtosAtivos: 4,
    semEstoque: 0,
    minimo: 10,
    abaixoDoMinimo: 2,
    criticos: [],
    unidades: 5,
    valorVarejoCentavos: 100,
  },
  clientes: { ativos: 7, inativos: 0, novosNoMes: 1 },
};
const dados: InicioDto = {
  hoje: "2026-11-13",
  sistemas: [
    {
      sistema: sistema("a", "active"),
      modelo: "comercio",
      modulos: ["clientes", "produtos", "vendas", "estoque"],
      corPrimaria: "#1f4e79",
      painel,
      pedidosAbertos: 1,
    },
    {
      sistema: sistema("b", "active"),
      modelo: "comercio",
      modulos: ["clientes", "produtos", "vendas", "estoque"],
      corPrimaria: null,
      painel: { ...painel, estoque: { ...painel.estoque!, abaixoDoMinimo: 0 } },
      pedidosAbertos: 0,
    },
    {
      sistema: sistema("c", "draft", AGORA - 5 * DIA),
      modelo: null,
      modulos: [],
      corPrimaria: null,
      painel: null,
      pedidosAbertos: 0,
    },
  ],
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
      sistemas: [{ ...dados.sistemas[2]!, sistema: sistema("c", "draft", AGORA - DIA) }],
    };
    expect(alertasDoInicio(recente, AGORA)).toEqual([]);
  });
});
