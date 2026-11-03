import { z } from "zod";
import { FIELD_TYPES, LIMITS, MODULES, RULE_TYPES, TEMPLATES } from "./catalog";

// Contrato de configuração (seção 17). Fonte única (ADR-001, item 3): valida o formulário
// manual, a resposta do Gemini e o que o backend grava. Identidade, versões e hash são do
// servidor e ficam fora do rascunho.

export const SCHEMA_VERSION = 1;

const slug = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,39}$/, "use letras minúsculas, números e _ (2 a 40)");
const requirementId = z.string().regex(/^REQ-\d{2,3}$/, "formato REQ-01");
const requirementRefs = z.array(requirementId).min(1).max(10);

export const RequirementSchema = z.object({
  id: requirementId,
  texto: z.string().trim().min(3).max(400),
  status: z.enum(["pendente", "confirmado", "substituido"]),
});

export const FieldSchema = z.object({
  id: slug,
  entidade: z.enum(["clientes", "produtos", "profissionais", "vendas", "agendamentos"]),
  rotulo: z.string().trim().min(1).max(60),
  tipo: z.enum(FIELD_TYPES),
  opcoes: z.array(z.string().trim().min(1).max(60)).max(LIMITS.listOptions.max).optional(),
  obrigatorio: z.boolean(),
});

export const ServiceTypeSchema = z.object({
  id: slug,
  rotulo: z.string().trim().min(1).max(60),
  duracao_minutos: z.number().int().min(15).max(480),
});

export const RuleSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("limite_atacado"),
    // Subtotal a preço de varejo a partir do qual vale o atacado, inclusive (PRE-02, PRE-03).
    valor_centavos: z.number().int().min(1).max(100_000_000),
    requisitos: requirementRefs,
  }),
  z.object({
    tipo: z.literal("unidades_por_caixa"),
    // Fator padrão sugerido ao cadastrar produto; cada produto guarda o seu (PRE-05).
    unidades: z.number().int().min(2).max(1000),
    requisitos: requirementRefs,
  }),
  z.object({
    tipo: z.literal("prazo_reserva"),
    minutos: z.number().int().min(1).max(1440),
    requisitos: requirementRefs,
  }),
  z.object({
    tipo: z.literal("par_atendimento"),
    // Dois atendimentos vinculados, mesmo profissional, o segundo após o fim do primeiro (AGE-02/04).
    primeiro: slug,
    segundo: slug,
    requisitos: requirementRefs,
  }),
]);
export type Rule = z.infer<typeof RuleSchema>;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor no formato #RRGGBB");

export const AppearanceSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  cor_primaria: hexColor,
  cor_destaque: hexColor,
  titulo: z.string().trim().min(1).max(80),
  texto_boas_vindas: z.string().trim().max(300).optional(),
  rotulos_menu: z.partialRecord(z.enum(MODULES), z.string().trim().min(1).max(40)).optional(),
});

export const OutOfCatalogSchema = z.object({
  texto: z.string().trim().min(3).max(400),
  requisito: requirementId.optional(),
});

/** O que o formulário manual e o chat produzem; o validador decide se pode ativar. */
export const ConfigDraftSchema = z.object({
  modelo: z.enum(TEMPLATES),
  modulos: z.array(z.enum(MODULES)).min(1).max(MODULES.length),
  aparencia: AppearanceSchema,
  requisitos: z.array(RequirementSchema).min(1).max(LIMITS.requirements),
  campos: z.array(FieldSchema).max(LIMITS.fieldsPerEntity * 5),
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
