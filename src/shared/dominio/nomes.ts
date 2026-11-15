/**
 * Nome comparável de um sistema: minúsculas, sem acento e com espaços simples. "Loja  Água" e
 * "loja agua" são o mesmo nome. A API grava em `systems.name_key` (único por dono, migration 0013)
 * e a tela usa a mesma regra para avisar antes de enviar.
 */
export const chaveNomeSistema = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
