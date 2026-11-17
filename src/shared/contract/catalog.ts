// Catálogo fechado do Nexus (seção 5 da especificação). Tudo o que uma configuração pode usar
// está aqui; o que não está não é criado silenciosamente — vira necessidade fora do catálogo.

export const CATALOG_VERSION = "2026.11.10";

export const MODULES = [
  "clientes",
  "produtos",
  "vendas",
  "estoque",
  "profissionais",
  "agenda",
  // Opcionais (ADR-006): entram por escolha do dono, nos modelos que os aceitam.
  "pagamentos",
  "fornecedores",
  "financeiro",
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
  pagamentos: { label: "Formas de pagamento", dependsOn: ["vendas"] },
  // A compra dá entrada no estoque.
  fornecedores: { label: "Fornecedores e compras", dependsOn: ["produtos", "estoque"] },
  financeiro: { label: "Financeiro", dependsOn: [] },
};

// Seis modelos (pedido do dono, 2026-11-16, ADR-015): os três de origem e três para quem quer só
// uma parte (controle financeiro, agenda de reservas, clientes com cobranças).
export const TEMPLATES = [
  "comercio",
  "servicos",
  "comercio_com_servicos",
  "controle_financeiro",
  "agenda_simples",
  "clientes_cobrancas",
  "controle_estoque",
] as const;
export type TemplateId = (typeof TEMPLATES)[number];

/**
 * Modelos oferecidos na tela inicial, no modo avançado e à IA (pedido do dono, 2026-11-17). A agenda
 * simples tinha os mesmos módulos de serviços agendados e deu lugar ao controle de estoque; continua
 * no contrato só para os sistemas que já a usam.
 */
export const TEMPLATES_OFERECIDOS = [
  "comercio",
  "servicos",
  "comercio_com_servicos",
  "controle_financeiro",
  "controle_estoque",
  "clientes_cobrancas",
] as const satisfies readonly TemplateId[];

/** Cada modelo define exatamente o conjunto de módulos (seção 5). */
export const TEMPLATE_MODULES: Record<TemplateId, readonly ModuleId[]> = {
  comercio: ["clientes", "produtos", "vendas", "estoque"],
  servicos: ["clientes", "profissionais", "agenda"],
  comercio_com_servicos: ["clientes", "produtos", "vendas", "estoque", "profissionais", "agenda"],
  controle_financeiro: ["financeiro"],
  // O agendamento sempre tem um responsável (cliente): a diferença para "servicos" está no que
  // vem pronto (recursos em vez de profissionais, reserva de horário), não nos módulos.
  agenda_simples: ["clientes", "profissionais", "agenda"],
  clientes_cobrancas: ["clientes", "financeiro"],
  // Entrada, saída com motivo e saldo, sem vender pelo sistema.
  controle_estoque: ["produtos", "estoque"],
};

/** Módulos opcionais que cada modelo aceita, além dos seus (ADR-006). */
export const OPTIONAL_MODULES: Record<TemplateId, readonly ModuleId[]> = {
  comercio: ["pagamentos", "fornecedores", "financeiro"],
  servicos: ["financeiro"],
  comercio_com_servicos: ["pagamentos", "fornecedores", "financeiro"],
  controle_financeiro: [],
  agenda_simples: [],
  clientes_cobrancas: [],
  controle_estoque: ["fornecedores"],
};

/**
 * Nomes das telas e colunas que o sistema pode adaptar ao negócio (pedido do dono, 2026-11-14):
 * só o visual muda; o banco continua com os nomes padrão. Ex.: numa loja de carros, o produto vira
 * "Veículo" e o preço de varejo, "Preço de venda". A IA sugere; o dono ajusta na revisão.
 */
export const ROTULOS_CAMPOS = {
  "produtos.item": { padrao: "Produto", modulo: "produtos" },
  "produtos.nome": { padrao: "Nome", modulo: "produtos" },
  "produtos.varejo": { padrao: "Preço de varejo", modulo: "produtos" },
  "produtos.atacado": { padrao: "Preço de atacado", modulo: "produtos" },
  "produtos.caixa": { padrao: "Unidades por caixa", modulo: "produtos" },
  "clientes.nome": { padrao: "Nome", modulo: "clientes" },
  "clientes.sobrenome": { padrao: "Sobrenome", modulo: "clientes" },
  "profissionais.nome": { padrao: "Nome", modulo: "profissionais" },
  "fornecedores.nome": { padrao: "Nome", modulo: "fornecedores" },
} as const satisfies Record<string, { padrao: string; modulo: ModuleId }>;
export type RotuloCampo = keyof typeof ROTULOS_CAMPOS;
export const ROTULOS_CAMPOS_CHAVES = Object.keys(ROTULOS_CAMPOS) as [RotuloCampo, ...RotuloCampo[]];

