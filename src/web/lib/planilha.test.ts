import { describe, expect, it } from "vitest";
import type { ProdutoDto } from "../../shared/api";
import { lerClientes, lerProdutos, lerTabela, sugestaoDeReposicao } from "./planilha";

const SEM_REGRAS = { atacado: false, caixa: false, estoque: true };

describe("ler planilha", () => {
  it("entende colado do Excel (tabulação), CSV com ponto e vírgula e aspas", () => {
    expect(lerTabela("Nome\tPreço\nCerveja\t5,00")).toEqual([
      ["Nome", "Preço"],
      ["Cerveja", "5,00"],
    ]);
    expect(lerTabela('nome;preco\n"Vinho; tinto";45,90\n')).toEqual([
      ["nome", "preco"],
      ["Vinho; tinto", "45,90"],
    ]);
    expect(lerTabela("nome,preco\nÁgua,3.5")).toEqual([
      ["nome", "preco"],
      ["Água", "3.5"],
    ]);
  });

  it("lê produtos pelos títulos, em qualquer ordem, com valores em reais", () => {
    const r = lerProdutos(
      "Código de barras\tProduto\tQtd\tPreço de venda\tMínimo\n789\tCerveja lata\t1.200\tR$ 1.500,50\t50",
      SEM_REGRAS,
    );
    expect(r.erros).toEqual([]);
    expect(r.linhas).toEqual([
      {
        nome: "Cerveja lata",
        varejoCentavos: 150050,
        estoque: 1200,
        estoqueMinimo: 50,
        codigoBarras: "789",
      },
    ]);
  });

  it("sem títulos, a ordem é nome, preço e estoque", () => {
    const r = lerProdutos("Arroz;28,90;10\nFeijão;8,99;", SEM_REGRAS);
    expect(r.comCabecalho).toBe(false);
    expect(r.linhas).toEqual([
      { nome: "Arroz", varejoCentavos: 2890, estoque: 10, estoqueMinimo: null },
      { nome: "Feijão", varejoCentavos: 899, estoque: null, estoqueMinimo: null },
    ]);
  });

  it("aponta a linha com problema e pede atacado quando o sistema vende no atacado", () => {
    const r = lerProdutos("nome;preco;atacado\nCerveja;5,00;\nÁgua;abc;2,00\n;3,00;2,00", {
      atacado: true,
      caixa: false,
      estoque: false,
    });
    expect(r.linhas).toEqual([]);
    expect(r.erros).toEqual([
      "Linha 2 (Cerveja): informe o preço de atacado.",
      "Linha 3 (Água): preço inválido.",
      "Linha 4: falta o nome.",
    ]);
  });

  it("clientes: a primeira coluna, pulando o título", () => {
    expect(lerClientes("Cliente\tTelefone\nBar do Zé\t5199\n\nMercado Bom").linhas).toEqual([
      { nome: "Bar do Zé" },
      { nome: "Mercado Bom" },
    ]);
  });
});

describe("reposição sugerida", () => {
  const p = (nome: string, disponivel: number, estoqueMinimo: number | null, status = "active") =>
    ({ id: nome, nome, disponivel, estoqueMinimo, status }) as ProdutoDto;

  it("leva ao dobro do mínimo só quem está abaixo dele", () => {
    const r = sugestaoDeReposicao([
      p("Vinho", 3, 5),
      p("Cerveja", 60, 50),
      p("Água", 0, null),
      p("Suco", 1, 10, "inactive"),
    ]);
    expect(r.map((x) => [x.produto.nome, x.unidades])).toEqual([["Vinho", 7]]);
  });
});
