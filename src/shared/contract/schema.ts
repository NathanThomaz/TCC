import { z } from "zod";
import {
  FIELD_TYPES,
  LIMITS,
  MODULES,
  PAYMENT_METHODS,
  ROTULOS_CAMPOS_CHAVES,
  RULE_TYPES,
  TEMPLATES,
} from "./catalog";

// Contrato de configuração (seção 17). Fonte única (ADR-001, item 3): valida o formulário
// manual, a resposta do Gemini e o que o backend grava. Identidade, versões e hash são do
// servidor e ficam fora do rascunho.

export const SCHEMA_VERSION = 1;

// Todos os objetos são estritos: campo desconhecido (ex.: um "desconto_percentual" inventado)
// é erro de estrutura, nunca descartado em silêncio — senão uma proposta parcialmente ignorada
// pareceria válida.

const slug = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,39}$/, "use letras minúsculas, números e _ (2 a 40)");
const requirementId = z.string().regex(/^REQ-\d{2,3}$/, "formato REQ-01");
const requirementRefs = z.array(requirementId).min(1).max(10);

export const RequirementSchema = z.strictObject({
  id: requirementId,
  texto: z.string().trim().min(3).max(400),
  status: z.enum(["pendente", "confirmado", "substituido"]),
});

export const FieldSchema = z.strictObject({
  id: slug,
  entidade: z.enum([
    "clientes",
    "produtos",
    "profissionais",
    "vendas",
    "agendamentos",
    "fornecedores",
  ]),
  rotulo: z.string().trim().min(1).max(60),
  tipo: z.enum(FIELD_TYPES),
  opcoes: z.array(z.string().trim().min(1).max(60)).max(LIMITS.listOptions.max).optional(),
  obrigatorio: z.boolean(),
});

export const ServiceTypeSchema = z.strictObject({
  id: slug,
  rotulo: z.string().trim().min(1).max(60),
  duracao_minutos: z.number().int().min(15).max(480),
});

export const RuleSchema = z.discriminatedUnion("tipo", [
  z.strictObject({
    tipo: z.literal("limite_atacado"),
    // Subtotal a preço de varejo a partir do qual vale o atacado, inclusive (PRE-02, PRE-03).
    valor_centavos: z.number().int().min(1).max(100_000_000),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("unidades_por_caixa"),
    // Fator padrão sugerido ao cadastrar produto; cada produto guarda o seu (PRE-05).
    unidades: z.number().int().min(2).max(1000),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("prazo_reserva"),
    minutos: z.number().int().min(1).max(1440),
    requisitos: requirementRefs,
  }),
  // ---- Regras do catálogo ampliado (ADR-005): cada uma é aplicada pela operação ----
  z.strictObject({
    tipo: z.literal("estoque_minimo"),
    // Abaixo disso (disponível), o produto aparece como crítico no painel e no estoque.
    unidades: z.number().int().min(1).max(100_000),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("pedido_minimo"),
    // Venda só é concluída com total a partir deste valor, inclusive.
    valor_centavos: z.number().int().min(1).max(100_000_000),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("limite_unidades_por_item"),
    // Máximo de unidades de um mesmo produto numa venda.
    unidades: z.number().int().min(1).max(100_000),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("prazo_cancelamento_venda"),
    // Venda concluída só é cancelada até este número de dias depois da conclusão.
    dias: z.number().int().min(1).max(365),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("horario_funcionamento"),
    // Atendimento começa e termina dentro do horário, nos dias da semana (0 = domingo).
    abre: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "horário HH:MM"),
    fecha: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "horário HH:MM"),
    dias_semana: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("antecedencia_minima"),
    // Agendar (ou remarcar) só com esta antecedência em relação a agora.
    minutos: z.number().int().min(1).max(43_200),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("prazo_cancelamento_atendimento"),
    // Cancelar ou remarcar só até estas horas antes do início.
    horas: z.number().int().min(1).max(720),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("formas_pagamento"),
    formas: z.array(z.enum(PAYMENT_METHODS)).min(1).max(PAYMENT_METHODS.length),
    // Vencimento da conta a receber de uma venda a prazo (obrigatório com "a_prazo").
    prazo_dias: z.number().int().min(1).max(180).optional(),
    requisitos: requirementRefs,
  }),
  z.strictObject({
    tipo: z.literal("par_atendimento"),
    // Dois atendimentos vinculados, mesmo profissional, o segundo após o fim do primeiro (AGE-02/04).
    primeiro: slug,
    segundo: slug,
    requisitos: requirementRefs,
  }),
]);
export type Rule = z.infer<typeof RuleSchema>;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor no formato #RRGGBB");

export const AppearanceSchema = z.strictObject({
  nome: z.string().trim().min(1).max(80),
  cor_primaria: hexColor,
  cor_destaque: hexColor,
  titulo: z.string().trim().min(1).max(80),
  texto_boas_vindas: z.string().trim().max(300).optional(),
  rotulos_menu: z.partialRecord(z.enum(MODULES), z.string().trim().min(1).max(40)).optional(),
  /** Nomes de telas e colunas adaptados ao negócio (só visual; o banco não muda). */
  rotulos_campos: z
    .partialRecord(z.enum(ROTULOS_CAMPOS_CHAVES), z.string().trim().min(1).max(40))
    .optional(),
});

export const OutOfCatalogSchema = z.strictObject({
  texto: z.string().trim().min(3).max(400),
  requisito: requirementId.optional(),
});

/** O que o formulário manual e o chat produzem; o validador decide se pode ativar. */
export const ConfigDraftSchema = z.strictObject({
  modelo: z.enum(TEMPLATES),
  modulos: z.array(z.enum(MODULES)).min(1).max(MODULES.length),
  aparencia: AppearanceSchema,
  requisitos: z.array(RequirementSchema).min(1).max(LIMITS.requirements),
  campos: z.array(FieldSchema).max(LIMITS.fieldsPerEntity * 6),
  tipos_atendimento: z.array(ServiceTypeSchema).max(LIMITS.serviceTypes),
  regras: z.array(RuleSchema).max(20),
  fora_do_catalogo: z.array(OutOfCatalogSchema).max(LIMITS.outOfCatalog),
});
export type ConfigDraft = z.infer<typeof ConfigDraftSchema>;

/** Rascunho validado + metadados controlados pelo servidor. */
export interface SystemConfig extends ConfigDraft {
  schema_version: typeof SCHEMA_VERSION;
  catalog_version: string;
  system_id: string;
  model_version: number;
}

export { RULE_TYPES };
