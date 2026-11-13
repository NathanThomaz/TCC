import { describe, expect, it } from "vitest";
import type { PainelDto } from "../../../shared/api";
import { indicadores, LIMITE_INDICADORES } from "./Painel";

// O painel mostra sempre 8 indicadores, escolhidos pelos módulos que o sistema tem.

const vendas: NonNullable<PainelDto["vendas"]> = {
  hoje: { quantidade: 1, totalCentavos: 2000 },
  mes: { quantidade: 4, totalCentavos: 10000 },
  abertas: 1,
  canceladasNoMes: 0,
  clientesNoMes: 2,
  ultimas: [],
};
const estoque: NonNullable<PainelDto["estoque"]> = {
  produtosAtivos: 3,
  semEstoque: 1,
  minimo: null,
  abaixoDoMinimo: null,
  criticos: [],
  unidades: 10,
  valorVarejoCentavos: 5000,
};
const clientes = { ativos: 4, inativos: 0, novosNoMes: 1 };
const agenda: NonNullable<PainelDto["agenda"]> = {
  hoje: { agendados: 1, emAtendimento: 0, concluidos: 0 },
  proximos7Dias: 3,
  concluidosNoMes: 2,
  canceladosNoMes: 1,
  profissionaisAtivos: 2,
  proximos: [],
};
const ids = (p: PainelDto) => indicadores(p).map((i) => i.id);

describe("indicadores do painel", () => {
  it("comércio: 8 indicadores de vendas, clientes e estoque", () => {
    expect(ids({ hoje: "", vendas, clientes, estoque })).toEqual([
      "vendas-hoje",
      "vendas-mes",
      "ticket",
      "abertas",
      "clientes",
      "compraram",
      "estoque-critico",
      "valor-estoque",
    ]);
  });

  it("serviços: 8 indicadores de clientes e agenda", () => {
    expect(ids({ hoje: "", clientes, agenda })).toHaveLength(LIMITE_INDICADORES);
    expect(ids({ hoje: "", clientes, agenda })).toContain("novos");
  });

  it("comércio com serviços: os 8 mais importantes, sem passar do limite", () => {
    const lista = ids({ hoje: "", vendas, clientes, estoque, agenda });
    expect(lista).toHaveLength(LIMITE_INDICADORES);
    expect(lista).toEqual(expect.arrayContaining(["atendimentos-hoje", "ticket", "proximos-7"]));
  });

  it("ticket médio sem vendas é zero, não divisão por zero", () => {
    const sem = { ...vendas, mes: { quantidade: 0, totalCentavos: 0 } };
    const ticket = indicadores({ hoje: "", vendas: sem }).find((i) => i.id === "ticket");
    expect(ticket!.valor).toBe("R$ 0,00");
  });
});
