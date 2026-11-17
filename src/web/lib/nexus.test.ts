import { describe, expect, it } from "vitest";
import { validateDraft } from "../../shared/contract/validate";
import { MODELOS, modelosParaEscolher } from "./modelos";
import type { ConfigDraft } from "@/types/nexus";
import {
  comRequisitosGerados,
  completarReais,
  mascararReais,
  MODULOS_POR_MODELO,
  rascunhoPadrao,
  reaisParaCentavos,
  reconciliarModelo,
} from "./nexus";

// Modo avançado (ADR-004): os requisitos são gerados dos ajustes e a configuração passa no mesmo
// validador da conversa, inclusive sem regras e depois de trocar o modelo.

const comModelo = (d: ConfigDraft, modelo: ConfigDraft["modelo"]): ConfigDraft => ({
  ...d,
  modelo,
  modulos: [...MODULOS_POR_MODELO[modelo]],
});

const bloqueantes = (d: ConfigDraft) =>
  validateDraft(comRequisitosGerados(d)).issues.filter((i) => i.severity === "bloqueante");

describe("modo avançado", () => {
  it("serviços sem regras ainda tem requisito (o do modelo) e passa no validador", () => {
    const d: ConfigDraft = {
      ...comModelo(rascunhoPadrao("Salão"), "servicos"),
      tipos_atendimento: [{ id: "corte", rotulo: "Corte", duracao_minutos: 30 }],
    };
    const gerado = comRequisitosGerados(d);
    expect(gerado.requisitos).toHaveLength(1);
    expect(bloqueantes(d)).toEqual([]);
  });

  it("cada regra cita o próprio requisito gerado, já confirmado", () => {
    const d: ConfigDraft = {
      ...rascunhoPadrao("Loja"),
      regras: [
        { tipo: "prazo_reserva", minutos: 120, requisitos: [] },
        { tipo: "limite_atacado", valor_centavos: 150000, requisitos: [] },
      ],
    };
    const g = comRequisitosGerados(d);
    expect(g.requisitos.map((r) => r.texto)).toEqual([
      "Sistema com clientes, produtos, vendas, estoque",
      "Pedido aberto segura o estoque por 2 horas",
      "Atacado a partir de R$ 1.500,00 em produtos",
    ]);
    expect(g.regras.map((r) => r.requisitos)).toEqual([["REQ-02"], ["REQ-03"]]);
    expect(bloqueantes(d)).toEqual([]);
  });

  it("trocar de modelo tira também as regras novas dos módulos que saíram (ADR-005)", () => {
    const completo: ConfigDraft = comModelo(rascunhoPadrao("Loja"), "comercio_com_servicos");
    completo.regras = [
      { tipo: "pedido_minimo", valor_centavos: 5_000, requisitos: [] },
      { tipo: "estoque_minimo", unidades: 10, requisitos: [] },
      { tipo: "antecedencia_minima", minutos: 60, requisitos: [] },
    ];
    expect(reconciliarModelo(comModelo(completo, "servicos")).regras.map((r) => r.tipo)).toEqual([
      "antecedencia_minima",
    ]);
    expect(reconciliarModelo(comModelo(completo, "comercio")).regras.map((r) => r.tipo)).toEqual([
      "pedido_minimo",
      "estoque_minimo",
    ]);
  });

  it("trocar de comércio para serviços tira as regras de vendas e a configuração continua válida", () => {
    const comercio: ConfigDraft = {
      ...rascunhoPadrao("Loja"),
      regras: [{ tipo: "prazo_reserva", minutos: 120, requisitos: [] }],
      campos: [
        { id: "cnpj", entidade: "produtos", rotulo: "Código", tipo: "texto", obrigatorio: false },
      ],
    };
    const servicos = {
      ...reconciliarModelo(comModelo(comercio, "servicos")),
      tipos_atendimento: [{ id: "corte", rotulo: "Corte", duracao_minutos: 30 }],
    };
    expect(servicos.regras).toEqual([]);
    expect(servicos.campos).toEqual([]);
    expect(bloqueantes(servicos)).toEqual([]);
  });
});

