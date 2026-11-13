import { describe, expect, it } from "vitest";
import { validateDraft } from "../../shared/contract/validate";
import type { ConfigDraft } from "@/types/nexus";
import {
  comRequisitosGerados,
  MODULOS_POR_MODELO,
  rascunhoPadrao,
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
