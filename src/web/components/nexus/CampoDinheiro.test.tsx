import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CampoDinheiro, posicaoSignificativa } from "./CampoDinheiro";

afterEach(cleanup);

function Campo({ inicial = "" }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  return <CampoDinheiro aria-label="Valor" valor={valor} onValor={setValor} />;
}

describe("CampoDinheiro", () => {
  it("formata ao digitar e completa as casas ao sair", () => {
    render(<Campo />);
    const campo = screen.getByLabelText<HTMLInputElement>("Valor");
    fireEvent.change(campo, { target: { value: "1500" } });
    expect(campo.value).toBe("1.500");
    fireEvent.blur(campo);
    expect(campo.value).toBe("1.500,00");
  });

  it("mantém o cursor depois do dígito inserido no meio do valor", () => {
    render(<Campo inicial="123,45" />);
    const campo = screen.getByLabelText<HTMLInputElement>("Valor");
    campo.focus();
    // "9" digitado no começo: o navegador entrega "9123,45" com o cursor depois do 9.
    fireEvent.change(campo, { target: { value: "9123,45", selectionStart: 1, selectionEnd: 1 } });
    expect(campo.value).toBe("9.123,45");
    expect(campo.selectionStart).toBe(1);
  });

  it("apagar um dígito de um milhar não vira decimal", () => {
    render(<Campo inicial="1.500" />);
    const campo = screen.getByLabelText<HTMLInputElement>("Valor");
    campo.focus();
    fireEvent.change(campo, { target: { value: "1.50", selectionStart: 4, selectionEnd: 4 } });
    expect(campo.value).toBe("150");
  });

  /** Digitação real: o navegador muda o texto, põe o cursor e dispara o input com o tipo. */
  function digitar(campo: HTMLInputElement, valor: string, cursor: number, tipo: string) {
    // O setter do protótipo muda o texto sem passar pelo controle do React (como o navegador).
    const descritor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- aplicado ao próprio campo
    Reflect.apply(descritor.set!, campo, [valor]);
    campo.setSelectionRange(cursor, cursor);
    campo.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: tipo }));
  }

  it("ponto digitado vira vírgula com o cursor depois dela, e a sequência fecha certo", () => {
    render(<Campo inicial="1.500" />);
    const campo = screen.getByLabelText<HTMLInputElement>("Valor");
    campo.focus();
    digitar(campo, "1.500.", 6, "insertText");
    expect(campo.value).toBe("1.500,");
    expect(campo.selectionStart).toBe(6);
    digitar(campo, "1.500,5", 7, "insertText");
    fireEvent.blur(campo);
    expect(campo.value).toBe("1.500,50");
  });

  it("colar um valor com ponto decimal sobre outro maior não é tratado como apagar", () => {
    render(<Campo inicial="100.000,00" />);
    const campo = screen.getByLabelText<HTMLInputElement>("Valor");
    campo.focus();
    digitar(campo, "1500.50", 7, "insertFromPaste");
    expect(campo.value).toBe("1.500,50");
    expect(campo.selectionStart).toBe(8);
  });

  it("zero à esquerda some sem levar o cursor para o fim", () => {
    render(<Campo inicial="123,45" />);
    const campo = screen.getByLabelText<HTMLInputElement>("Valor");
    campo.focus();
    digitar(campo, "0123,45", 1, "insertText");
    expect(campo.value).toBe("123,45");
    expect(campo.selectionStart).toBe(0);
  });

  it("posição significativa conta o ponto que vira vírgula e desconta zeros removidos", () => {
    expect(posicaoSignificativa("1.500.", 6, "1.500,")).toBe(5);
    expect(posicaoSignificativa("1500.50", 7, "1.500,50")).toBe(7);
    expect(posicaoSignificativa("0123,45", 1, "123,45")).toBe(0);
  });
});
