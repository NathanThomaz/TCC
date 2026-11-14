import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CampoDinheiro } from "./CampoDinheiro";

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
});
