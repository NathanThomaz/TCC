import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CircleAlert,
  ClipboardList,
  Package,
  PackageX,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ModuleId } from "../../../shared/contract/catalog";
import { formatarDataHora } from "../../../shared/dominio/agenda";
import { formatarCentavos } from "../../../shared/dominio/precos";
import { obterPainel } from "@/api/operacao";
import { ErrorState } from "@/components/nexus/Estados";
import { Skeleton } from "@/components/ui/skeleton";
import { textoDaRegra } from "@/lib/nexus";
import { Link } from "@/lib/rotas";
import { cn } from "@/lib/utils";
import { rotuloModulo, useApp } from "./Aplicacao";

// Painel do sistema ativo (ADR-005): os números do dia e do mês, o estoque crítico, clientes
// ativos, pedidos abertos e a agenda, todos calculados no backend (nunca pela IA). Cada bloco só
// aparece com o módulo ativo. Atalhos e regras em vigor ficam abaixo.

const ATALHOS: { modulo: ModuleId; caminho: string; icone: LucideIcon; texto: string }[] = [
  { modulo: "vendas", caminho: "vendas/nova", icone: ShoppingCart, texto: "Abrir uma venda" },
  { modulo: "produtos", caminho: "produtos", icone: Package, texto: "Produtos, preços e saldos" },
  { modulo: "agenda", caminho: "agenda", icone: CalendarDays, texto: "Agenda por profissional" },
  { modulo: "clientes", caminho: "clientes", icone: Users, texto: "Cadastro de clientes" },
  { modulo: "profissionais", caminho: "profissionais", icone: Wrench, texto: "Equipe" },
];

function Indicador({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  alerta,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  icone: LucideIcon;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-card",
        alerta && "border-warning/40 bg-warning-soft",
      )}
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icone className={cn("size-4", alerta ? "text-warning" : "text-primary")} aria-hidden />
        {rotulo}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

const vendasTexto = (n: number) => `${n} ${n === 1 ? "venda" : "vendas"}`;