describe("campo de dinheiro (pedido do dono, 2026-11-14)", () => {
  it.each([
    ["300", "300"],
    ["1500", "1.500"],
    ["1234567", "1.234.567"],
    ["1.5000", "15.000"],
    ["1500,5", "1.500,5"],
    ["1500,567", "1.500,56"],
    ["12.", "12,"],
    [",5", "0,5"],
    ["0012", "12"],
    ["R$ 2.000,00", "2.000,00"],
    ["abc", ""],
    ["1500.50", "1.500,50"], // colado com ponto decimal
    ["1500.5", "1.500,5"],
  ])("enquanto digita: %s → %s", (digitado, esperado) => {
    expect(mascararReais(digitado)).toBe(esperado);
  });

  it.each([
    ["300", "300,00"],
    ["1.500", "1.500,00"],
    ["3,5", "3,50"],
    ["", ""],
  ])("ao sair do campo: %s → %s", (digitado, esperado) => {
    expect(completarReais(digitado)).toBe(esperado);
  });

  it("apagar um dígito não transforma milhar em decimal", () => {
    expect(mascararReais("1.50", false)).toBe("150");
    expect(mascararReais("12.34", false)).toBe("1.234");
    // Selecionar "500" de "1.500" e digitar "2": o ponto é o milhar que já estava.
    expect(mascararReais("1.2", false)).toBe("12");
    expect(mascararReais("1.", false)).toBe("1");
  });

  it("o texto mascarado converte certo mesmo sem sair do campo", () => {
    expect(reaisParaCentavos("1.500")).toBe(150000);
    expect(reaisParaCentavos("1.234.567")).toBe(123456700);
    expect(reaisParaCentavos("1.500,5")).toBe(150050);
  });

  it("o valor formatado volta em centavos", () => {
    expect(reaisParaCentavos(completarReais("1500"))).toBe(150000);
    expect(reaisParaCentavos(completarReais("1234567,8"))).toBe(123456780);
  });
});

describe("seis modelos (ADR-015)", () => {
  it("cada modelo novo começa com os seus módulos e passa no validador", () => {
    for (const modelo of [
      "controle_financeiro",
      "clientes_cobrancas",
      "agenda_simples",
      "controle_estoque",
    ] as const) {
      const d = rascunhoPadrao("Teste", modelo);
      expect(d.modulos).toEqual([...MODULOS_POR_MODELO[modelo]]);
      expect(bloqueantes(d), modelo).toEqual([]);
    }
  });

  it("agenda simples já vem com recursos, responsáveis e reserva de 1 hora", () => {
    const d = rascunhoPadrao("Quadras", "agenda_simples");
    expect(d.aparencia.rotulos_menu).toMatchObject({
      profissionais: "Recursos",
      clientes: "Responsáveis",
      agenda: "Reservas",
    });
    expect(d.tipos_atendimento).toEqual([
      { id: "reserva", rotulo: "Reserva", duracao_minutos: 60 },
    ]);
  });

  it("saindo da agenda simples, os nomes dela saem; os do dono ficam", () => {
    const d = rascunhoPadrao("Quadras", "agenda_simples");
    d.aparencia.rotulos_menu = { ...d.aparencia.rotulos_menu, clientes: "Alunos" };
    const servicos = reconciliarModelo(comModelo(d, "servicos"), "agenda_simples");
    expect(servicos.aparencia.rotulos_menu).toEqual({ clientes: "Alunos" });
    expect(servicos.tipos_atendimento).toEqual([]);
  });

  it("entre outros modelos, nomes iguais aos da agenda simples são do dono e ficam", () => {
    const d = comModelo(rascunhoPadrao("Salão"), "servicos");
    d.aparencia.rotulos_menu = { profissionais: "Recursos" };
    d.tipos_atendimento = [{ id: "reserva", rotulo: "Reserva", duracao_minutos: 120 }];
    const r = reconciliarModelo(comModelo(d, "comercio_com_servicos"), "servicos");
    expect(r.aparencia.rotulos_menu).toEqual({ profissionais: "Recursos" });
    expect(r.tipos_atendimento).toHaveLength(1);
  });
});

