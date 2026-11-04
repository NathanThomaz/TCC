// Tipos das telas. Vêm do contrato real (src/shared): o formulário produz exatamente o que o
// backend valida, sem cópia que possa divergir.
export type { ConfigDraft, Rule as Regra } from "../../shared/contract/schema";
export type {
  IssueDto as Issue,
  SystemDto as Sistema,
  VersionDto as Versao,
} from "../../shared/api";
import type { ConfigDraft } from "../../shared/contract/schema";

export type Modelo = ConfigDraft["modelo"];
export type Modulo = ConfigDraft["modulos"][number];
export type Requisito = ConfigDraft["requisitos"][number];
export type Campo = ConfigDraft["campos"][number];
export type TipoAtendimento = ConfigDraft["tipos_atendimento"][number];
export type Aparencia = ConfigDraft["aparencia"];
