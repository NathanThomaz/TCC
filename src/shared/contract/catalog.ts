// Catálogo fechado do Nexus (seção 5 da especificação). Tudo o que uma configuração pode usar
// está aqui; o que não está não é criado silenciosamente — vira necessidade fora do catálogo.

export const CATALOG_VERSION = "2026.11.2";

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
  clientes: [
    { label: "Nome", aliases: ["nome do cliente", "cliente", "razao social"] },
    { label: "Situação (ativo ou inativo)", aliases: ["situacao", "status", "ativo", "inativo"] },
  ],
  produtos: [
    { label: "Nome", aliases: ["nome do produto", "produto", "descricao"] },
    { label: "Preço de varejo", aliases: ["preco", "valor", "preco unitario", "varejo"] },
    { label: "Preço de atacado", aliases: ["atacado", "valor de atacado"] },
    { label: "Unidades por caixa", aliases: ["caixa", "quantidade por caixa", "unidades"] },
    {
      label: "Estoque (físico, reservado e disponível)",
      aliases: ["estoque", "quantidade", "saldo", "quantidade em estoque", "disponivel"],
    },
    { label: "Situação (ativo ou inativo)", aliases: ["situacao", "status", "ativo", "inativo"] },
  ],
  profissionais: [
    { label: "Nome", aliases: ["nome do profissional", "profissional", "tecnico"] },
    { label: "Situação (ativo ou inativo)", aliases: ["situacao", "status", "ativo", "inativo"] },
  ],
  vendas: [
    { label: "Cliente", aliases: ["nome do cliente", "comprador"] },
    { label: "Itens (produto e quantidade)", aliases: ["itens", "produtos", "quantidade"] },
    { label: "Total", aliases: ["valor total", "subtotal", "valor", "preco total"] },
    { label: "Faixa de preço (varejo ou atacado)", aliases: ["faixa de preco", "tipo de preco"] },
    { label: "Situação (rascunho, concluída ou cancelada)", aliases: ["situacao", "status"] },
    { label: "Validade da reserva", aliases: ["reserva", "vencimento da reserva"] },
    { label: "Motivo do cancelamento", aliases: ["motivo", "cancelamento"] },
  ],
  agendamentos: [
    { label: "Cliente", aliases: ["nome do cliente"] },
    { label: "Profissional", aliases: ["tecnico", "responsavel"] },
    { label: "Tipo de atendimento", aliases: ["servico", "tipo", "atendimento"] },
    {
      label: "Data e hora de início",
      aliases: ["data", "hora", "horario", "inicio", "data do atendimento"],
    },
    { label: "Término", aliases: ["fim", "hora de termino", "duracao"] },
    {
      label: "Situação (agendado, em atendimento, concluído ou cancelado)",
      aliases: ["situacao", "status"],
    },
    { label: "Venda vinculada", aliases: ["venda", "pedido"] },
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
  const achado = NATIVE_FIELDS[entidade].find(
    (n) => normalizarRotulo(n.label.replace(/\(.*\)/, "")) === r || n.aliases.includes(r),
  );
  return achado?.label ?? null;
}

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
