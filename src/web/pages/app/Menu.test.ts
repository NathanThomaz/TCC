import { describe, expect, it } from "vitest";
import { MENU } from "./Aplicacao";
import { margem } from "./Produtos";

describe("menu do sistema", () => {
  it("segue a ordem de uso: cadastros, dia a dia e dinheiro", () => {
    expect(MENU.map((m) => m.caminho)).toEqual([
      "clientes",
      "profissionais",
      "produtos",
      "fornecedores",
      "vendas",
      "agenda",
      "compras",
      "estoque",
      "financeiro",
    ]);
  });
});

describe("margem do produto", () => {
  it("é calculada sobre o preço de venda; sem valor de compra, não aparece", () => {
    expect(margem(500, 300)).toBe("40%");
    expect(margem(500, 600)).toBe("-20%");
    expect(margem(500, null)).toBeNull();
  });
});
