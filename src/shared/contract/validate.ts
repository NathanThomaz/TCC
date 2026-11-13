import {
  campoNativoDuplicado,
  FIELD_ENTITIES,
  LIMITS,
  normalizarRotulo,
  MODULE_INFO,
  REQUIRED_RULES,
  RULE_MODULES,
  TEMPLATE_LABELS,
  OPTIONAL_MODULES,
  TEMPLATE_MODULES,
  type ModuleId,
} from "./catalog";
import { ConfigDraftSchema, type ConfigDraft } from "./schema";

// Validador do contrato (seção 17): estrutura (Zod) + semântica do catálogo. Erro bloqueante
// impede a ativação. Ele não prova a semântica do negócio, só a coerência da configuração.

export type Severity = "bloqueante" | "aviso";

export interface ValidationIssue {
  code: string;
  severity: Severity;
  /** Caminho no rascunho, ex.: "regras.0.primeiro". */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; draft: ConfigDraft; issues: ValidationIssue[] }
  | { ok: false; draft?: ConfigDraft; issues: ValidationIssue[] };

const block = (code: string, path: string, message: string): ValidationIssue => ({
  code,
  severity: "bloqueante",
  path,
  message,
});

export function validateDraft(input: unknown): ValidationResult {
  const parsed = ConfigDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) =>
        block("estrutura_invalida", issue.path.join("."), issue.message),
      ),
    };
  }
  const draft = parsed.data;
  const issues = semanticIssues(draft);
  const ok = issues.every((issue) => issue.severity !== "bloqueante");
  return ok ? { ok: true, draft, issues } : { ok: false, draft, issues };
}

function duplicates<T>(items: T[], key: (item: T) => string): Set<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return repeated;
}

