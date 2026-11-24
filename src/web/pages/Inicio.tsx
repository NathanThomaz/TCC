import { Link } from "@/lib/rotas";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Archive,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Inbox,
  Landmark,
  Lightbulb,
  MessageSquareText,
  PackageX,
  Plus,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { InicioDto, ResumoSistemaDto } from "../../shared/api";
import { TEMPLATE_LABELS } from "../../shared/contract/catalog";
import { rotuloDoMes } from "../../shared/dominio/periodo";
import { formatarCentavos } from "../../shared/dominio/precos";
import { obterInicio } from "@/api/sistemas";
import { useAuth } from "@/lib/auth";
import { ROTULO_MODULO } from "@/lib/nexus";
import { cn } from "@/lib/utils";
import { CriarSistemaDialog } from "@/components/nexus/CriarSistemaDialog";
import { ModelosParaComecar } from "@/components/nexus/ModelosParaComecar";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
import { FiltroMes } from "@/components/nexus/FiltroMes";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Tela inicial do Nexus: o que aconteceu hoje em todos os sistemas, o que precisa de atenção
// (estoque, contas vencidas, pedidos ao desenvolvedor, rascunhos parados) e um cartão por
// sistema. Os números vêm do mesmo cálculo do painel de cada sistema (GET /inicio).

type ItemSistema = InicioDto["sistemas"][number];

export interface Alerta {
  id: string;
  sistema: string;
  sistemaId: string;
  texto: string;
  caminho: string;
  icone: LucideIcon;
  /** Menor = mais urgente. */
  peso: number;
}

const DIA_MS = 86_400_000;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O que precisa de atenção, do mais urgente para o menos. */
export function alertasDoInicio(d: InicioDto, agora = Date.now()): Alerta[] {
  const lista: Alerta[] = [];
  for (const { sistema: s, resumo: r, pedidosAbertos, ultimaAtividade } of d.sistemas) {
    const base = { sistema: s.nome, sistemaId: s.id };
    if (r?.contasVencidas && r.contasVencidas.quantidade > 0) {
      lista.push({
        ...base,
        id: `${s.id}-vencidas`,
        texto: `${plural(r.contasVencidas.quantidade, "conta vencida", "contas vencidas")} (${formatarCentavos(r.contasVencidas.totalCentavos)})`,
        caminho: "app/financeiro",
        icone: Landmark,
        peso: 1,
      });
    }
    if (r?.estoque && r.estoque.criticos > 0) {
      lista.push({
        ...base,
        id: `${s.id}-estoque`,
        texto: r.estoque.comMinimo
          ? plural(r.estoque.criticos, "produto abaixo do mínimo", "produtos abaixo do mínimo")
          : plural(r.estoque.criticos, "produto sem estoque", "produtos sem estoque"),
        caminho: "app/produtos",
        icone: PackageX,
        peso: 2,
      });
    }
    if (pedidosAbertos > 0) {
      lista.push({
        ...base,
        id: `${s.id}-pedidos`,
        texto: `${plural(pedidosAbertos, "pedido ao desenvolvedor", "pedidos ao desenvolvedor")} em aberto`,
        caminho: "pedidos",
        icone: MessageSquareText,
        peso: 3,
      });
    }
    // Rascunho sem mexer na configuração há mais de 3 dias: lembrar de terminar.
    if (s.status === "draft" && agora - ultimaAtividade > 3 * DIA_MS) {
      const dias = Math.floor((agora - ultimaAtividade) / DIA_MS);
      lista.push({
        ...base,
        id: `${s.id}-rascunho`,
        texto: `rascunho parado há ${plural(dias, "dia", "dias")}`,
        caminho: "",
        icone: CircleDashed,
        peso: 4,
      });
    }
  }
  return lista.sort((a, b) => a.peso - b.peso);
}

/**
 * Mesma grade em todas as faixas da tela inicial. Quatro colunas só a partir de xl: com o menu
 * lateral aberto, telas menores deixariam os cartões estreitos demais e cortariam os textos.
 */
