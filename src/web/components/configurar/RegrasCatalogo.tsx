import { useState } from "react";
import { CircleCheck, Lightbulb, ListPlus, Trash2 } from "lucide-react";
import { CampoDinheiro } from "@/components/nexus/CampoDinheiro";
import { RULE_MODULES } from "../../../shared/contract/catalog";
import type { PassoProps } from "@/components/configurar/Passos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centavosParaReais, DIAS_SEMANA, reaisParaCentavos, textoDaRegra } from "@/lib/nexus";
import type { Regra } from "@/types/nexus";
import { cn } from "@/lib/utils";

// Catálogo de regras prontas (ADR-005): o dono escolhe num menu regras já configuradas com valores
// comuns, ajusta se quiser e remove o que não usar. Cada regra é aplicada pela operação (vendas,
// estoque e agenda); nenhuma é só decorativa. Valor que veio pronto fica "Sugestão — confirme".

export type TipoExtra = Exclude<
  Regra["tipo"],
  "limite_atacado" | "unidades_por_caixa" | "prazo_reserva" | "par_atendimento" | "formas_pagamento"
>;

const NOME: Record<TipoExtra, string> = {
  pedido_minimo: "Pedido mínimo",
  limite_unidades_por_item: "Limite de unidades por produto na venda",
  prazo_cancelamento_venda: "Prazo para cancelar venda concluída",
  estoque_minimo: "Alerta de estoque mínimo",
  horario_funcionamento: "Horário de funcionamento",
  antecedencia_minima: "Antecedência mínima para agendar",
  prazo_cancelamento_atendimento: "Prazo para cancelar ou remarcar atendimento",
  categorias_financeiras: "Categorias de despesa e receita",
  aviso_vencimento: "Aviso de vencimento",
  orcamento_mensal: "Orçamento mensal por categoria",
  multa_juros_atraso: "Multa e juros por atraso",
};

const EXPLICA: Record<TipoExtra, string> = {
  pedido_minimo: "A venda só é concluída quando o total chega ao valor.",
  limite_unidades_por_item: "Ninguém leva mais do que isso de um mesmo produto numa venda.",
  prazo_cancelamento_venda: "Depois do prazo, a venda concluída não pode mais ser cancelada.",
  estoque_minimo: "O painel e o estoque avisam quando um produto fica abaixo disso.",
  horario_funcionamento: "Atendimentos só começam e terminam dentro do horário e dos dias.",
  antecedencia_minima: "Ninguém marca um atendimento em cima da hora.",
  prazo_cancelamento_atendimento:
    "Perto do horário, o atendimento não pode ser cancelado nem remarcado.",
  categorias_financeiras:
    "Cada conta lançada escolhe uma categoria; o financeiro mostra quanto foi para cada uma.",
  aviso_vencimento: "O painel avisa das contas pendentes que vencem nos próximos dias.",
  orcamento_mensal:
    "Limite de gasto do mês por categoria; o painel mostra quanto já foi e avisa ao passar.",
  multa_juros_atraso:
    "Conta a receber paga depois do vencimento é cobrada com multa e juros, calculados sozinhos.",
};

const SEM_REQ = { requisitos: [] as string[] };