export function semanticIssues(draft: ConfigDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const active = new Set<ModuleId>(draft.modulos);

  // Modelo × módulos: os do modelo são obrigatórios; além deles, só os opcionais que o modelo
  // aceita (ADR-006).
  const expected = new Set(TEMPLATE_MODULES[draft.modelo]);
  const optional = new Set(OPTIONAL_MODULES[draft.modelo]);
  const missing = [...expected].filter((m) => !active.has(m));
  const extra = [...active].filter((m) => !expected.has(m) && !optional.has(m));
  if (missing.length || extra.length) {
    issues.push(
      block(
        "modulos_incompativeis_com_modelo",
        "modulos",
        `O modelo ${TEMPLATE_LABELS[draft.modelo]} usa: ${[...expected].join(", ")}` +
          (optional.size ? ` (opcionais: ${[...optional].join(", ")})` : "") +
          "." +
          (missing.length ? ` Faltam: ${missing.join(", ")}.` : "") +
          (extra.length ? ` Não disponíveis neste modelo: ${extra.join(", ")}.` : ""),
      ),
    );
  }
  for (const dup of duplicates(draft.modulos, (m) => m)) {
    issues.push(block("modulo_repetido", "modulos", `Módulo repetido: ${dup}.`));
  }
  for (const module of active) {
    for (const dependency of MODULE_INFO[module].dependsOn) {
      if (!active.has(dependency)) {
        issues.push(
          block(
            "dependencia_ausente",
            "modulos",
            `${module} depende de ${dependency}, que não está ativo.`,
          ),
        );
      }
    }
  }

  // Requisitos: IDs únicos, nenhum pendente na ativação.
  const requirementIds = new Set(draft.requisitos.map((r) => r.id));
  for (const dup of duplicates(draft.requisitos, (r) => r.id)) {
    issues.push(block("id_repetido", "requisitos", `Requisito repetido: ${dup}.`));
  }
  draft.requisitos.forEach((requirement, index) => {
    if (requirement.status === "pendente") {
      issues.push(
        block(
          "requisito_pendente",
          `requisitos.${index}`,
          `${requirement.id} ainda não foi confirmado; confirme ou substitua antes de ativar.`,
        ),
      );
    }
  });
  const confirmed = new Set(
    draft.requisitos.filter((r) => r.status === "confirmado").map((r) => r.id),
  );

  // Campos informativos.
  for (const dup of duplicates(draft.campos, (f) => `${f.entidade}.${f.id}`)) {
    issues.push(block("id_repetido", "campos", `Campo repetido: ${dup}.`));
  }
  // Mesmo rótulo (sem acento e caixa) duas vezes no mesmo cadastro também é duplicidade.
  for (const dup of duplicates(
    draft.campos,
    (f) => `${f.entidade}.${normalizarRotulo(f.rotulo)}`,
  )) {
    issues.push(
      block(
        "rotulo_repetido",
        "campos",
        `Há dois campos "${dup.split(".")[1]}" no mesmo cadastro.`,
      ),
    );
  }
  const perEntity = new Map<string, number>();
  draft.campos.forEach((field, index) => {
    const path = `campos.${index}`;
    const module = FIELD_ENTITIES[field.entidade];
    const nativo = campoNativoDuplicado(field.entidade, field.rotulo, draft.modulos);
    if (nativo) {
      issues.push(
        block(
          "campo_ja_existe",
          `${path}.rotulo`,
          `"${field.rotulo}" já vem pronto no cadastro (${nativo}); não precisa de campo extra.`,
        ),
      );
    }
    if (!active.has(module)) {
      issues.push(
        block(
          "modulo_inativo",
          `${path}.entidade`,
          `Campo em ${field.entidade} exige o módulo ${module}.`,
        ),
      );
    }
    perEntity.set(field.entidade, (perEntity.get(field.entidade) ?? 0) + 1);
    const options = field.opcoes ?? [];
    if (field.tipo === "lista") {
      if (options.length < LIMITS.listOptions.min) {
        issues.push(
          block("opcoes_insuficientes", `${path}.opcoes`, "Lista precisa de ao menos 2 opções."),
        );
      }
      if (duplicates(options, (o) => o.toLocaleLowerCase("pt-BR")).size) {
        issues.push(
          block("opcao_repetida", `${path}.opcoes`, "Opções da lista devem ser diferentes."),
        );
      }
    } else if (options.length) {
      issues.push(
        block("opcoes_indevidas", `${path}.opcoes`, "Só campos do tipo lista têm opções."),
      );
    }
  });
  for (const [entity, total] of perEntity) {
    if (total > LIMITS.fieldsPerEntity) {
      issues.push(
        block(
          "limite_campos",
          "campos",
          `No máximo ${LIMITS.fieldsPerEntity} campos em ${entity}.`,
        ),
      );
    }
  }

  // Tipos de atendimento.
  const serviceIds = new Set(draft.tipos_atendimento.map((s) => s.id));
  for (const dup of duplicates(draft.tipos_atendimento, (s) => s.id)) {
    issues.push(block("id_repetido", "tipos_atendimento", `Tipo de atendimento repetido: ${dup}.`));
  }
  if (active.has("agenda") && draft.tipos_atendimento.length === 0) {
    issues.push(
      block(
        "tipo_atendimento_ausente",
        "tipos_atendimento",
        "A agenda precisa de ao menos um tipo de atendimento.",
      ),
    );
  }
  if (!active.has("agenda") && draft.tipos_atendimento.length > 0) {
    issues.push(
      block("modulo_inativo", "tipos_atendimento", "Tipos de atendimento exigem o módulo agenda."),
    );
  }

  // Regras.
  const pairUsage = new Map<string, number>();
  draft.regras.forEach((rule, index) => {
    const path = `regras.${index}`;
    for (const module of RULE_MODULES[rule.tipo]) {
      if (!active.has(module)) {
        issues.push(
          block("modulo_inativo", path, `A regra ${rule.tipo} exige o módulo ${module}.`),
        );
      }
    }
    rule.requisitos.forEach((ref, refIndex) => {
      if (!requirementIds.has(ref)) {
        issues.push(
          block(
            "referencia_inexistente",
            `${path}.requisitos.${refIndex}`,
            `Requisito ${ref} não existe.`,
          ),
        );
      } else if (!confirmed.has(ref)) {
        issues.push(
          block(
            "regra_sem_requisito_confirmado",
            `${path}.requisitos.${refIndex}`,
            `A regra ${rule.tipo} aponta para ${ref}, que não está confirmado.`,
          ),
        );
      }
    });
    if (rule.tipo === "horario_funcionamento") {
      if (rule.abre >= rule.fecha) {
        issues.push(
          block("horario_invalido", path, "O horário de abertura precisa ser antes do fechamento."),
        );
      }
      if (new Set(rule.dias_semana).size !== rule.dias_semana.length) {
        issues.push(block("horario_invalido", path, "Há dia da semana repetido."));
      }
    }
    if (rule.tipo === "formas_pagamento") {
      if (new Set(rule.formas).size !== rule.formas.length) {
        issues.push(block("forma_pagamento_invalida", path, "Há forma de pagamento repetida."));
      }
      if (rule.formas.includes("a_prazo") && rule.prazo_dias === undefined) {
        issues.push(
          block(
            "forma_pagamento_invalida",
            path,
            "Venda a prazo precisa do prazo de vencimento em dias.",
          ),
        );
      }
    }
    if (rule.tipo === "par_atendimento") {
      if (rule.primeiro === rule.segundo) {
        issues.push(
          block("par_invalido", path, "O par precisa de dois tipos de atendimento diferentes."),
        );
      }
      for (const key of ["primeiro", "segundo"] as const) {
        if (!serviceIds.has(rule[key])) {
          issues.push(
            block(
              "referencia_inexistente",
              `${path}.${key}`,
              `Tipo de atendimento ${rule[key]} não existe.`,
            ),
          );
        }
        pairUsage.set(rule[key], (pairUsage.get(rule[key]) ?? 0) + 1);
      }
    }
  });
  for (const dup of duplicates(
    draft.regras.filter((r) => r.tipo !== "par_atendimento"),
    (r) => r.tipo,
  )) {
    issues.push(block("regra_repetida", "regras", `A regra ${dup} só pode aparecer uma vez.`));
  }
  for (const [service, uses] of pairUsage) {
    if (uses > 1) {
      issues.push(block("par_invalido", "regras", `${service} não pode participar de dois pares.`));
    }
  }
  for (const { rule, whenModule } of REQUIRED_RULES) {
    if (active.has(whenModule) && !draft.regras.some((r) => r.tipo === rule)) {
      issues.push(
        block(
          "parametro_obrigatorio_ausente",
          "regras",
          `Com o módulo ${whenModule}, a regra ${rule} precisa ser informada pelo dono (não há valor padrão).`,
        ),
      );
    }
  }

  // Fora do catálogo: registrado e explicado, nunca transformado em promessa.
  draft.fora_do_catalogo.forEach((need, index) => {
    if (need.requisito && !requirementIds.has(need.requisito)) {
      issues.push(
        block(
          "referencia_inexistente",
          `fora_do_catalogo.${index}.requisito`,
          `Requisito ${need.requisito} não existe.`,
        ),
      );
    }
    issues.push({
      code: "fora_do_catalogo",
      severity: "aviso",
      path: `fora_do_catalogo.${index}`,
      message: `Não será implementado nesta versão: ${need.texto}`,
    });
  });

  return issues;
}

