import { describe, expect, it } from "vitest";
import { adaptForGemini, configDraftGeminiSchema } from "../../src/shared/contract/gemini-schema";
import type { ConfigDraft } from "../../src/shared/contract/schema";
import { validateDraft } from "../../src/shared/contract/validate";

// Caso demonstrativo (seção 26), com dados fictícios.
function distribuidora(): ConfigDraft {
  return {
    modelo: "comercio_com_servicos",
    modulos: ["clientes", "produtos", "vendas", "estoque", "profissionais", "agenda"],
    aparencia: {
      nome: "Distribuidora Exemplo",
      cor_primaria: "#1f4e79",
      cor_destaque: "#f2a900",
      titulo: "Distribuidora Exemplo",
    },
    requisitos: [
      { id: "REQ-01", texto: "Atacado a partir de R$ 1.000 em produtos", status: "confirmado" },
      { id: "REQ-02", texto: "Cerveja em lata vendida em caixa com 12", status: "confirmado" },
      { id: "REQ-03", texto: "Estoque reservado por 30 minutos no pedido", status: "confirmado" },
      {
        id: "REQ-04",
        texto: "Instalação e retirada da chopeira pelo mesmo técnico",
        status: "confirmado",
      },
    ],
    campos: [
      {
        id: "tipo_evento",
        entidade: "clientes",
        rotulo: "Tipo de evento",
        tipo: "lista",
        opcoes: ["Aniversário", "Casamento", "Corporativo"],
        obrigatorio: false,
      },
    ],
    tipos_atendimento: [
      { id: "instalacao", rotulo: "Instalação da chopeira", duracao_minutos: 60 },
      { id: "retirada", rotulo: "Retirada da chopeira", duracao_minutos: 60 },
    ],
    regras: [
      { tipo: "limite_atacado", valor_centavos: 100_000, requisitos: ["REQ-01"] },
      { tipo: "unidades_por_caixa", unidades: 12, requisitos: ["REQ-02"] },
      { tipo: "prazo_reserva", minutos: 30, requisitos: ["REQ-03"] },
      {
        tipo: "par_atendimento",
        primeiro: "instalacao",
        segundo: "retirada",
        requisitos: ["REQ-04"],
      },
    ],
    fora_do_catalogo: [],
  };
}

function codes(input: unknown): string[] {
  return validateDraft(input).issues.map((issue) => issue.code);
}

