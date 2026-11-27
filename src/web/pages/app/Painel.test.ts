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
  custo: null,
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
    expect(ids({ hoje: "", mes: "", vendas, clientes, estoque })).toEqual([
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
    expect(ids({ hoje: "", mes: "", clientes, agenda })).toHaveLength(LIMITE_INDICADORES);
    expect(ids({ hoje: "", mes: "", clientes, agenda })).toContain("novos");
  });

  it("comércio com serviços: os 8 mais importantes, sem passar do limite", () => {
    const lista = ids({ hoje: "", mes: "", vendas, clientes, estoque, agenda });
    expect(lista).toHaveLength(LIMITE_INDICADORES);
    expect(lista).toEqual(expect.arrayContaining(["atendimentos-hoje", "ticket", "proximos-7"]));
  });

  it('filtro de mês: os rótulos dizem o mês escolhido; no mês atual, "no mês"', () => {
    const rotulos = (mes: string) =>
      indicadores({ hoje: "2026-12-02", mes, vendas, clientes }).map((i) => i.rotulo);
    expect(rotulos("2026-12")).toContain("Vendas no mês");
    expect(rotulos("2026-11")).toEqual(
      expect.arrayContaining(["Vendas em novembro", "Ticket médio em novembro"]),
    );
    expect(rotulos("2026-11").join(" ")).not.toContain("no mês");
  });

  it("ticket médio sem vendas é zero, não divisão por zero", () => {
    const sem = { ...vendas, mes: { quantidade: 0, totalCentavos: 0 } };
    const ticket = indicadores({ hoje: "", mes: "", vendas: sem }).find((i) => i.id === "ticket");
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
      mes: "",
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
      mes: "",
      vendas,
      clientes,
      estoque,
      financeiro: { ...financeiro, vencidosReceber: { quantidade: 0, totalCentavos: 0 } },
    });
    expect(semVencidos).not.toContain("vencidos");
  });

  it("com valor de compra, o lucro previsto toma o lugar do valor em estoque", () => {
    const custo = {
      produtos: 2,
      semCusto: 1,
      valorCustoCentavos: 3000,
      valorVendaCentavos: 4500,
      lucroPrevistoCentavos: 1500,
    };
    const lista = ids({ hoje: "", mes: "", vendas, clientes, estoque: { ...estoque, custo } });
    expect(lista).toContain("lucro-estoque");
    expect(lista).not.toContain("valor-estoque");
  });

  it("só controle de estoque (sem vendas): mostra o valor de compra, não o lucro previsto", () => {
    const custo = {
      produtos: 2,
      semCusto: 0,
      valorCustoCentavos: 629388,
      valorVendaCentavos: 627988,
      lucroPrevistoCentavos: -1400,
    };
    const lista = indicadores({ hoje: "", mes: "", estoque: { ...estoque, custo } });
    expect(lista.map((i) => i.id)).not.toContain("lucro-estoque");
    const valor = lista.find((i) => i.id === "custo-estoque");
    expect(valor?.valor).toBe("R$ 6.293,88");
    expect(valor?.alerta).toBeFalsy();
  });
});