export function Painel() {
  const app = useApp();
  const { config } = app;
  const q = useQuery({
    queryKey: ["painel", app.id],
    queryFn: () => obterPainel(app.id),
    refetchInterval: 60_000,
  });
  const p = q.data;
  const regras = config.regras.map((r) => textoDaRegra(r, config));
  const caminho = (c: string) => `/sistemas/$id/app/${c}`;

  return (
    <div className="space-y-6">
      <section aria-labelledby="titulo-numeros">
        <h2 id="titulo-numeros" className="sr-only">
          Números do negócio
        </h2>
        {q.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {p?.vendas && (
              <>
                <Indicador
                  rotulo="Vendas hoje"
                  icone={ShoppingCart}
                  valor={formatarCentavos(p.vendas.hoje.totalCentavos)}
                  detalhe={vendasTexto(p.vendas.hoje.quantidade)}
                />
                <Indicador
                  rotulo="Vendas no mês"
                  icone={TrendingUp}
                  valor={formatarCentavos(p.vendas.mes.totalCentavos)}
                  detalhe={`${vendasTexto(p.vendas.mes.quantidade)} · ${p.vendas.canceladasNoMes} ${p.vendas.canceladasNoMes === 1 ? "cancelada" : "canceladas"}`}
                />
                <Indicador
                  rotulo="Pedidos abertos"
                  icone={ClipboardList}
                  valor={String(p.vendas.abertas)}
                  detalhe="Rascunhos segurando estoque"
                />
              </>
            )}
            {p?.clientes && (
              <Indicador
                rotulo="Clientes ativos"
                icone={Users}
                valor={String(p.clientes.ativos)}
                detalhe={`${p.clientes.inativos} ${p.clientes.inativos === 1 ? "inativo" : "inativos"}`}
              />
            )}
            {p?.estoque && (
              <Indicador
                rotulo={p.estoque.minimo === null ? "Sem estoque" : "Abaixo do mínimo"}
                icone={PackageX}
                alerta={
                  (p.estoque.minimo === null
                    ? p.estoque.semEstoque
                    : (p.estoque.abaixoDoMinimo ?? 0)) > 0
                }
                valor={String(
                  p.estoque.minimo === null
                    ? p.estoque.semEstoque
                    : (p.estoque.abaixoDoMinimo ?? 0),
                )}
                detalhe={`de ${p.estoque.produtosAtivos} ${p.estoque.produtosAtivos === 1 ? "produto ativo" : "produtos ativos"}${p.estoque.minimo !== null ? ` (mínimo de ${p.estoque.minimo})` : ""}`}
              />
            )}
            {p?.agenda && (
              <Indicador
                rotulo="Atendimentos hoje"
                icone={CalendarDays}
                valor={String(
                  p.agenda.hoje.agendados + p.agenda.hoje.emAtendimento + p.agenda.hoje.concluidos,
                )}
                detalhe={`${p.agenda.hoje.emAtendimento} em atendimento · ${p.agenda.hoje.concluidos} concluídos`}
              />
            )}
          </div>
        )}
      </section>

      {p && (
        <div className="grid gap-6 lg:grid-cols-2">
          {p.estoque && (
            <section
              aria-labelledby="titulo-criticos"
              className="rounded-xl border bg-card p-4 shadow-card"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id="titulo-criticos" className="flex items-center gap-2 text-lg font-semibold">
                  <TriangleAlert className="size-5 text-warning" aria-hidden /> Estoque crítico
                </h2>
                {config.modulos.includes("estoque") && (
                  <Link
                    to={caminho("estoque")}
                    params={{ id: app.id }}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Ver estoque
                  </Link>
                )}
              </div>
              {p.estoque.criticos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Produto</th>
                      <th className="pb-2 text-right font-medium">Disponível</th>
                      <th className="pb-2 text-right font-medium">Reservado</th>
                      <th className="pb-2 pl-3 font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {p.estoque.criticos.map((c) => {
                      const zerado = c.disponivel <= 0;
                      const abaixo = p.estoque!.minimo !== null && c.disponivel < p.estoque!.minimo;
                      return (
                        <tr key={c.id}>
                          <td className="py-2">{c.nome}</td>
                          <td className="py-2 text-right tabular-nums">{c.disponivel}</td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">
                            {c.reservado}
                          </td>
                          <td className="py-2 pl-3">
                            {zerado ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-xs text-destructive">
                                <CircleAlert className="size-3.5" aria-hidden /> Sem estoque
                              </span>
                            ) : abaixo ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-xs text-warning">
                                <TriangleAlert className="size-3.5" aria-hidden /> Abaixo do mínimo
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Ok</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {p.estoque.minimo === null && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Os produtos com menor saldo disponível aparecem primeiro. Com a regra de estoque
                  mínimo, o painel avisa quando um produto fica abaixo dela.
                </p>
              )}
            </section>
          )}

          {p.vendas && (
            <section
              aria-labelledby="titulo-ultimas"
              className="rounded-xl border bg-card p-4 shadow-card"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id="titulo-ultimas" className="text-lg font-semibold">
                  Últimas vendas
                </h2>
                <Link
                  to={caminho("vendas")}
                  params={{ id: app.id }}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Ver vendas
                </Link>
              </div>
              {p.vendas.ultimas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma venda concluída ainda.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {p.vendas.ultimas.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{v.cliente}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatarDataHora(v.concluidaEm)}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatarCentavos(v.totalCentavos)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {p.agenda && (
            <section
              aria-labelledby="titulo-proximos"
              className="rounded-xl border bg-card p-4 shadow-card"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id="titulo-proximos" className="text-lg font-semibold">
                  Próximos atendimentos
                </h2>
                <Link
                  to={caminho("agenda")}
                  params={{ id: app.id }}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Ver agenda
                </Link>
              </div>
              {p.agenda.proximos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum atendimento marcado.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {p.agenda.proximos.map((a) => (
                    <li key={a.id} className="py-2">
                      <span className="font-medium">{formatarDataHora(a.inicio)}</span> · {a.tipo}
                      <span className="block text-xs text-muted-foreground">
                        {a.cliente} com {a.profissional}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="titulo-atalhos" className="lg:col-span-2">
          <h2 id="titulo-atalhos" className="mb-3 text-lg font-semibold">
            Atalhos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ATALHOS.filter((a) => config.modulos.includes(a.modulo)).map((a) => (
              <Link
                key={a.modulo}
                to={caminho(a.caminho)}
                params={{ id: app.id }}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card hover:bg-muted/40"
              >
                <a.icone
                  className="size-6 shrink-0"
                  style={{ color: config.aparencia.cor_primaria }}
                  aria-hidden
                />
                <span>
                  <span className="block font-medium">{rotuloModulo(app, a.modulo)}</span>
                  <span className="text-sm text-muted-foreground">{a.texto}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="titulo-regras"
          className="rounded-xl border bg-card p-4 shadow-card"
        >
          <h2 id="titulo-regras" className="mb-2 text-lg font-semibold">
            Regras em vigor
          </h2>
          {regras.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra parametrizada.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {regras.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Você entrou como {app.papel === "admin" ? "administrador" : "conta secundária"}.
          </p>
        </section>
      </div>
    </div>
  );
}
