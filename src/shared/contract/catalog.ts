// Catálogo fechado do Nexus (seção 5 da especificação). Tudo o que uma configuração pode usar
// está aqui; o que não está não é criado silenciosamente — vira necessidade fora do catálogo.

export const CATALOG_VERSION = "2026.11.3";

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

/**
 * Campos que cada cadastro já tem de fábrica (colunas da operação, migration 0003). Campo
 * informativo com o mesmo nome (ou sinônimo) duplicaria a informação: o validador recusa, o
 * formulário avisa e a IA recebe a lista para não propor.
 */
export const NATIVE_FIELDS: Record<
  FieldEntity,
  readonly { label: string; aliases: readonly string[] }[]
> = {
  // Só sinônimos inequívocos: "Razão social", "Descrição", "Valor" ou "Quantidade" podem ser
  // campos legítimos e não são barrados.
  clientes: [
    { label: "Nome", aliases: ["nome do cliente"] },
    { label: "Situação (ativo ou inativo)", aliases: ["situacao", "status"] },
  ],
  produtos: [
    { label: "Nome", aliases: ["nome do produto"] },
    { label: "Preço de varejo", aliases: ["preco", "preco de varejo", "preco varejo"] },
    { label: "Preço de atacado", aliases: ["preco de atacado", "preco atacado"] },
    { label: "Unidades por caixa", aliases: ["quantidade por caixa", "unidades na caixa"] },
    {
      label: "Estoque (físico, reservado e disponível)",
      aliases: ["estoque", "quantidade em estoque", "saldo em estoque", "estoque disponivel"],
    },
    { label: "Situação (ativo ou inativo)", aliases: ["situacao", "status"] },
  ],
  profissionais: [
    { label: "Nome", aliases: ["nome do profissional"] },
    { label: "Situação (ativo ou inativo)", aliases: ["situacao", "status"] },
  ],
  vendas: [
    { label: "Cliente", aliases: ["nome do cliente"] },
    { label: "Itens (produto e quantidade)", aliases: ["itens", "itens da venda"] },
    { label: "Total", aliases: ["valor total", "total da venda"] },
    { label: "Faixa de preço (varejo ou atacado)", aliases: ["faixa de preco"] },
    { label: "Situação (rascunho, concluída ou cancelada)", aliases: ["situacao", "status"] },
    { label: "Validade da reserva", aliases: ["vencimento da reserva"] },
    { label: "Motivo do cancelamento", aliases: [] },
  ],
  agendamentos: [
    { label: "Cliente", aliases: ["nome do cliente"] },
    { label: "Profissional", aliases: ["profissional responsavel"] },
    { label: "Tipo de atendimento", aliases: ["tipo de servico"] },
    {
      label: "Data e hora de início",
      aliases: ["data e hora", "data do atendimento", "horario do atendimento", "inicio"],
    },
    { label: "Término", aliases: ["hora de termino"] },
    {
      label: "Situação (agendado, em atendimento, concluído ou cancelado)",
      aliases: ["situacao", "status"],
    },
    { label: "Venda vinculada", aliases: [] },
  ],
};

/** Minúsculas, sem acento nem espaços repetidos: "Preço  Unitário" → "preco unitario". */
export function normalizarRotulo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Campo nativo que um rótulo de campo extra duplicaria, se houver. */
export function campoNativoDuplicado(entidade: FieldEntity, rotulo: string): string | null {
  const r = normalizarRotulo(rotulo);
  if (!r) return null;
  // Vale o rótulo completo, o rótulo sem o detalhe entre parênteses e os sinônimos.
  const achado = NATIVE_FIELDS[entidade].find(
    (n) =>
      normalizarRotulo(n.label) === r ||
      normalizarRotulo(n.label.replace(/\(.*\)/, "")) === r ||
      n.aliases.includes(r),
  );
  return achado?.label ?? null;
}

export const FIELD_TYPES = ["texto", "numero", "data", "lista"] as const;

export const RULE_TYPES = [
  "limite_atacado",
  "unidades_por_caixa",
  "prazo_reserva",
  "par_atendimento",
  "estoque_minimo",
  "pedido_minimo",
  "limite_unidades_por_item",
  "prazo_cancelamento_venda",
  "horario_funcionamento",
  "antecedencia_minima",
  "prazo_cancelamento_atendimento",
] as const;
export type RuleType = (typeof RULE_TYPES)[number];

/** Módulos que precisam estar ativos para cada tipo de regra. */
export const RULE_MODULES: Record<RuleType, readonly ModuleId[]> = {
  limite_atacado: ["vendas"],
  unidades_por_caixa: ["produtos", "vendas"],
  prazo_reserva: ["vendas", "estoque"],
  par_atendimento: ["agenda"],
  estoque_minimo: ["produtos", "estoque"],
  pedido_minimo: ["vendas"],
  limite_unidades_por_item: ["vendas"],
  prazo_cancelamento_venda: ["vendas"],
  horario_funcionamento: ["agenda"],
  antecedencia_minima: ["agenda"],
  prazo_cancelamento_atendimento: ["agenda"],
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
