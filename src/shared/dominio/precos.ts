// Regras de preço e quantidade da venda (seção 10). Funções puras: o Worker calcula e grava, o
// front usa as mesmas para mostrar a prévia do total — o valor que vale é sempre o do backend.

export interface ItemPrecificado {
  /** Quantidade total em unidades (caixas já convertidas, PRE-05). */
  unidades: number;
  varejoCentavos: number;
  /** NULL quando o sistema não tem limite de atacado. */
  atacadoCentavos: number | null;
}

export interface Totais {
  /** PRE-02: base de elegibilidade = subtotal dos produtos a preço de varejo. */
  subtotalVarejoCentavos: number;
  totalCentavos: number;
  faixa: "varejo" | "atacado";
  /** Total de cada item, na mesma ordem, já na faixa aplicada. */
  linhas: number[];
}

/** PRE-05: caixa = unidades por caixa × quantidade; não existe preço separado de caixa. */
export function unidadesDoItem(
  caixas: number,
  unidadesSoltas: number,
  unidadesPorCaixa: number | null,
): number {
  if (caixas > 0 && unidadesPorCaixa === null) {
    throw new RangeError("Produto sem caixa não pode ser vendido em caixas.");
  }
  return caixas * (unidadesPorCaixa ?? 0) + unidadesSoltas;
}

/**
 * PRE-02/PRE-03: atacado quando o subtotal a varejo atinge o limite, inclusive (T13). Sem
 * limite (NULL), tudo é varejo. PRE-08: não há desconto manual.
 */
export function calcularTotais(itens: ItemPrecificado[], limiteAtacado: number | null): Totais {
  const subtotal = itens.reduce((soma, item) => soma + item.unidades * item.varejoCentavos, 0);
  const atacado = limiteAtacado !== null && subtotal >= limiteAtacado;
  const linhas = itens.map((item) => {
    if (!atacado) return item.unidades * item.varejoCentavos;
    if (item.atacadoCentavos === null) {
      // Impossível por construção: com limite de atacado, o produto exige preço de atacado.
      throw new RangeError("Item sem preço de atacado num sistema com atacado.");
    }
    return item.unidades * item.atacadoCentavos;
  });
  return {
    subtotalVarejoCentavos: subtotal,
    totalCentavos: linhas.reduce((soma, linha) => soma + linha, 0),
    faixa: atacado ? "atacado" : "varejo",
    linhas,
  };
}

/** R$ 1.234,56 a partir de centavos inteiros. */
export function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
