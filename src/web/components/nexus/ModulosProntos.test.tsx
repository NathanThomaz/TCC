import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModulosProntos } from "./ModulosProntos";

// O quadro do que vem pronto não anuncia como ativo o que depende de uma regra desligada.

afterEach(cleanup);

describe("O que vem pronto", () => {
  it("na escolha do modelo, recursos e campos que dependem de regra aparecem como opcionais", () => {
    render(<ModulosProntos modulos={["produtos", "vendas"]} titulo="Pronto" />);
    expect(screen.getByText("Venda por caixa (opcional)")).toBeTruthy();
    expect(screen.getByText(/Preço de atacado \(opcional\)/)).toBeTruthy();
    expect(screen.getByText(/Unidades por caixa \(opcional\)/)).toBeTruthy();
  });

  it("no sistema montado sem atacado nem caixa, eles não aparecem", () => {
    render(
      <ModulosProntos
        modulos={["produtos", "vendas"]}
        titulo="Pronto"
        regras={[{ tipo: "prazo_reserva", minutos: 120, requisitos: ["REQ-02"] }]}
      />,
    );
    const texto = document.body.textContent ?? "";
    expect(texto).not.toMatch(/atacado|caixa/i);
    expect(screen.getByText("Pedido em rascunho que reserva o estoque")).toBeTruthy();
  });

  it("com as regras ligadas, aparecem como ativos", () => {
    render(
      <ModulosProntos
        modulos={["produtos"]}
        titulo="Pronto"
        regras={[
          { tipo: "limite_atacado", valor_centavos: 150000, requisitos: ["REQ-02"] },
          { tipo: "unidades_por_caixa", unidades: 12, requisitos: ["REQ-03"] },
        ]}
      />,
    );
    expect(screen.getByText("Venda por caixa")).toBeTruthy();
    expect(screen.getByText(/Preço de atacado · Unidades por caixa/)).toBeTruthy();
  });
});
