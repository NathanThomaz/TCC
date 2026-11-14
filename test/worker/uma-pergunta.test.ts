import { describe, expect, it } from "vitest";
import { AVISO_REVISAO, comAvisoDeAlteracao, umaPergunta } from "../../src/worker/modules/criacao";

// Uma pergunta por mensagem na entrevista, garantida pelo backend (pedido do dono, 2026-11-14).

describe("umaPergunta", () => {
  it("separa duas perguntas emendadas por 'e qual'", () => {
    expect(
      umaPergunta(
        "Ótimo, incluirei campos para CPF e telefone. Qual o nome da sua loja e qual cor principal você gostaria de usar?",
      ),
    ).toEqual({
      texto: "Ótimo, incluirei campos para CPF e telefone. Qual o nome da sua loja?",
      cortada: true,
    });
  });

  it("corta a segunda interrogação", () => {
    expect(umaPergunta("Você vende no atacado? E por caixa?")).toEqual({
      texto: "Você vende no atacado?",
      cortada: true,
    });
  });

  it("pergunta única fica igual, inclusive com 'e' dentro da frase", () => {
    const t = "Você vende no atacado e no varejo, ou só no varejo?";
    expect(umaPergunta(t)).toEqual({ texto: t, cortada: false });
    expect(umaPergunta("Anotado. Qual a cor principal?")).toEqual({
      texto: "Anotado. Qual a cor principal?",
      cortada: false,
    });
  });

  it("'onde e quando' é uma pergunta só (revisão do Codex)", () => {
    const t = "Você quer registrar onde e quando cada atendimento acontece?";
    expect(umaPergunta(t)).toEqual({ texto: t, cortada: false });
  });

  it("'quanto… e quanto…' é uma pergunta só", () => {
    const t = "Deseja registrar quanto compra e quanto vende?";
    expect(umaPergunta(t)).toEqual({ texto: t, cortada: false });
  });

  it("mensagem sem pergunta fica igual", () => {
    expect(umaPergunta("Tudo certo por aqui.")).toEqual({
      texto: "Tudo certo por aqui.",
      cortada: false,
    });
  });
});

describe("revisão final", () => {
  it("sempre avisa que o sistema pode ser alterado depois, sem repetir", () => {
    expect(comAvisoDeAlteracao("Seu sistema está pronto.")).toBe(
      `Seu sistema está pronto. ${AVISO_REVISAO}`,
    );
    const ja = "Pronto! Depois você pode usar “Alterar sistema”.";
    expect(comAvisoDeAlteracao(ja)).toBe(ja);
  });
});
