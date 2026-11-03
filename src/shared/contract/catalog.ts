// Catálogo fechado do Nexus (seção 5 da especificação). Tudo o que uma configuração pode usar
// está aqui; o que não está não é criado silenciosamente — vira necessidade fora do catálogo.

export const CATALOG_VERSION = "2026.11.1";

export const MODULES = [
  "clientes",
  "produtos",
  "vendas",
  "estoque",
  "profissionais",
  "agenda",
] as const;
export type ModuleId = (typeof MODULES)[number];

export const MODULE_INFO: Record<ModuleId, { label: string; dependsOn: readonly ModuleId[] }> = {
  clientes: { label: "Clientes", dependsOn: [] },
  produtos: { label: "Produtos", dependsOn: [] },
  estoque: { label: "Estoque", dependsOn: ["produtos"] },
  // Venda reserva estoque ao salvar o rascunho (RES-01), por isso depende de estoque.
  vendas: { label: "Vendas", dependsOn: ["clientes", "produtos", "estoque"] },
  profissionais: { label: "Profissionais", dependsOn: [] },
  agenda: { label: "Agenda", dependsOn: ["clientes", "profissionais"] },
};

export const TEMPLATES = ["comercio", "servicos", "comercio_com_servicos"] as const;
export type TemplateId = (typeof TEMPLATES)[number];

/** Cada modelo define exatamente o conjunto de módulos (seção 5). */
export const TEMPLATE_MODULES: Record<TemplateId, readonly ModuleId[]> = {
  comercio: ["clientes", "produtos", "vendas", "estoque"],
  servicos: ["clientes", "profissionais", "agenda"],
  comercio_com_servicos: ["clientes", "produtos", "vendas", "estoque", "profissionais", "agenda"],
};

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  comercio: "Comércio",
  servicos: "Serviços agendados",
  comercio_com_servicos: "Comércio com serviços",
};

/** Entidades que aceitam campos informativos adicionais e o módulo que as provê. */
export const FIELD_ENTITIES = {
  clientes: "clientes",
  produtos: "produtos",
  profissionais: "profissionais",
  vendas: "vendas",
  agendamentos: "agenda",
} as const satisfies Record<string, ModuleId>;
export type FieldEntity = keyof typeof FIELD_ENTITIES;

export const FIELD_TYPES = ["texto", "numero", "data", "lista"] as const;

export const RULE_TYPES = [
  "limite_atacado",
  "unidades_por_caixa",
  "prazo_reserva",
  "par_atendimento",
] as const;
export type RuleType = (typeof RULE_TYPES)[number];

/** Módulos que precisam estar ativos para cada tipo de regra. */
export const RULE_MODULES: Record<RuleType, readonly ModuleId[]> = {
  limite_atacado: ["vendas"],
  unidades_por_caixa: ["produtos", "vendas"],
  prazo_reserva: ["vendas", "estoque"],
  par_atendimento: ["agenda"],
};

/** Regras que todo sistema com esses módulos precisa ter explicitamente (sem valor inventado). */
export const REQUIRED_RULES: { rule: RuleType; whenModule: ModuleId }[] = [
  { rule: "prazo_reserva", whenModule: "vendas" },
];

export const LIMITS = {
  requirements: 60,
  fieldsPerEntity: 10,
  listOptions: { min: 2, max: 20 },
  serviceTypes: 10,
  outOfCatalog: 20,
} as const;