/** Regras prontas, agrupadas como aparecem no menu. */
export const PREDEFINICOES: { grupo: string; titulo: string; regra: Regra }[] = [
  // Financeiro (ADR-015, etapa 2a).
  {
    grupo: "Financeiro",
    titulo: "Categorias para a casa",
    regra: {
      tipo: "categorias_financeiras",
      despesas: [
        "Moradia",
        "Alimentação",
        "Transporte",
        "Contas da casa",
        "Saúde",
        "Lazer",
        "Outros",
      ],
      receitas: ["Salário", "Renda extra", "Outros"],
      ...SEM_REQ,
    },
  },
  {
    grupo: "Financeiro",
    titulo: "Categorias para o negócio",
    regra: {
      tipo: "categorias_financeiras",
      despesas: ["Aluguel", "Fornecedores", "Funcionários", "Impostos", "Marketing", "Outros"],
      receitas: ["Vendas", "Serviços", "Mensalidades", "Outros"],
      ...SEM_REQ,
    },
  },
  {
    grupo: "Financeiro",
    titulo: "Avisar 3 dias antes do vencimento",
    regra: { tipo: "aviso_vencimento", dias: 3, ...SEM_REQ },
  },
  {
    grupo: "Financeiro",
    titulo: "Avisar 7 dias antes do vencimento",
    regra: { tipo: "aviso_vencimento", dias: 7, ...SEM_REQ },
  },
  {
    grupo: "Financeiro",
    titulo: "Orçamento do mês por categoria",
    // A categoria e o valor são ajustados às categorias do sistema ao escolher (ver `pronta`).
    regra: {
      tipo: "orcamento_mensal",
      limites: [{ categoria: "Outros", valor_centavos: 100_000 }],
      ...SEM_REQ,
    },
  },
  {
    grupo: "Financeiro",
    titulo: "Multa de 2% e juros de 1% ao mês",
    regra: { tipo: "multa_juros_atraso", multa_percentual: 2, juros_mes_percentual: 1, ...SEM_REQ },
  },
  {
    grupo: "Vendas",
    titulo: "Pedido mínimo de R$ 50,00",
    regra: { tipo: "pedido_minimo", valor_centavos: 5000, ...SEM_REQ },
  },
  {
    grupo: "Vendas",
    titulo: "Pedido mínimo de R$ 100,00",
    regra: { tipo: "pedido_minimo", valor_centavos: 10000, ...SEM_REQ },
  },
  {
    grupo: "Vendas",
    titulo: "Pedido mínimo de R$ 300,00",
    regra: { tipo: "pedido_minimo", valor_centavos: 30000, ...SEM_REQ },
  },
  {
    grupo: "Vendas",
    titulo: "No máximo 24 unidades de um produto por venda",
    regra: { tipo: "limite_unidades_por_item", unidades: 24, ...SEM_REQ },
  },
  {
    grupo: "Vendas",
    titulo: "No máximo 100 unidades de um produto por venda",
    regra: { tipo: "limite_unidades_por_item", unidades: 100, ...SEM_REQ },
  },
  {
    grupo: "Vendas",
    titulo: "Cancelar venda só até 1 dia depois",
    regra: { tipo: "prazo_cancelamento_venda", dias: 1, ...SEM_REQ },
  },
  {
    grupo: "Vendas",
    titulo: "Cancelar venda só até 7 dias depois",
    regra: { tipo: "prazo_cancelamento_venda", dias: 7, ...SEM_REQ },
  },
  {
    grupo: "Vendas",
    titulo: "Cancelar venda só até 30 dias depois",
    regra: { tipo: "prazo_cancelamento_venda", dias: 30, ...SEM_REQ },
  },
  {
    grupo: "Estoque",
    titulo: "Avisar com menos de 5 unidades",
    regra: { tipo: "estoque_minimo", unidades: 5, ...SEM_REQ },
  },
  {
    grupo: "Estoque",
    titulo: "Avisar com menos de 10 unidades",
    regra: { tipo: "estoque_minimo", unidades: 10, ...SEM_REQ },
  },
  {
    grupo: "Estoque",
    titulo: "Avisar com menos de 50 unidades",
    regra: { tipo: "estoque_minimo", unidades: 50, ...SEM_REQ },
  },
  {
    grupo: "Agenda",
    titulo: "Horário comercial: Seg a Sex, 08:00 às 18:00",
    regra: {
      tipo: "horario_funcionamento",
      abre: "08:00",
      fecha: "18:00",
      dias_semana: [1, 2, 3, 4, 5],
      ...SEM_REQ,
    },
  },
  {
    grupo: "Agenda",
    titulo: "Seg a Sáb, 09:00 às 19:00",
    regra: {
      tipo: "horario_funcionamento",
      abre: "09:00",
      fecha: "19:00",
      dias_semana: [1, 2, 3, 4, 5, 6],
      ...SEM_REQ,
    },
  },
  {
    grupo: "Agenda",
    titulo: "Todos os dias, 08:00 às 22:00",
    regra: {
      tipo: "horario_funcionamento",
      abre: "08:00",
      fecha: "22:00",
      dias_semana: [0, 1, 2, 3, 4, 5, 6],
      ...SEM_REQ,
    },
  },
  {
    grupo: "Agenda",
    titulo: "Marcar com pelo menos 1 hora de antecedência",
    regra: { tipo: "antecedencia_minima", minutos: 60, ...SEM_REQ },
  },
  {
    grupo: "Agenda",
    titulo: "Marcar com pelo menos 24 horas de antecedência",
    regra: { tipo: "antecedencia_minima", minutos: 1440, ...SEM_REQ },
  },
  {
    grupo: "Agenda",
    titulo: "Cancelar ou remarcar até 2 horas antes",
    regra: { tipo: "prazo_cancelamento_atendimento", horas: 2, ...SEM_REQ },
  },
  {
    grupo: "Agenda",
    titulo: "Cancelar ou remarcar até 24 horas antes",
    regra: { tipo: "prazo_cancelamento_atendimento", horas: 24, ...SEM_REQ },
  },
];