const GRADE = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";
/** "Precisa de atenção" ocupa as colunas que os outros quadros deixam livres. */
const LARGURA_ATENCAO = ["xl:col-span-4", "xl:col-span-3", "xl:col-span-2"] as const;

interface NumeroInicio {
  rotulo: string;
  valor: string;
  detalhe: string;
  icone: LucideIcon;
  cor: string;
}

/** Os números do topo: no máximo 4, uma faixa da grade. "Precisa de atenção" sai primeiro. */
export function numerosDoInicio(
  t: ReturnType<typeof totaisDoInicio>,
  alertas: number,
  conta: (status: string) => number,
  /** "no mês" ou "em outubro" (filtro de mês). */
  noMes = "no mês",
): NumeroInicio[] {
  const destaque = "bg-accent text-accent-foreground";
  const lista: NumeroInicio[] = t.temVendas
    ? [
        {
          rotulo: "Vendas hoje",
          icone: ShoppingCart,
          cor: destaque,
          valor: formatarCentavos(t.vendasHoje),
          detalhe: `${plural(t.qtdHoje, "venda", "vendas")} em todos os sistemas`,
        },
        {
          rotulo: `Vendas ${noMes}`,
          icone: TrendingUp,
          cor: destaque,
          valor: formatarCentavos(t.vendasMes),
          detalhe: plural(t.qtdMes, "venda concluída", "vendas concluídas"),
        },
      ]
    : [
        {
          rotulo: "Sistemas",
          icone: CheckCircle2,
          cor: "bg-success-soft text-success",
          valor: String(conta("active")),
          detalhe: `${plural(conta("draft"), "rascunho", "rascunhos")} · ${plural(conta("archived"), "inativo", "inativos")}`,
        },
      ];
  if (t.temAgenda) {
    lista.push({
      rotulo: "Atendimentos hoje",
      icone: CalendarDays,
      cor: destaque,
      valor: String(t.atendimentosHoje),
      detalhe: "Agendados, em andamento e concluídos",
    });
  }
  lista.push({
    rotulo: "Clientes ativos",
    icone: Users,
    cor: destaque,
    valor: String(t.clientes),
    detalhe: "Somando os sistemas ativos",
  });
  // O quadro de atenção mais abaixo já lista tudo; aqui o número só entra se couber.
  if (lista.length < 4) {
    lista.push({
      rotulo: "Precisa de atenção",
      icone: CircleAlert,
      cor: alertas ? "bg-warning-soft text-warning" : "bg-success-soft text-success",
      valor: String(alertas),
      detalhe: alertas ? "Veja em Acompanhamento" : "Tudo em dia",
    });
  }
  return lista;
}

/** Totais do dia e do mês somando os sistemas ativos. */
export function totaisDoInicio(d: InicioDto) {
  const resumos = d.sistemas.flatMap((s) => (s.resumo ? [s.resumo] : []));
  const soma = (f: (r: ResumoSistemaDto) => number) => resumos.reduce((t, r) => t + f(r), 0);
  return {
    vendasHoje: soma((r) => r.vendas?.hoje.totalCentavos ?? 0),
    qtdHoje: soma((r) => r.vendas?.hoje.quantidade ?? 0),
    vendasMes: soma((r) => r.vendas?.mes.totalCentavos ?? 0),
    qtdMes: soma((r) => r.vendas?.mes.quantidade ?? 0),
    clientes: soma((r) => r.clientesAtivos ?? 0),
    atendimentosHoje: soma((r) => r.atendimentosHoje ?? 0),
    temVendas: resumos.some((r) => r.vendas),
    temAgenda: resumos.some((r) => r.atendimentosHoje !== undefined),
  };
}

function Numero({ rotulo, valor, detalhe, icone: Icone, cor }: NumeroInicio) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", cor)}>
          <Icone className="size-4.5" aria-hidden />
        </span>
        <p className="truncate text-sm text-muted-foreground">{rotulo}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
    </div>
  );
}

