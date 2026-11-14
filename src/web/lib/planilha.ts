import type { ProdutoDto } from "../../shared/api";
import { normalizarRotulo } from "../../shared/contract/catalog";
import { reaisParaCentavos } from "./nexus";

// Importar de planilha (pedido do dono, 2026-11-14): a pessoa cola as linhas copiadas do Excel
// (separadas por tabulação) ou envia um CSV (";" ou ","). A primeira linha pode ter os nomes das
// colunas; sem ela, a ordem é nome, preço e estoque. Tudo é conferido antes de enviar.

/** Linhas e células, com aspas do CSV. */
export function lerTabela(texto: string): string[][] {
  const linhas = texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (linhas.length === 0) return [];
  const primeira = linhas[0]!;
  const sep = primeira.includes("\t")
    ? "\t"
    : (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  return linhas.map((linha) => {
    const celulas: string[] = [];
    let atual = "";
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i]!;
      if (c === '"') {
        if (aspas && linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else aspas = !aspas;
      } else if (c === sep && !aspas) {
        celulas.push(atual.trim());
        atual = "";
      } else atual += c;
    }
    celulas.push(atual.trim());
    return celulas;
  });
}

type Coluna = "nome" | "preco" | "atacado" | "caixa" | "estoque" | "minimo" | "codigo";

const NOMES: Record<Coluna, string[]> = {
  nome: ["nome", "produto", "item", "descricao", "nome do produto"],
  preco: ["preco", "preco de venda", "valor", "varejo", "preco varejo", "preco de varejo", "venda"],
  atacado: ["atacado", "preco atacado", "preco de atacado"],
  caixa: ["caixa", "unidades por caixa", "un por caixa", "qtd por caixa"],
  estoque: ["estoque", "quantidade", "qtd", "qtde", "saldo", "quantidade em estoque"],
  minimo: ["minimo", "estoque minimo", "aviso", "avisar abaixo de"],
  codigo: ["codigo", "codigo de barras", "ean", "gtin", "barras", "cod barras"],
};

/** Mapa coluna → posição, se a primeira linha for de títulos (tem nome e preço). */
function cabecalho(celulas: string[]): Partial<Record<Coluna, number>> | null {
  const mapa: Partial<Record<Coluna, number>> = {};
  celulas.forEach((c, i) => {
    const n = normalizarRotulo(c);
    for (const [col, nomes] of Object.entries(NOMES) as [Coluna, string[]][]) {
      if (mapa[col] === undefined && nomes.includes(n)) mapa[col] = i;
    }
  });
  return mapa.nome !== undefined && mapa.preco !== undefined ? mapa : null;
}

/** Quantidade inteira ("1.200" = 1200); vazio = null; inválida = NaN. */
function inteiro(texto: string | undefined): number | null {
  const t = (texto ?? "").replace(/[\s.]/g, "");
  if (t === "") return null;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
}

export interface LinhaProduto {
  nome: string;
  varejoCentavos: number;
  atacadoCentavos?: number | null;
  unidadesPorCaixa?: number | null;
  estoque?: number | null;
  estoqueMinimo?: number | null;
  codigoBarras?: string | null;
}

/** O que o sistema aceita: colunas de atacado, caixa e estoque só valem se ele tiver. */
export interface RegrasImportacao {
  atacado: boolean;
  caixa: boolean;
  estoque: boolean;
}

export function lerProdutos(texto: string, regras: RegrasImportacao) {
  const tabela = lerTabela(texto);
  const mapa = tabela[0] ? cabecalho(tabela[0]) : null;
  const corpo = mapa ? tabela.slice(1) : tabela;
  const pos: Partial<Record<Coluna, number>> = mapa ?? { nome: 0, preco: 1, estoque: 2 };
  const linhas: LinhaProduto[] = [];
  const erros: string[] = [];
  corpo.forEach((c, i) => {
    const n = i + 1 + (mapa ? 1 : 0);
    const cel = (col: Coluna) => (pos[col] === undefined ? undefined : c[pos[col]]);
    const nome = (cel("nome") ?? "").trim();
    if (!nome) return erros.push(`Linha ${n}: falta o nome.`);
    const preco = reaisParaCentavos(cel("preco") ?? "");
    if (preco === null || preco <= 0) return erros.push(`Linha ${n} (${nome}): preço inválido.`);
    const linha: LinhaProduto = { nome: nome.slice(0, 120), varejoCentavos: preco };
    if (regras.atacado) {
      const atacado = reaisParaCentavos(cel("atacado") ?? "");
      if (atacado === null || atacado <= 0) {
        return erros.push(`Linha ${n} (${nome}): informe o preço de atacado.`);
      }
      linha.atacadoCentavos = atacado;
    }
    if (regras.caixa) {
      const caixa = inteiro(cel("caixa"));
      if (Number.isNaN(caixa) || (caixa !== null && caixa < 2)) {
        return erros.push(`Linha ${n} (${nome}): unidades por caixa inválidas.`);
      }
      linha.unidadesPorCaixa = caixa;
    }
    if (regras.estoque) {
      const estoque = inteiro(cel("estoque"));
      const minimo = inteiro(cel("minimo"));
      if (Number.isNaN(estoque) || Number.isNaN(minimo) || minimo === 0) {
        return erros.push(
          `Linha ${n} (${nome}): estoque ou mínimo inválido (use números inteiros).`,
        );
      }
      linha.estoque = estoque;
      linha.estoqueMinimo = minimo;
    }
    const codigo = (cel("codigo") ?? "").replace(/\s/g, "");
    if (codigo) {
      if (!/^[0-9A-Za-z.-]{1,64}$/.test(codigo)) {
        return erros.push(`Linha ${n} (${nome}): código de barras inválido.`);
      }
      linha.codigoBarras = codigo;
    }
    linhas.push(linha);
  });
  return { linhas, erros, comCabecalho: mapa !== null };
}

/** Clientes: a primeira coluna é o nome (a linha de título "Nome"/"Cliente" é pulada). */
export function lerClientes(texto: string) {
  const tabela = lerTabela(texto);
  const titulo =
    tabela[0] &&
    ["nome", "cliente", "clientes", "razao social"].includes(normalizarRotulo(tabela[0][0] ?? ""));
  const nomes = (titulo ? tabela.slice(1) : tabela)
    .map((c) => (c[0] ?? "").trim().slice(0, 120))
    .filter(Boolean);
  return { linhas: nomes.map((nome) => ({ nome })) };
}

/**
 * Reposição sugerida: produtos ativos abaixo do próprio mínimo, com a quantidade que leva o
 * disponível ao dobro do mínimo.
 */
export function sugestaoDeReposicao(produtos: ProdutoDto[]) {
  return produtos
    .filter(
      (p) => p.status === "active" && p.estoqueMinimo !== null && p.disponivel < p.estoqueMinimo,
    )
    .map((p) => ({ produto: p, unidades: p.estoqueMinimo! * 2 - p.disponivel }));
}