const ehExtra = (t: Regra["tipo"]): t is TipoExtra => t in NOME;

export function RegrasCatalogo({
  draft,
  set,
  sugestoes,
  setSugestoes,
}: PassoProps & { sugestoes: Regra["tipo"][]; setSugestoes: (s: Regra["tipo"][]) => void }) {
  const ativas = draft.regras.filter((r) => ehExtra(r.tipo));
  const temModulos = (t: Regra["tipo"]) => RULE_MODULES[t].every((m) => draft.modulos.includes(m));
  // O orçamento é por categoria de despesa: só aparece com as categorias, e começa na primeira.
  const categorias = draft.regras.find(
    (r): r is Extract<Regra, { tipo: "categorias_financeiras" }> =>
      r.tipo === "categorias_financeiras",
  );
  const pronta = (p: (typeof PREDEFINICOES)[number]) =>
    p.regra.tipo === "orcamento_mensal" && categorias
      ? {
          ...p,
          regra: {
            ...p.regra,
            limites: [{ categoria: categorias.despesas[0] ?? "Outros", valor_centavos: 100_000 }],
          },
        }
      : p;
  const disponiveis = PREDEFINICOES.filter(
    (p) =>
      temModulos(p.regra.tipo) &&
      !draft.regras.some((r) => r.tipo === p.regra.tipo) &&
      (p.regra.tipo !== "orcamento_mensal" || categorias !== undefined),
  ).map(pronta);
  const grupos = [...new Set(disponiveis.map((p) => p.grupo))];
  const trocar = (nova: Regra, confirmar: boolean) => {
    set((d) => ({ ...d, regras: [...d.regras.filter((r) => r.tipo !== nova.tipo), nova] }));
    setSugestoes(
      confirmar
        ? sugestoes.filter((s) => s !== nova.tipo)
        : [...sugestoes.filter((s) => s !== nova.tipo), nova.tipo],
    );
  };
  const remover = (t: Regra["tipo"]) => {
    // Sem as categorias, o orçamento (que é por categoria) sai junto.
    const saem: Regra["tipo"][] = t === "categorias_financeiras" ? [t, "orcamento_mensal"] : [t];
    set((d) => ({ ...d, regras: d.regras.filter((r) => !saem.includes(r.tipo)) }));
    setSugestoes(sugestoes.filter((s) => !saem.includes(s)));
  };

  return (
    <div className="space-y-4">
      {ativas.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma regra extra. Escolha no menu as que valem para o seu negócio.
        </p>
      )}
      {ativas.map((r) => {
        const t = r.tipo as TipoExtra;
        const sugerida = sugestoes.includes(t);
        return (
          <div key={t} className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{NOME[t]}</p>
                <p className="text-sm text-muted-foreground">{EXPLICA[t]}</p>
                <p className="mt-1 text-sm">{textoDaRegra(r, draft)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover ${NOME[t]}`}
                onClick={() => remover(t)}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            <div className="mt-3">
              <EditorRegra regra={r} draft={draft} onChange={(n) => trocar(n, true)} />
            </div>
            <div className="mt-3">
              {sugerida ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
                    <Lightbulb className="size-4" aria-hidden /> Sugestão — confirme
                  </span>
                  <Button variant="outline" size="sm" onClick={() => trocar(r, true)}>
                    Confirmar
                  </Button>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2 py-1 text-xs text-success">
                  <CircleCheck className="size-4" aria-hidden /> Você definiu
                </span>
              )}
            </div>
          </div>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={disponiveis.length === 0}>
            <ListPlus aria-hidden /> Adicionar regra pronta
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-96 w-80 overflow-y-auto">
          {grupos.map((g, i) => (
            <DropdownMenuGroup key={g}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{g}</DropdownMenuLabel>
              {disponiveis
                .filter((p) => p.grupo === g)
                .map((p) => (
                  <DropdownMenuItem
                    key={p.titulo}
                    className="flex-col items-start gap-0.5"
                    onSelect={() => trocar(p.regra, false)}
                  >
                    <span>{p.titulo}</span>
                    <span className="text-xs text-muted-foreground">
                      {EXPLICA[p.regra.tipo as TipoExtra]}
                    </span>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {disponiveis.length === 0 && ativas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Todas as regras deste modelo já estão em uso.
        </p>
      )}
    </div>
  );
}

function Numero({
  id,
  rotulo,
  valor,
  min,
  max,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="max-w-xs">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        className="mt-1 tabular-nums"
        value={Number.isFinite(valor) ? valor : ""}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
    </div>
  );
}

/** Editor dos valores de cada regra extra. */
function EditorRegra({
  regra: r,
  draft,
  onChange,
}: {
  regra: Regra;
  draft: PassoProps["draft"];
  onChange: (r: Regra) => void;
}) {
  const id = `regra-${r.tipo}`;
  switch (r.tipo) {
    case "categorias_financeiras":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <ListaDeNomes
            id={`${id}-despesas`}
            rotulo="Categorias de despesa"
            nomes={r.despesas}
            onChange={(despesas) => onChange({ ...r, despesas })}
          />
          <ListaDeNomes
            id={`${id}-receitas`}
            rotulo="Categorias de receita"
            nomes={r.receitas}
            onChange={(receitas) => onChange({ ...r, receitas })}
          />
        </div>
      );
    case "aviso_vencimento":
      return (
        <Numero
          id={id}
          rotulo="Dias antes do vencimento"
          valor={r.dias}
          min={1}
          max={30}
          onChange={(n) => onChange({ ...r, dias: n })}
        />
      );
    case "orcamento_mensal": {
      const despesas =
        draft.regras.find(
          (x): x is Extract<Regra, { tipo: "categorias_financeiras" }> =>
            x.tipo === "categorias_financeiras",
        )?.despesas ?? [];
      const livres = despesas.filter((c) => !r.limites.some((l) => l.categoria === c));
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Limite de gasto por categoria (por mês)</legend>
          {r.limites.map((l, i) => (
            <div key={l.categoria} className="flex flex-wrap items-end gap-2">
              <span className="min-w-32 pb-2 text-sm">{l.categoria}</span>
              <div className="w-40">
                <Label htmlFor={`${id}-${i}`} className="sr-only">
                  Limite de {l.categoria} (R$)
                </Label>
                <CampoValorRegra
                  id={`${id}-${i}`}
                  centavos={l.valor_centavos}
                  onCentavos={(c) =>
                    onChange({
                      ...r,
                      limites: r.limites.map((x, j) => (j === i ? { ...x, valor_centavos: c } : x)),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Tirar ${l.categoria} do orçamento`}
                disabled={r.limites.length === 1}
                onClick={() => onChange({ ...r, limites: r.limites.filter((_, j) => j !== i) })}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          {livres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {livres.map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...r,
                      limites: [...r.limites, { categoria: c, valor_centavos: 50_000 }],
                    })
                  }
                >
                  + {c}
                </Button>
              ))}
            </div>
          )}
        </fieldset>
      );
    }
    case "multa_juros_atraso":
      return (
        <div className="flex flex-wrap gap-3">
          <Percentual
            id={`${id}-multa`}
            rotulo="Multa (%)"
            valor={r.multa_percentual}
            max={20}
            onChange={(n) => onChange({ ...r, multa_percentual: n })}
          />
          <Percentual
            id={`${id}-juros`}
            rotulo="Juros ao mês (%)"
            valor={r.juros_mes_percentual}
            max={10}
            onChange={(n) => onChange({ ...r, juros_mes_percentual: n })}
          />
        </div>
      );
    case "pedido_minimo":
      return (
        <div className="max-w-xs">
          <Label htmlFor={id}>Valor mínimo (R$)</Label>
          <CampoValorRegra
            id={id}
            centavos={r.valor_centavos}
            onCentavos={(c) => onChange({ ...r, valor_centavos: c })}
          />
        </div>
      );
    case "limite_unidades_por_item":
    case "estoque_minimo":
      return (
        <Numero
          id={id}
          rotulo="Unidades"
          valor={r.unidades}
          min={1}
          max={100000}
          onChange={(n) => onChange({ ...r, unidades: n })}
        />
      );
    case "prazo_cancelamento_venda":
      return (
        <Numero
          id={id}
          rotulo="Dias"
          valor={r.dias}
          min={1}
          max={365}
          onChange={(n) => onChange({ ...r, dias: n })}
        />
      );
    case "antecedencia_minima":
      return (
        <Numero
          id={id}
          rotulo="Minutos de antecedência"
          valor={r.minutos}
          min={1}
          max={43200}
          onChange={(n) => onChange({ ...r, minutos: n })}
        />
      );
    case "prazo_cancelamento_atendimento":
      return (
        <Numero
          id={id}
          rotulo="Horas antes do início"
          valor={r.horas}
          min={1}
          max={720}
          onChange={(n) => onChange({ ...r, horas: n })}
        />
      );
    case "horario_funcionamento":
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {(["abre", "fecha"] as const).map((k) => (
              <div key={k}>
                <Label htmlFor={`${id}-${k}`}>{k === "abre" ? "Abre às" : "Fecha às"}</Label>
                <Input
                  id={`${id}-${k}`}
                  type="time"
                  className="mt-1 w-32 tabular-nums"
                  value={r[k]}
                  onChange={(e) => onChange({ ...r, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Dias de funcionamento</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((nome, d) => {
                const ligado = r.dias_semana.includes(d);
                return (
                  <button
                    key={nome}
                    type="button"
                    aria-pressed={ligado}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      ligado ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                    )}
                    onClick={() =>
                      onChange({
                        ...r,
                        dias_semana: ligado
                          ? r.dias_semana.filter((x) => x !== d)
                          : [...r.dias_semana, d].sort((a, b) => a - b),
                      })
                    }
                  >
                    {nome}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {(r.abre >= r.fecha || r.dias_semana.length === 0) && (
            <p className="text-xs text-destructive">
              O horário de abertura precisa ser antes do fechamento, com ao menos um dia.
            </p>
          )}
        </div>
      );
    default:
      return null;
  }
}

/** Lista de nomes separados por vírgula; guarda o texto enquanto a pessoa digita. */
function ListaDeNomes({
  id,
  rotulo,
  nomes,
  onChange,
}: {
  id: string;
  rotulo: string;
  nomes: string[];
  onChange: (nomes: string[]) => void;
}) {
  const [texto, setTexto] = useState(nomes.join(", "));
  return (
    <div>
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        className="mt-1"
        value={texto}
        aria-describedby={`${id}-dica`}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange(
            e.target.value
              .split(",")
              .map((n) => n.trim())
              .filter((n) => n.length >= 2)
              .slice(0, 20),
          );
        }}
      />
      <p id={`${id}-dica`} className="mt-1 text-xs text-muted-foreground">
        Separe por vírgula (até 20).
      </p>
    </div>
  );
}

function Percentual({
  id,
  rotulo,
  valor,
  max,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="w-36">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={max}
        step={0.1}
        className="mt-1 tabular-nums"
        value={Number.isFinite(valor) ? valor : ""}
        onChange={(e) =>
          onChange(Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0)
        }
      />
    </div>
  );
}

/** Valor em reais da regra, com a máscara de dinheiro; guarda o texto enquanto a pessoa digita. */
function CampoValorRegra({
  id,
  centavos,
  onCentavos,
}: {
  id: string;
  centavos: number;
  onCentavos: (c: number) => void;
}) {
  const [texto, setTexto] = useState(centavosParaReais(centavos));
  return (
    <CampoDinheiro
      id={id}
      className="mt-1"
      valor={texto}
      onValor={(t) => {
        setTexto(t);
        onCentavos(reaisParaCentavos(t) ?? 0);
      }}
    />
  );
}