describe("validateDraft — caso válido", () => {
  it("aceita a distribuidora completa sem erros bloqueantes", () => {
    const result = validateDraft(distribuidora());

    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("aceita um sistema de serviços sem módulos de venda", () => {
    const draft = distribuidora();
    draft.modelo = "servicos";
    draft.modulos = ["clientes", "profissionais", "agenda"];
    draft.regras = draft.regras.filter((r) => r.tipo === "par_atendimento");

    expect(validateDraft(draft).ok).toBe(true);
  });

  it("registra pedido fora do catálogo como aviso, sem bloquear (seção 5)", () => {
    const draft = distribuidora();
    draft.fora_do_catalogo = [{ texto: "Emitir nota fiscal", requisito: "REQ-01" }];
    const result = validateDraft(draft);

    expect(result.ok).toBe(true);
    expect(result.issues).toMatchObject([{ code: "fora_do_catalogo", severity: "aviso" }]);
  });
});

describe("validateDraft — erros bloqueantes (T07)", () => {
  it("recusa tipo de regra fora do catálogo, como o Gemini inventou na prova", () => {
    const draft = { ...distribuidora(), regras: [{ tipo: "desconto_atacado", valor: 100000 }] };

    expect(validateDraft(draft).ok).toBe(false);
    expect(codes(draft)).toContain("estrutura_invalida");
  });

  it("recusa parâmetro desconhecido em qualquer nível, em vez de descartá-lo", () => {
    const naRegra = distribuidora() as unknown as { regras: Record<string, unknown>[] };
    naRegra.regras[0] = { ...naRegra.regras[0], desconto_percentual: 99 };
    const naRaiz = { ...distribuidora(), modo_turbo: true };
    const naAparencia = distribuidora() as unknown as { aparencia: Record<string, unknown> };
    naAparencia.aparencia.fonte = "Comic Sans";

    for (const draft of [naRegra, naRaiz, naAparencia]) {
      expect(validateDraft(draft).ok).toBe(false);
      expect(codes(draft)).toContain("estrutura_invalida");
    }
  });

  it("exige o conjunto exato de módulos do modelo e as dependências", () => {
    const draft = distribuidora();
    draft.modelo = "comercio";
    draft.modulos = ["produtos", "vendas"];

    expect(codes(draft)).toEqual(
      expect.arrayContaining([
        "modulos_incompativeis_com_modelo",
        "dependencia_ausente",
        "modulo_inativo",
      ]),
    );
  });

  it("bloqueia requisito pendente e regra apoiada nele (T05, T06)", () => {
    const draft = distribuidora();
    draft.requisitos[2] = { ...draft.requisitos[2]!, status: "pendente" };

    expect(codes(draft)).toEqual(
      expect.arrayContaining(["requisito_pendente", "regra_sem_requisito_confirmado"]),
    );
  });

  it("não inventa prazo de reserva: ausente com vendas é bloqueante", () => {
    const draft = distribuidora();
    draft.regras = draft.regras.filter((r) => r.tipo !== "prazo_reserva");

    expect(codes(draft)).toContain("parametro_obrigatorio_ausente");
  });

  it("aponta referências inexistentes a requisitos e tipos de atendimento", () => {
    const draft = distribuidora();
    draft.regras = [
      { tipo: "limite_atacado", valor_centavos: 100_000, requisitos: ["REQ-99"] },
      { tipo: "prazo_reserva", minutos: 30, requisitos: ["REQ-03"] },
      {
        tipo: "par_atendimento",
        primeiro: "instalacao",
        segundo: "manutencao",
        requisitos: ["REQ-04"],
      },
    ];
    const result = validateDraft(draft);

    expect(
      result.issues.filter((i) => i.code === "referencia_inexistente").map((i) => i.path),
    ).toEqual(["regras.0.requisitos.0", "regras.2.segundo"]);
  });

  it("recusa par com o mesmo tipo e tipo usado em dois pares", () => {
    const draft = distribuidora();
    draft.regras.push({
      tipo: "par_atendimento",
      primeiro: "retirada",
      segundo: "retirada",
      requisitos: ["REQ-04"],
    });

    expect(codes(draft).filter((c) => c === "par_invalido").length).toBeGreaterThanOrEqual(2);
  });

  it("valida opções de campos de lista e regra repetida", () => {
    const draft = distribuidora();
    draft.campos = [
      {
        id: "porte",
        entidade: "clientes",
        rotulo: "Porte",
        tipo: "lista",
        opcoes: ["A"],
        obrigatorio: false,
      },
      {
        id: "obs",
        entidade: "produtos",
        rotulo: "Obs",
        tipo: "texto",
        opcoes: ["x"],
        obrigatorio: false,
      },
      {
        id: "nota",
        entidade: "agendamentos",
        rotulo: "Nota",
        tipo: "lista",
        opcoes: ["Sim", "sim"],
        obrigatorio: false,
      },
    ];
    draft.regras.push({ tipo: "limite_atacado", valor_centavos: 50_000, requisitos: ["REQ-01"] });

    expect(codes(draft)).toEqual(
      expect.arrayContaining([
        "opcoes_insuficientes",
        "opcoes_indevidas",
        "opcao_repetida",
        "regra_repetida",
      ]),
    );
  });

  it("recusa campo em entidade de módulo inativo", () => {
    const draft = distribuidora();
    draft.modelo = "comercio";
    draft.modulos = ["clientes", "produtos", "vendas", "estoque"];
    draft.tipos_atendimento = [];
    draft.regras = draft.regras.filter((r) => r.tipo !== "par_atendimento");
    draft.campos = [
      { id: "local", entidade: "agendamentos", rotulo: "Local", tipo: "texto", obrigatorio: false },
    ];

    expect(codes(draft)).toEqual(["modulo_inativo"]);
  });
});

describe("schema para o Gemini", () => {
  it("troca oneOf por anyOf, const por enum e remove $schema em todo o schema", () => {
    const text = JSON.stringify(configDraftGeminiSchema());

    expect(text).not.toMatch(/"oneOf"|"const"|"\$schema"/);
    expect(text).toContain('"anyOf"');
    expect(text).toContain('"enum":["par_atendimento"]');
  });

  it("preserva o restante do schema", () => {
    expect(adaptForGemini({ oneOf: [{ const: "a" }], type: "object" })).toEqual({
      anyOf: [{ enum: ["a"] }],
      type: "object",
    });
  });
});