const dataPorExtenso = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const texto = new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export function Inicio() {
  const { usuario } = useAuth();
  // Mês das vendas "no mês" (null = o atual); o resto do resumo é sempre de hoje.
  const [mes, setMes] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["inicio", mes ?? "atual"],
    queryFn: () => obterInicio(mes ?? undefined),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
  const d = q.data;
  const saudacao = `Olá, ${usuario?.nome ?? ""}!`;

  const criar = (
    <CriarSistemaDialog
      gatilho={
        <Button>
          <Plus aria-hidden /> Criar sistema
        </Button>
      }
    />
  );

  // Erro sem nenhum dado: tela de erro. Com dados em cache, mantém o resumo e avisa.
  if (q.isError && !d) {
    return (
      <>
        <PageHeader
          titulo={saudacao}
          acoes={
            <>
              {/* Com a consulta falhando, o seletor continua, para tentar outro mês. */}
              <FiltroMes valor={mes} onMudar={setMes} />
              {criar}
            </>
          }
        />
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );
  }

  if (!d) {
    return (
      <>
        <PageHeader titulo={saudacao} acoes={criar} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64 rounded-xl" />
      </>
    );
  }

  const t = totaisDoInicio(d);
  const alertas = alertasDoInicio(d);
  const conta = (s: string) => d.sistemas.filter((x) => x.sistema.status === s).length;
  const ativos = d.sistemas.filter((s) => s.sistema.status === "active");
  const rascunhos = d.sistemas.filter((s) => s.sistema.status === "draft");
  const noMes = rotuloDoMes(d.mes, d.hoje);
  const numeros = numerosDoInicio(t, alertas.length, conta, noMes);

  return (
    <>
      <section
        aria-labelledby="titulo-saudacao"
        className="destaque-inicio relative mb-6 overflow-hidden rounded-2xl border p-6 shadow-card sm:p-8"
      >
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">{dataPorExtenso(d.hoje)}</p>
            <h1 id="titulo-saudacao" className="mt-1 text-2xl font-semibold sm:text-3xl">
              {saudacao}
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {ativos.length === 0
                ? "Monte seu primeiro sistema conversando com a IA: em poucos minutos ele está pronto."
                : alertas.length
                  ? `${plural(alertas.length, "item precisa", "itens precisam")} de atenção em ${plural(ativos.length, "sistema ativo", "sistemas ativos")}${rascunhos.length ? ` · ${plural(rascunhos.length, "rascunho", "rascunhos")}` : ""}.`
                  : `Tudo em dia em ${plural(ativos.length, "sistema ativo", "sistemas ativos")}${rascunhos.length ? ` · ${plural(rascunhos.length, "rascunho", "rascunhos")}` : ""}.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* O filtro só muda as vendas do mês: aparece quando algum sistema vende. */}
            {t.temVendas && (
              <FiltroMes
                valor={mes}
                onMudar={setMes}
                carregando={q.isPlaceholderData}
                hoje={d.hoje}
              />
            )}
            {criar}
          </div>
        </div>
      </section>
      {q.isError && (
        <p role="status" className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          Não foi possível atualizar agora; mostrando os últimos números.{" "}
          <button className="underline" onClick={() => void q.refetch()}>
            Tentar de novo
          </button>
        </p>
      )}

      {d.sistemas.length === 0 ? (
        <PrimeirosPassos />
      ) : (
        // Uma grade só (1, 2 ou 4 colunas, mesmo espaçamento) para os números, os sistemas e o
        // acompanhamento: as bordas dos cartões ficam alinhadas entre as faixas.
        <div className="space-y-8">
          <section aria-labelledby="titulo-hoje">
            <h2 id="titulo-hoje" className="sr-only">
              Resumo de hoje
            </h2>
            <div className={cn(GRADE, "transition-opacity", q.isPlaceholderData && "opacity-60")}>
              {numeros.map((n) => (
                <Numero key={n.rotulo} {...n} />
              ))}
            </div>
          </section>

          <section aria-labelledby="titulo-sistemas" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="titulo-sistemas" className="text-lg font-semibold">
                Seus sistemas
              </h2>
              <Link
                to="/sistemas"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <div className={GRADE}>
              {[...ativos, ...rascunhos].slice(0, 7).map((s) => (
                <CartaoSistema key={s.sistema.id} item={s} noMes={noMes} />
              ))}
              <CriarSistemaDialog
                gatilho={
                  <button
                    type="button"
                    className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Plus className="size-5" aria-hidden />
                    Novo sistema
                  </button>
                }
              />
            </div>
            {(conta("archived") > 0 || d.truncado) && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Archive className="size-3.5" aria-hidden />
                {d.truncado
                  ? "Os números consideram os 100 sistemas mais relevantes (ativos primeiro)."
                  : `${plural(conta("archived"), "sistema inativo", "sistemas inativos")} em Sistemas.`}
              </p>
            )}
          </section>

          <ModelosParaComecar />

          <section aria-labelledby="titulo-acompanhamento" className="space-y-3">
            <h2 id="titulo-acompanhamento" className="text-lg font-semibold">
              Acompanhamento
            </h2>
            <div className={GRADE}>
              <div
                className={cn(
                  "rounded-xl border bg-card p-5 shadow-card sm:col-span-2",
                  LARGURA_ATENCAO[(d.pedidos ? 1 : 0) + (d.ia ? 1 : 0)],
                )}
              >
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <CircleAlert className="size-4.5 text-primary" aria-hidden /> Precisa de atenção
                </h3>
                {alertas.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                    Nada pendente. Bom trabalho!
                  </p>
                ) : (
                  <ul className="divide-y text-sm">
                    {alertas.slice(0, 8).map((a) => (
                      <li key={a.id}>
                        <Link
                          to={a.caminho ? `/sistemas/$id/${a.caminho}` : "/sistemas/$id"}
                          params={{ id: a.sistemaId }}
                          className="flex items-start gap-3 py-2.5 hover:text-primary"
                        >
                          <a.icone className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                          <span className="min-w-0">
                            <span className="block font-medium">{a.sistema}</span>
                            <span className="block text-muted-foreground">{a.texto}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {d.pedidos && (
                <div className="flex flex-col rounded-xl border bg-card p-5 shadow-card">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold">
                    <Inbox className="size-4.5 text-primary" aria-hidden /> Pedidos
                  </h3>
                  <dl className="space-y-1.5 text-sm">
                    {(
                      [
                        ["Abertos", d.pedidos.abertos],
                        ["Em análise", d.pedidos.emAnalise],
                        ["Prontos", d.pedidos.implementados],
                      ] as const
                    ).map(([rotulo, n]) => (
                      <div key={rotulo} className="flex items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">{rotulo}</dt>
                        <dd className="font-semibold tabular-nums">{n}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-auto pt-3 text-xs text-muted-foreground">
                    Pedidos ao desenvolvedor: o que os módulos não cobrem, registrado na conversa ou
                    nos ajustes.
                  </p>
                </div>
              )}

              {d.ia && (
                <UsoIa
                  gasto={d.ia.gastoCentavos}
                  teto={d.ia.tetoCentavos}
                  escopo={d.ia.escopo}
                  dono={usuario?.dono === true}
                />
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function CartaoSistema({ item, noMes }: { item: ItemSistema; noMes: string }) {
  const { sistema: s, resumo: r, modelo, modulos } = item;
  const ativo = s.status === "active";
  const critico = r?.estoque?.criticos ?? 0;
  const metricas: [string, string][] = r
    ? (
        [
          r.vendas && ["Vendas hoje", formatarCentavos(r.vendas.hoje.totalCentavos)],
          r.vendas && [
            noMes.charAt(0).toUpperCase() + noMes.slice(1),
            formatarCentavos(r.vendas.mes.totalCentavos),
          ],
          r.atendimentosHoje !== undefined && ["Atendimentos hoje", String(r.atendimentosHoje)],
          r.clientesAtivos !== undefined && ["Clientes ativos", String(r.clientesAtivos)],
        ].filter(Boolean) as [string, string][]
      ).slice(0, 4)
    : [];

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-card">
      <div
        className="h-1.5"
        style={{ background: item.corPrimaria ?? "var(--muted)" }}
        aria-hidden
      />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{s.nome}</h3>
            <p className="text-xs text-muted-foreground">
              {modelo ? TEMPLATE_LABELS[modelo] : "Modelo ainda não escolhido"}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              ativo ? "bg-success/15 text-success" : "bg-warning-soft text-warning",
            )}
          >
            {ativo ? "Ativo" : "Rascunho"}
          </span>
        </div>
        {/* Sempre a altura de 2 linhas: as métricas começam na mesma altura em todos os cartões. */}
        <p className="mt-2 line-clamp-2 min-h-8 text-xs text-muted-foreground">
          {modulos.map((m) => ROTULO_MODULO[m]).join(" · ")}
        </p>
        {ativo && metricas.length > 0 && (
          <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm">
            {metricas.map(([rotulo, valor]) => (
              <div key={rotulo} className="flex items-baseline justify-between gap-2">
                <dt className="truncate text-muted-foreground">{rotulo}</dt>
                <dd className="shrink-0 font-semibold tabular-nums">{valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {ativo && critico > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
            <PackageX className="size-3.5" aria-hidden />
            {plural(critico, "produto crítico", "produtos críticos")} no estoque
          </p>
        )}
        {!ativo && (
          <p className="mt-3 text-sm text-muted-foreground">
            Termine a configuração para começar a usar.
          </p>
        )}
        <div className="mt-auto pt-4">
          <Link
            to={ativo ? "/sistemas/$id/app" : "/sistemas/$id"}
            params={{ id: s.id }}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {ativo ? "Abrir sistema" : "Continuar configuração"}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

function UsoIa({
  gasto,
  teto,
  escopo,
  dono,
}: {
  gasto: number;
  teto: number;
  escopo: "nexus" | "conta";
  dono: boolean;
}) {
  const pct = teto > 0 ? Math.min(100, Math.round((gasto / teto) * 100)) : 100;
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 shadow-card">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Sparkles className="size-4.5 text-primary" aria-hidden />{" "}
        {/* Sempre o mês atual: o filtro de mês da tela inicial vale só para as vendas. */}
        {escopo === "conta" ? "Uso da IA da sua conta" : "Uso da IA no mês atual"}
      </h3>
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{formatarCentavos(gasto)}</span>{" "}
        <span className="text-muted-foreground">de {formatarCentavos(teto)}</span>
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Uso da IA no mês atual"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className={cn("h-full rounded-full", pct >= 80 ? "bg-warning" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {escopo === "conta"
          ? "Limite mensal da sua conta. Ao chegar nele, a conversa com a IA pausa, o progresso fica salvo e as telas continuam funcionando."
          : "Teto mensal do Nexus. Ao chegar nele, a conversa pausa e as telas continuam funcionando."}
      </p>
      {dono && (
        <Link
          to="/consumo"
          className="mt-auto inline-block rounded pt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver consumo por conta
        </Link>
      )}
    </div>
  );
}

function PrimeirosPassos() {
  const passos: [LucideIcon, string, string][] = [
    [Plus, "Crie um sistema", "Dê um nome ao seu negócio para começar."],
    [
      MessageSquareText,
      "Converse com a IA",
      "Responda perguntas curtas; ela monta a configuração.",
    ],
    [CheckCircle2, "Revise e ative", "Confira o resumo, ative e comece a vender ou agendar."],
  ];
  return (
    <div className="space-y-6">
      <EmptyState
        icone={Lightbulb}
        titulo="Seu primeiro sistema em poucos minutos"
        descricao="Sem planilha nem programação: o Nexus monta o sistema a partir do que você conta sobre o negócio."
      />
      <ModelosParaComecar />
      <ol className="grid gap-4 md:grid-cols-3">
        {passos.map(([Icone, titulo, texto], i) => (
          <li key={titulo} className="rounded-xl border bg-card p-5 shadow-card">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icone className="size-4.5" aria-hidden />
            </span>
            <p className="mt-3 font-semibold">
              {i + 1}. {titulo}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
