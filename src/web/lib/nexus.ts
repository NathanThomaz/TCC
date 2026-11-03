import type { Campo, ConfigDraft, Modelo, Modulo } from "@/types/nexus";

export const MODULOS_POR_MODELO: Record<Modelo, Modulo[]> = {
  comercio: ["clientes", "produtos", "vendas", "estoque"],
  servicos: ["clientes", "profissionais", "agenda"],
  comercio_com_servicos: ["clientes", "produtos", "vendas", "estoque", "profissionais", "agenda"],
};

export const ROTULO_MODULO: Record<Modulo, string> = {
  clientes: "Clientes",
  produtos: "Produtos",
  vendas: "Vendas",
  estoque: "Estoque",
  profissionais: "Profissionais",
  agenda: "Agenda",
};

export type Entidade = Campo["entidade"];
export const ROTULO_ENTIDADE: Record<Entidade, string> = {
  clientes: "Clientes",
  produtos: "Produtos",
  profissionais: "Profissionais",
  vendas: "Vendas",
  agendamentos: "Agendamentos",
};

export function entidadesDosModulos(modulos: Modulo[]): Entidade[] {
  const out: Entidade[] = [];
  if (modulos.includes("clientes")) out.push("clientes");
  if (modulos.includes("produtos")) out.push("produtos");
  if (modulos.includes("profissionais")) out.push("profissionais");
  if (modulos.includes("vendas")) out.push("vendas");
  if (modulos.includes("agenda")) out.push("agendamentos");
  return out;
}

export const PASSOS = [
  "Modelo",
  "Requisitos",
  "Aparência",
  "Campos informativos",
  "Atendimentos",
  "Regras",
  "Fora do catálogo",
  "Revisão e validação",
] as const;

/** Mapeia o `path` de um diagnóstico para o passo (1–8) do assistente. */
export function passoDoPath(path: string): number {
  const raiz = path.split(/[.[]/)[0];
  switch (raiz) {
    case "modelo":
    case "modulos":
      return 1;
    case "requisitos":
      return 2;
    case "aparencia":
      return 3;
    case "campos":
      return 4;
    case "tipos_atendimento":
      return 5;
    case "regras":
      return 6;
    case "fora_do_catalogo":
      return 7;
    default:
      return 8;
  }
}

export function validarNomeSistema(nome: string): string | null {
  const n = nome.trim();
  if (n.length < 1) return "Informe um nome.";
  if (n.length > 80) return "Use no máximo 80 caracteres.";
  return null;
}

export function rascunhoPadrao(nome: string): ConfigDraft {
  return {
    modelo: "comercio",
    modulos: [...MODULOS_POR_MODELO.comercio],
    aparencia: {
      nome,
      titulo: nome,
      cor_primaria: "#0F5257",
      cor_destaque: "#B7791F",
      texto_boas_vindas: "",
    },
    requisitos: [],
    campos: [],
    tipos_atendimento: [],
    regras: [],
    fora_do_catalogo: [],
  };
}

export function proximoIdRequisito(ids: string[]): string {
  const max = ids.reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, "")) || 0), 0);
  return `REQ-${String(max + 1).padStart(2, "0")}`;
}

export function novoId(prefixo: string) {
  return `${prefixo}_${Math.random().toString(36).slice(2, 10)}`;
}

export const formatarData = (ms: number) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(ms);

/** "1.500,50" ou "1500.5" → 150050 centavos. Retorna null se inválido. */
export function reaisParaCentavos(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  return Math.round(Number(normal) * 100);
}

export function centavosParaReais(c: number): string {
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