/** Formas de pagamento que a regra `formas_pagamento` pode aceitar. */
export const PAYMENT_METHODS = [
  "dinheiro",
  "pix",
  "cartao_credito",
  "cartao_debito",
  "boleto",
  "a_prazo",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  a_prazo: "A prazo",
};

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  comercio: "Comércio",
  servicos: "Serviços agendados",
  comercio_com_servicos: "Comércio com serviços",
  controle_financeiro: "Controle financeiro",
  agenda_simples: "Agenda simples",
  clientes_cobrancas: "Clientes e cobranças",
  controle_estoque: "Controle de estoque",
};

/** Para quem é cada modelo (tela inicial, modo avançado e instruções da IA). */
export const TEMPLATE_DESCRIPTIONS: Record<TemplateId, { para: string; exemplos: string }> = {
  comercio: {
    para: "Quem vende produtos e controla estoque.",
    exemplos: "distribuidora, mercadinho, loja de roupas",
  },
  servicos: {
    para: "Quem atende clientes com hora marcada.",
    exemplos: "salão, clínica, oficina, pet shop",
  },
  comercio_com_servicos: {
    para: "Quem vende produtos e também faz atendimentos agendados.",
    exemplos: "distribuidora com instalação, loja com assistência técnica",
  },
  controle_financeiro: {
    para: "Quem quer só controlar contas a pagar e a receber.",
    exemplos: "finanças pessoais, autônomo, pequena empresa sem estoque",
  },
  agenda_simples: {
    para: "Quem reserva horários de um recurso (sala, quadra, equipamento).",
    exemplos: "sala de reunião, quadra esportiva, estúdio, aluguel de equipamento",
  },
  clientes_cobrancas: {
    para: "Quem cadastra clientes e cobra mensalidades ou serviços, sem estoque nem agenda.",
    exemplos: "professor particular, personal trainer, escola de idiomas, consultoria",
  },
  controle_estoque: {
    para: "Quem só controla o que entra e sai do estoque, sem vender pelo sistema.",
    exemplos: "almoxarifado, depósito, insumos de restaurante, materiais de obra",
  },
};

/** Entidades que aceitam campos informativos adicionais e o módulo que as provê. */
export const FIELD_ENTITIES = {
  clientes: "clientes",
  produtos: "produtos",
  profissionais: "profissionais",
  vendas: "vendas",
  agendamentos: "agenda",
  fornecedores: "fornecedores",
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
    // Campo próprio desde a migration 0018 (pedido do dono, 2026-11-17).
    { label: "Sobrenome", aliases: ["ultimo nome", "nome de familia"] },
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
  fornecedores: [
    { label: "Nome", aliases: ["nome do fornecedor", "razao social"] },
    { label: "Situação (ativo ou inativo)", aliases: ["situacao", "status"] },
  ],
};

/**
 * Colunas que um sistema novo já traz no cadastro de clientes (pedido do dono, 2026-11-17): são
 * campos informativos comuns, que o dono renomeia, deixa vazios ou tira na revisão.
 */
export const CAMPOS_PADRAO_CLIENTES = [
  { id: "telefone", entidade: "clientes", rotulo: "Telefone", tipo: "texto", obrigatorio: false },
  { id: "email", entidade: "clientes", rotulo: "E-mail", tipo: "texto", obrigatorio: false },
] as const;

/** Sugestões da "Nova coluna" por cadastro: um clique preenche o nome e o tipo. */
export const SUGESTOES_DE_COLUNA: Record<
  FieldEntity,
  readonly { rotulo: string; tipo: (typeof FIELD_TYPES)[number] }[]