/**
 * Alteração de um sistema já ativo (ADR-008): só o que soma. O modelo continua o mesmo; nenhum
 * módulo, tipo de atendimento ou campo com dados sai (há vendas, estoque, agenda e cadastros que
 * dependem deles). Regras, aparência, nomes, campos e módulos novos podem mudar.
 */
export function compatibilidadeComAtiva(ativa: ConfigDraft, nova: ConfigDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (nova.modelo !== ativa.modelo) {
    issues.push(
      block(
        "alteracao_incompativel",
        "modelo",
        "Num sistema ativo o modelo não muda. Para outro modelo, crie um sistema novo.",
      ),
    );
  }
  const saem = ativa.modulos.filter((m) => !nova.modulos.includes(m));
  if (saem.length) {
    issues.push(
      block(
        "alteracao_incompativel",
        "modulos",
        `Módulos de um sistema ativo não podem ser desligados (já têm dados): ${saem.join(", ")}.`,
      ),
    );
  }
  // Campos já em uso guardam valores nos cadastros: continuam existindo, com o mesmo tipo e, se
  // for lista, sem perder opções (senão editar um registro antigo falharia).
  for (const campo of ativa.campos) {
    const novo = nova.campos.find((c) => c.id === campo.id && c.entidade === campo.entidade);
    if (!novo) {
      issues.push(
        block(
          "alteracao_incompativel",
          "campos",
          `O campo “${campo.rotulo}” já guarda informação nos cadastros e não pode ser removido.`,
        ),
      );
    } else if (novo.tipo !== campo.tipo) {
      issues.push(
        block(
          "alteracao_incompativel",
          "campos",
          `O campo “${campo.rotulo}” já guarda informação e não pode mudar de tipo.`,
        ),
      );
    } else if (campo.tipo === "lista") {
      const faltam = (campo.opcoes ?? []).filter((o) => !(novo.opcoes ?? []).includes(o));
      if (faltam.length) {
        issues.push(
          block(
            "alteracao_incompativel",
            "campos",
            `A lista “${campo.rotulo}” não pode perder opções já usadas: ${faltam.join(", ")}.`,
          ),
        );
      }
    }
  }
  const tipos = new Set(nova.tipos_atendimento.map((t) => t.id));
  const tiposQueSaem = ativa.tipos_atendimento.filter((t) => !tipos.has(t.id));
  if (tiposQueSaem.length) {
    issues.push(
      block(
        "alteracao_incompativel",
        "tipos_atendimento",
        `Tipos de atendimento de um sistema ativo não podem ser removidos: ${tiposQueSaem.map((t) => t.rotulo).join(", ")}.`,
      ),
    );
  }
  return issues;
}