describe("controle de estoque no lugar da agenda simples (2026-11-17)", () => {
  it("a tela inicial oferece seis modelos, com o controle de estoque e sem a agenda simples", () => {
    const ids = MODELOS.map((m) => m.id);
    expect(ids).toHaveLength(6);
    expect(ids).toContain("controle_estoque");
    expect(ids).not.toContain("agenda_simples");
  });

  it("sistema que já usa a agenda simples continua vendo o próprio modelo", () => {
    expect(modelosParaEscolher("agenda_simples").map((m) => m.id)).toContain("agenda_simples");
    expect(modelosParaEscolher("comercio")).toHaveLength(6);
  });

  it("controle de estoque: só produtos e estoque, com a saída por motivo já ligada", () => {
    const d = rascunhoPadrao("Almoxarifado", "controle_estoque");
    expect(d.modulos).toEqual(["produtos", "estoque"]);
    expect(d.regras.map((r) => r.tipo)).toEqual(["saida_manual"]);
    expect(d.campos).toEqual([]);
    expect(bloqueantes(d)).toEqual([]);
  });

  it("sem a saída com motivo, o controle de estoque não passa no validador", () => {
    const d = { ...rascunhoPadrao("Almoxarifado", "controle_estoque"), regras: [] };
    expect(bloqueantes(d).map((i) => i.code)).toContain("parametro_obrigatorio_ausente");
  });
});

describe("telefone e e-mail de fábrica nos clientes (2026-11-17)", () => {
  it("sistema novo com clientes já traz as duas colunas, e passa no validador", () => {
    for (const modelo of ["comercio", "servicos", "clientes_cobrancas"] as const) {
      const d = rascunhoPadrao("Teste", modelo);
      expect(
        d.campos.map((c) => [c.entidade, c.rotulo]),
        modelo,
      ).toEqual([
        ["clientes", "Telefone"],
        ["clientes", "E-mail"],
      ]);
      // Comércio e serviços ainda pedem ao dono o prazo da reserva e os atendimentos; os campos
      // de fábrica não bloqueiam nada.
      expect(
        bloqueantes(d).filter((i) => i.path.startsWith("campos")),
        modelo,
      ).toEqual([]);
    }
    expect(bloqueantes(rascunhoPadrao("Aulas", "clientes_cobrancas"))).toEqual([]);
  });

  it("no rascunho novo, quando clientes entra com a troca de modelo, as colunas vêm junto", () => {
    const d = rascunhoPadrao("Teste", "controle_estoque");
    const r = reconciliarModelo(comModelo(d, "clientes_cobrancas"), "controle_estoque");
    expect(r.campos.map((c) => c.rotulo)).toEqual(["Telefone", "E-mail"]);
  });

  it("se clientes já existia, a coluna que o dono tirou não volta", () => {
    const d = rascunhoPadrao("Teste", "comercio");
    d.campos = d.campos.filter((c) => c.id !== "telefone");
    const r = reconciliarModelo(comModelo(d, "comercio_com_servicos"), "comercio");
    expect(r.campos.map((c) => c.rotulo)).toEqual(["E-mail"]);
  });

  it("sem clientes, nada de colunas de fábrica", () => {
    expect(rascunhoPadrao("Casa", "controle_financeiro").campos).toEqual([]);
  });

  it("uma coluna extra chamada Sobrenome agora duplica o campo próprio", () => {
    const d = rascunhoPadrao("Loja", "comercio");
    d.campos.push({
      id: "sobrenome",
      entidade: "clientes",
      rotulo: "Sobrenome",
      tipo: "texto",
      obrigatorio: false,
    });
    expect(bloqueantes(d).length).toBeGreaterThan(0);
  });
});