> = {
  clientes: [
    { rotulo: "Telefone", tipo: "texto" },
    { rotulo: "E-mail", tipo: "texto" },
    { rotulo: "CPF ou CNPJ", tipo: "texto" },
    { rotulo: "Data de nascimento", tipo: "data" },
    { rotulo: "Endereço", tipo: "texto" },
    { rotulo: "Bairro", tipo: "texto" },
    { rotulo: "Cidade", tipo: "texto" },
    { rotulo: "Observações", tipo: "texto" },
  ],
  produtos: [
    { rotulo: "Marca", tipo: "texto" },
    { rotulo: "Categoria", tipo: "texto" },
    { rotulo: "Fornecedor preferido", tipo: "texto" },
    { rotulo: "Localização no estoque", tipo: "texto" },
    { rotulo: "Peso", tipo: "numero" },
    { rotulo: "Observações", tipo: "texto" },
  ],
  profissionais: [
    { rotulo: "Telefone", tipo: "texto" },
    { rotulo: "E-mail", tipo: "texto" },
    { rotulo: "Especialidade", tipo: "texto" },
    { rotulo: "Comissão (%)", tipo: "numero" },
    { rotulo: "Data de admissão", tipo: "data" },
  ],
  vendas: [
    { rotulo: "Observações", tipo: "texto" },
    { rotulo: "Data de entrega", tipo: "data" },
    { rotulo: "Endereço de entrega", tipo: "texto" },
    { rotulo: "Vendedor", tipo: "texto" },
  ],
  agendamentos: [
    { rotulo: "Observações", tipo: "texto" },
    { rotulo: "Telefone para contato", tipo: "texto" },
    { rotulo: "Local", tipo: "texto" },
  ],
  fornecedores: [
    { rotulo: "CNPJ", tipo: "texto" },
    { rotulo: "Telefone", tipo: "texto" },
    { rotulo: "E-mail", tipo: "texto" },
    { rotulo: "Pessoa de contato", tipo: "texto" },
    { rotulo: "Prazo de entrega (dias)", tipo: "numero" },
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

/** Campos que um módulo opcional acrescenta a um cadastro, só quando ele está ligado (ADR-006). */
export const MODULE_NATIVE_FIELDS: Partial<
  Record<
    ModuleId,
    Partial<Record<FieldEntity, readonly { label: string; aliases: readonly string[] }[]>>
  >
> = {
  pagamentos: {
    vendas: [
      {
        label: "Forma de pagamento",
        aliases: ["pagamento", "meio de pagamento", "forma de pagto", "como pagou"],
      },
    ],
  },
};

/** Campo nativo que um rótulo de campo extra duplicaria, se houver. */
export function campoNativoDuplicado(
  entidade: FieldEntity,
  rotulo: string,
  modulos: readonly ModuleId[] = [],
): string | null {
  const r = normalizarRotulo(rotulo);
  if (!r) return null;
  const nativos = [
    ...NATIVE_FIELDS[entidade],
    ...modulos.flatMap((m) => MODULE_NATIVE_FIELDS[m]?.[entidade] ?? []),
  ];
  // Vale o rótulo completo, o rótulo sem o detalhe entre parênteses e os sinônimos.
  const achado = nativos.find(
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
  "formas_pagamento",
  // Financeiro (ADR-015, etapa 2a).
  "categorias_financeiras",
  "aviso_vencimento",
  "orcamento_mensal",
  "multa_juros_atraso",
  // Estoque, clientes e vendas (ADR-015, etapa 2b).
  "validade_produto",
  "saida_manual",
  "limite_credito",
  "cliente_sem_comprar",
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
  formas_pagamento: ["pagamentos"],
  categorias_financeiras: ["financeiro"],
  aviso_vencimento: ["financeiro"],
  orcamento_mensal: ["financeiro"],
  multa_juros_atraso: ["financeiro"],
  validade_produto: ["produtos", "estoque"],
  saida_manual: ["produtos", "estoque"],
  // Limite sobre o que o cliente deve: venda a prazo (pagamentos) vira conta a receber (financeiro).
  limite_credito: ["vendas", "pagamentos", "financeiro"],
  cliente_sem_comprar: ["clientes", "vendas"],
};

/** Regras que todo sistema com esses módulos precisa ter explicitamente (sem valor inventado). */
export const REQUIRED_RULES: { rule: RuleType; whenModule: ModuleId }[] = [
  { rule: "prazo_reserva", whenModule: "vendas" },
  // Quais formas o negócio aceita é decisão do dono (ADR-006).
  { rule: "formas_pagamento", whenModule: "pagamentos" },
];

export const LIMITS = {
  requirements: 60,
  fieldsPerEntity: 10,
  listOptions: { min: 2, max: 20 },
  serviceTypes: 10,
  outOfCatalog: 20,
} as const;
