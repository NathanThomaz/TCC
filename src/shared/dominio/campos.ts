import type { FieldEntity } from "../contract/catalog";
import type { ConfigDraft } from "../contract/schema";

// Campos informativos (seção 5): valores guardados de forma estruturada, sem DDL por pedido.
// A configuração ativa diz quais campos existem, de que tipo e se são obrigatórios.

export type ValorCampo = string | number;

export interface ErroCampo {
  campo: string;
  message: string;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(texto: string): boolean {
  if (!DATA.test(texto)) return false;
  const [ano, mes, dia] = texto.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/**
 * Confere os valores enviados contra os campos da entidade. Campo desconhecido é erro (não é
 * descartado em silêncio); campo opcional vazio simplesmente não é gravado.
 */
export function validarCampos(
  config: ConfigDraft,
  entidade: FieldEntity,
  valores: unknown,
): { valores: Record<string, ValorCampo> } | { erros: ErroCampo[] } {
  const campos = config.campos.filter((c) => c.entidade === entidade);
  const entrada: Record<string, unknown> =
    valores === undefined || valores === null
      ? {}
      : typeof valores === "object" && !Array.isArray(valores)
        ? (valores as Record<string, unknown>)
        : { "": valores };
  const erros: ErroCampo[] = [];
  const saida: Record<string, ValorCampo> = {};

  for (const chave of Object.keys(entrada)) {
    if (!campos.some((c) => c.id === chave)) {
      erros.push({ campo: chave, message: "Campo não existe na configuração deste sistema." });
    }
  }
  for (const campo of campos) {
    const bruto = entrada[campo.id];
    const vazio = bruto === undefined || bruto === null || bruto === "";
    if (vazio) {
      if (campo.obrigatorio)
        erros.push({ campo: campo.id, message: `${campo.rotulo} é obrigatório.` });
      continue;
    }
    switch (campo.tipo) {
      case "texto":
        if (typeof bruto !== "string" || bruto.trim().length > 200) {
          erros.push({ campo: campo.id, message: `${campo.rotulo}: texto de até 200 caracteres.` });
        } else saida[campo.id] = bruto.trim();
        break;
      case "numero":
        if (typeof bruto !== "number" || !Number.isFinite(bruto)) {
          erros.push({ campo: campo.id, message: `${campo.rotulo}: informe um número.` });
        } else saida[campo.id] = bruto;
        break;
      case "data":
        if (typeof bruto !== "string" || !dataValida(bruto)) {
          erros.push({ campo: campo.id, message: `${campo.rotulo}: data no formato AAAA-MM-DD.` });
        } else saida[campo.id] = bruto;
        break;
      case "lista":
        if (typeof bruto !== "string" || !(campo.opcoes ?? []).includes(bruto)) {
          erros.push({ campo: campo.id, message: `${campo.rotulo}: escolha uma das opções.` });
        } else saida[campo.id] = bruto;
        break;
    }
  }
  return erros.length > 0 ? { erros } : { valores: saida };
}
