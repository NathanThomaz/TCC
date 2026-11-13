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

  it("módulos opcionais: contas vencidas sobem para o topo e o total continua 8", () => {
    const financeiro: NonNullable<PainelDto["financeiro"]> = {
      aReceber: { quantidade: 1, totalCentavos: 1000 },
      aPagar: { quantidade: 1, totalCentavos: 500 },
      vencidosReceber: { quantidade: 1, totalCentavos: 1000 },
      vencidosPagar: { quantidade: 0, totalCentavos: 0 },
      recebidoNoMesCentavos: 0,
      pagoNoMesCentavos: 0,
      proximos: [],
    };
    const compras = {
      noMes: { quantidade: 1, totalCentavos: 100 },
      fornecedoresAtivos: 1,
      valorCustoCentavos: 50,
    };
    const lista = ids({
      hoje: "",
      vendas,
      clientes,
      estoque,
      financeiro,
      compras,
      pagamentos: [{ forma: "pix", quantidade: 2, totalCentavos: 3000 }],
    });
    expect(lista).toHaveLength(LIMITE_INDICADORES);
    expect(lista).toEqual(expect.arrayContaining(["vencidos", "a-receber", "a-pagar"]));
    const semVencidos = ids({
      hoje: "",
      vendas,
      clientes,
      estoque,
      financeiro: { ...financeiro, vencidosReceber: { quantidade: 0, totalCentavos: 0 } },
    });
    expect(semVencidos).not.toContain("vencidos");
  });
});
