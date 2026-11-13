import { Link } from "@/lib/rotas";
import { useQuery } from "@tanstack/react-query";
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
import type { InicioDto } from "../../shared/api";
import { TEMPLATE_LABELS } from "../../shared/contract/catalog";
import { formatarCentavos } from "../../shared/dominio/precos";
import { obterInicio } from "@/api/sistemas";
import { useAuth } from "@/lib/auth";
import { ROTULO_MODULO } from "@/lib/nexus";
import { cn } from "@/lib/utils";
import { CriarSistemaDialog } from "@/components/nexus/CriarSistemaDialog";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
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
  for (const { sistema: s, painel: p, pedidosAbertos } of d.sistemas) {
    const base = { sistema: s.nome, sistemaId: s.id };
    if (p?.financeiro) {
      const n = p.financeiro.vencidosReceber.quantidade + p.financeiro.vencidosPagar.quantidade;
      if (n > 0) {
        lista.push({
          ...base,
          id: `${s.id}-vencidas`,
          texto: `${plural(n, "conta vencida", "contas vencidas")} (${formatarCentavos(
            p.financeiro.vencidosPagar.totalCentavos + p.financeiro.vencidosReceber.totalCentavos,
          )})`,
          caminho: "app/financeiro",
          icone: Landmark,
          peso: 1,
        });
      }
    }
    if (p?.estoque) {
      const critico =
        p.estoque.minimo === null ? p.estoque.semEstoque : (p.estoque.abaixoDoMinimo ?? 0);
      if (critico > 0) {
        lista.push({
          ...base,
          id: `${s.id}-estoque`,
          texto:
            p.estoque.minimo === null
              ? `${plural(critico, "produto sem estoque", "produtos sem estoque")}`
              : `${plural(critico, "produto abaixo do mínimo", "produtos abaixo do mínimo")}`,
          caminho: "app/produtos",
          icone: PackageX,
          peso: 2,
        });
      }
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
    // Rascunho parado há mais de 3 dias: lembrar de terminar a configuração.
    if (s.status === "draft" && agora - s.atualizadoEm > 3 * DIA_MS) {
      const dias = Math.floor((agora - s.atualizadoEm) / DIA_MS);
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

/** Totais do dia e do mês somando os sistemas ativos. */
export function totaisDoInicio(d: InicioDto) {
  const ativos = d.sistemas.filter((s) => s.painel);
  const soma = (f: (p: NonNullable<ItemSistema["painel"]>) => number) =>
    ativos.reduce((t, s) => t + f(s.painel!), 0);
  return {
    vendasHoje: soma((p) => p.vendas?.hoje.totalCentavos ?? 0),
    qtdHoje: soma((p) => p.vendas?.hoje.quantidade ?? 0),
    vendasMes: soma((p) => p.vendas?.mes.totalCentavos ?? 0),
    qtdMes: soma((p) => p.vendas?.mes.quantidade ?? 0),
    clientes: soma((p) => p.clientes?.ativos ?? 0),
    atendimentosHoje: soma((p) =>
      p.agenda
        ? p.agenda.hoje.agendados + p.agenda.hoje.emAtendimento + p.agenda.hoje.concluidos
        : 0,
    ),
    temVendas: ativos.some((s) => s.painel?.vendas),
    temAgenda: ativos.some((s) => s.painel?.agenda),
  };
}

function Numero({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  cor,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  icone: LucideIcon;
  cor: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-lg", cor)}>
          <Icone className="size-4.5" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">{rotulo}</p>
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
  const q = useQuery({ queryKey: ["inicio"], queryFn: obterInicio, refetchInterval: 60_000 });
  const d = q.data;
  const nome = usuario?.nome.split(" ")[0] ?? "";

  const criar = (
    <CriarSistemaDialog
      gatilho={
        <Button>
          <Plus aria-hidden /> Criar sistema
        </Button>
      }
    />
  );

  if (q.isError) {
    return (
      <>
        <PageHeader titulo={`Olá, ${nome}`} acoes={criar} />
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );
  }

  if (q.isPending || !d) {
    return (
      <>
        <PageHeader titulo={`Olá, ${nome}`} acoes={criar} />
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

  return (
    <>
      <PageHeader
        titulo={`Olá, ${nome}`}
        descricao={`${dataPorExtenso(d.hoje)} · ${
          ativos.length
            ? `${plural(ativos.length, "sistema ativo", "sistemas ativos")}${
                rascunhos.length ? ` e ${plural(rascunhos.length, "rascunho", "rascunhos")}` : ""
              }`
            : "Nenhum sistema ativo ainda"
        }`}
        acoes={criar}
      />

      {d.sistemas.length === 0 ? (
        <PrimeirosPassos />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="titulo-hoje">
            <h2 id="titulo-hoje" className="sr-only">
              Resumo de hoje
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {t.temVendas ? (
                <>
                  <Numero
                    rotulo="Vendas hoje"
                    icone={ShoppingCart}
                    cor="bg-accent text-accent-foreground"
                    valor={formatarCentavos(t.vendasHoje)}
                    detalhe={`${plural(t.qtdHoje, "venda", "vendas")} em todos os sistemas`}
                  />
                  <Numero
                    rotulo="Vendas no mês"
                    icone={TrendingUp}
                    cor="bg-accent text-accent-foreground"
                    valor={formatarCentavos(t.vendasMes)}
                    detalhe={plural(t.qtdMes, "venda concluída", "vendas concluídas")}
                  />
                </>
              ) : (
                <Numero
                  rotulo="Sistemas"
                  icone={CheckCircle2}
                  cor="bg-success-soft text-success"
                  valor={String(conta("active"))}
                  detalhe={`${plural(conta("draft"), "rascunho", "rascunhos")} · ${plural(conta("archived"), "arquivado", "arquivados")}`}
                />
              )}
              {t.temAgenda && (
                <Numero
                  rotulo="Atendimentos hoje"
                  icone={CalendarDays}
                  cor="bg-accent text-accent-foreground"
                  valor={String(t.atendimentosHoje)}
                  detalhe="Agendados, em andamento e concluídos"
                />
              )}
              <Numero
                rotulo="Clientes ativos"
                icone={Users}
                cor="bg-accent text-accent-foreground"
                valor={String(t.clientes)}
                detalhe="Somando os sistemas ativos"
              />
              <Numero
                rotulo="Precisa de atenção"
                icone={CircleAlert}
                cor={
                  alertas.length ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
                }
                valor={String(alertas.length)}
                detalhe={alertas.length ? "Veja a lista abaixo" : "Tudo em dia"}
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <section aria-labelledby="titulo-sistemas" className="space-y-3 lg:col-span-2">
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
              <div className="grid gap-4 md:grid-cols-2">
                {[...ativos, ...rascunhos].slice(0, 6).map((s) => (
                  <CartaoSistema key={s.sistema.id} item={s} />
                ))}
              </div>
              {conta("archived") > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Archive className="size-3.5" aria-hidden />
                  {plural(conta("archived"), "sistema arquivado", "sistemas arquivados")} em
                  Sistemas.
                </p>
              )}
            </section>

            <aside className="space-y-6">
              <section
                aria-labelledby="titulo-atencao"
                className="rounded-xl border bg-card p-4 shadow-card"
              >
                <h2 id="titulo-atencao" className="mb-3 text-lg font-semibold">
                  Precisa de atenção
                </h2>
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
              </section>

              <section
                aria-labelledby="titulo-pedidos"
                className="rounded-xl border bg-card p-4 shadow-card"
              >
                <h2
                  id="titulo-pedidos"
                  className="mb-3 flex items-center gap-2 text-lg font-semibold"
                >
                  <Inbox className="size-5 text-primary" aria-hidden /> Pedidos ao desenvolvedor
                </h2>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ["Abertos", d.pedidos.abertos],
                      ["Em análise", d.pedidos.emAnalise],
                      ["Prontos", d.pedidos.implementados],
                    ] as const
                  ).map(([rotulo, n]) => (
                    <div key={rotulo} className="rounded-lg bg-muted/60 p-2">
                      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                      <dd className="text-xl font-semibold tabular-nums">{n}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  O que os módulos não cobrem vira pedido, registrado na conversa ou nos ajustes.
                </p>
              </section>

              {d.ia && <UsoIa gasto={d.ia.gastoCentavos} teto={d.ia.tetoCentavos} />}
            </aside>
          </div>
        </div>
      )}
    </>
  );
}

function CartaoSistema({ item }: { item: ItemSistema }) {
  const { sistema: s, painel: p, modelo, modulos } = item;
  const ativo = s.status === "active";
  const critico = p?.estoque
    ? p.estoque.minimo === null
      ? p.estoque.semEstoque
      : (p.estoque.abaixoDoMinimo ?? 0)
    : 0;
  const metricas: [string, string][] = p
    ? [
        ...(p.vendas
          ? ([
              ["Vendas hoje", formatarCentavos(p.vendas.hoje.totalCentavos)],
              ["No mês", formatarCentavos(p.vendas.mes.totalCentavos)],
            ] as [string, string][])
          : []),
        ...(p.agenda
          ? ([
              [
                "Atendimentos hoje",
                String(
                  p.agenda.hoje.agendados + p.agenda.hoje.emAtendimento + p.agenda.hoje.concluidos,
                ),
              ],
            ] as [string, string][])
          : []),
        ...(p.clientes
          ? ([["Clientes ativos", String(p.clientes.ativos)]] as [string, string][])
          : []),
      ].slice(0, 4)
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
        {modulos.length > 0 && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {modulos.map((m) => ROTULO_MODULO[m]).join(" · ")}
          </p>
        )}
        {ativo && metricas.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {metricas.map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                <dd className="font-semibold tabular-nums">{valor}</dd>
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

function UsoIa({ gasto, teto }: { gasto: number; teto: number }) {
  const pct = teto > 0 ? Math.min(100, Math.round((gasto / teto) * 100)) : 0;
  return (
    <section aria-labelledby="titulo-ia" className="rounded-xl border bg-card p-4 shadow-card">
      <h2 id="titulo-ia" className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="size-5 text-primary" aria-hidden /> Uso da IA no mês
      </h2>
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{formatarCentavos(gasto)}</span>{" "}
        <span className="text-muted-foreground">de {formatarCentavos(teto)}</span>
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Uso da IA no mês"
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
        Teto mensal do Nexus. Ao chegar nele, a conversa pausa e as telas continuam funcionando.
      </p>
    </section>
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
