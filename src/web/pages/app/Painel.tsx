import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  Banknote,
  Landmark,
  ShoppingBag,
  CalendarCheck,
  CalendarClock,
  UserX,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  Package,
  PackageX,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  UserCheck,
  UserPlus,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { PainelDto } from "../../../shared/api";
import type { ModuleId } from "../../../shared/contract/catalog";
import { formatarDataHora } from "../../../shared/dominio/agenda";
import { mesDoDia, nomeDoMes, rotuloDoMes } from "../../../shared/dominio/periodo";
import { formatarCentavos } from "../../../shared/dominio/precos";
import { obterPainel } from "@/api/operacao";
import { ErrorState } from "@/components/nexus/Estados";
import { FiltroMes } from "@/components/nexus/FiltroMes";
import { Skeleton } from "@/components/ui/skeleton";
import { ROTULO_PAGAMENTO, textoDaRegra } from "@/lib/nexus";
import { Link } from "@/lib/rotas";
import { OrcamentoDoMes } from "@/components/app/Orcamento";
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
  { modulo: "fornecedores", caminho: "compras", icone: ShoppingBag, texto: "Registrar uma compra" },
  {
    modulo: "financeiro",
    caminho: "financeiro",
    icone: Landmark,
    texto: "Contas a pagar e receber",
  },
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
  detalhe?: string | undefined;
  icone: LucideIcon;
  alerta?: boolean | undefined;
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
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export interface IndicadorDados {
  id: string;
  rotulo: string;
  valor: string;
  detalhe?: string;
  icone: LucideIcon;
  alerta?: boolean;
  /** Menor = mais importante. O painel mostra os 8 mais importantes que o sistema tem. */
  prioridade: number;
}

export const LIMITE_INDICADORES = 8;

/**
 * Indicadores do painel, a partir dos blocos que o backend devolveu (um por módulo ativo). As
 * prioridades fazem os três modelos completarem 8: comércio, serviços e comércio com serviços.
 */
export function indicadores(p: PainelDto): IndicadorDados[] {
  // "no mês" ou "em outubro": o filtro de mês muda só os números do período.
  const noMes = rotuloDoMes(p.mes, p.hoje);
  const lista: IndicadorDados[] = [];
  const add = (i: IndicadorDados) => lista.push(i);
  if (p.vendas) {
    const v = p.vendas;
    add({
      id: "vendas-hoje",
      prioridade: 1,
      rotulo: "Vendas hoje",
      icone: ShoppingCart,
      valor: formatarCentavos(v.hoje.totalCentavos),
      detalhe: vendasTexto(v.hoje.quantidade),
    });
    add({
      id: "vendas-mes",
      prioridade: 2,
      rotulo: `Vendas ${noMes}`,
      icone: TrendingUp,
      valor: formatarCentavos(v.mes.totalCentavos),
      detalhe: `${vendasTexto(v.mes.quantidade)} · ${plural(v.canceladasNoMes, "cancelada", "canceladas")}`,
    });
    add({
      id: "ticket",
      prioridade: 6,
      rotulo: `Ticket médio ${noMes}`,
      icone: Receipt,
      valor: formatarCentavos(
        v.mes.quantidade ? Math.round(v.mes.totalCentavos / v.mes.quantidade) : 0,
      ),
      detalhe: "Valor médio por venda concluída",
    });
    add({
      id: "abertas",
      prioridade: 9,
      rotulo: "Pedidos abertos",
      icone: ClipboardList,
      valor: String(v.abertas),
      detalhe: "Rascunhos segurando estoque",
    });
  }
  if (p.clientes) {
    const c = p.clientes;
    add({
      id: "clientes",
      prioridade: 3,
      rotulo: "Clientes ativos",
      icone: Users,
      valor: String(c.ativos),
      detalhe: `${plural(c.novosNoMes, "novo", "novos")} ${noMes} · ${plural(c.inativos, "inativo", "inativos")}`,
    });
    if (p.vendas) {
      add({
        id: "compraram",
        prioridade: 10,
        rotulo: "Clientes que compraram",
        icone: UserCheck,
        valor: String(p.vendas.clientesNoMes),
        // Contagem simples: quem comprou e depois foi inativado continua contando no mês.
        detalhe: `Diferentes, com venda concluída ${noMes}`,
      });
    } else {
      add({
        id: "novos",
        prioridade: 13,
        rotulo: `Clientes novos ${noMes}`,
        icone: UserPlus,
        valor: String(c.novosNoMes),
        detalhe: noMes === "no mês" ? "Cadastrados neste mês" : `Cadastrados ${noMes}`,
      });
    }
  }
  if (p.estoque) {
    const e = p.estoque;
    const critico = e.abaixoDoMinimo ?? e.semEstoque;
    add({
      id: "estoque-critico",
      prioridade: 4,
      rotulo: e.abaixoDoMinimo === null ? "Sem estoque" : "Estoque baixo",
      icone: PackageX,
      alerta: critico > 0,
      valor: String(critico),
      detalhe: `de ${plural(e.produtosAtivos, "produto ativo", "produtos ativos")}${e.abaixoDoMinimo === null ? "" : e.minimo !== null ? ` (mínimo de ${e.minimo})` : " (mínimo de cada produto)"}`,
    });
    // Com valor de compra nos produtos, o balanço ocupa o lugar do valor em estoque (os
    // indicadores são limitados e o lucro previsto já diz por quanto o estoque vende).
    if (!e.custo) {
      add({
        id: "valor-estoque",
        prioridade: 8,
        rotulo: "Valor em estoque",
        icone: Warehouse,
        valor: formatarCentavos(e.valorVarejoCentavos),
        detalhe: `${plural(e.unidades, "unidade", "unidades")} a preço de varejo`,
      });
    } else {
      add({
        id: "lucro-estoque",
        // Pedido do dono (balanço): logo depois de clientes, antes de vendas abertas.
        prioridade: 6.2,
        rotulo: "Lucro previsto no estoque",
        icone: TrendingUp,
        alerta: e.custo.lucroPrevistoCentavos < 0,
        valor: formatarCentavos(e.custo.lucroPrevistoCentavos),
        detalhe: `Custa ${formatarCentavos(e.custo.valorCustoCentavos)} e vende por ${formatarCentavos(e.custo.valorVendaCentavos)}${e.custo.semCusto ? ` · ${plural(e.custo.semCusto, "produto sem valor de compra", "produtos sem valor de compra")}` : ""}`,
      });
    }
  }
  if (p.agenda) {
    const a = p.agenda;
    add({
      id: "atendimentos-hoje",
      prioridade: 5,
      rotulo: "Atendimentos hoje",
      icone: CalendarDays,
      valor: String(a.hoje.agendados + a.hoje.emAtendimento + a.hoje.concluidos),
      detalhe: `${a.hoje.emAtendimento} em atendimento · ${plural(a.hoje.concluidos, "concluído", "concluídos")}`,
    });
    add({
      id: "proximos-7",
      prioridade: 7,
      rotulo: "Próximos 7 dias",
      icone: CalendarClock,
      valor: String(a.proximos7Dias),
      detalhe: "Atendimentos agendados",
    });
    add({
      id: "concluidos-mes",
      prioridade: 11,
      rotulo: `Concluídos ${noMes}`,
      icone: CalendarCheck,
      valor: String(a.concluidosNoMes),
      detalhe:
        a.concluidosNoMes + a.canceladosNoMes > 0
          ? `${Math.round((a.concluidosNoMes / (a.concluidosNoMes + a.canceladosNoMes)) * 100)}% dos que saíram da agenda`
          : "Nenhum atendimento encerrado ainda",
    });
    add({
      id: "profissionais",
      prioridade: 12,
      rotulo: "Profissionais ativos",
      icone: Wrench,
      valor: String(a.profissionaisAtivos),
      detalhe: "Na agenda",
    });
    add({
      id: "cancelados-mes",
      prioridade: 14,
      rotulo: `Cancelados ${noMes}`,
      icone: Ban,
      alerta: a.canceladosNoMes > 0 && a.canceladosNoMes >= a.concluidosNoMes,
      valor: String(a.canceladosNoMes),
      detalhe: "Atendimentos cancelados",
    });
    const prox = a.proximos[0];
    const quando = prox ? formatarDataHora(prox.inicio) : "";
    add({
      id: "proximo",
      prioridade: 15,
      rotulo: "Próximo atendimento",
      icone: CalendarDays,
      valor: prox ? `${quando.slice(0, 5)} ${quando.slice(11)}` : "—",
      detalhe: prox ? `${prox.cliente} · ${prox.tipo}` : "Nada agendado",
    });
  }
  // Regras de estoque e clientes (ADR-015, etapa 2b).
  if (p.estoque?.validade) {
    const v = p.estoque.validade;
    const total = v.vencidos + v.vencendo;
    add({
      id: "validade",
      prioridade: total > 0 ? 4.2 : 14.2,
      rotulo: "Validade",
      icone: CalendarClock,
      alerta: total > 0,
      valor: String(total),
      detalhe: `${plural(v.vencidos, "produto vencido", "produtos vencidos")} · ${v.vencendo} vence(m) em até ${v.dias} dias`,
    });
  }
  if (p.clientes?.semComprar) {
    const c = p.clientes.semComprar;
    add({
      id: "sem-comprar",
      prioridade: c.quantidade > 0 ? 8.5 : 15,
      rotulo: "Clientes sem comprar",
      icone: UserX,
      alerta: false,
      valor: String(c.quantidade),
      detalhe: `Há mais de ${c.dias} dias sem comprar`,
    });
  }
  if (p.financeiro) {
    const f = p.financeiro;
    const vencidos = f.vencidosReceber.quantidade + f.vencidosPagar.quantidade;
    add({
      id: "vencidos",
      // Conta vencida é o que mais pede atenção; sem vencidos, cede o lugar.
      prioridade: vencidos > 0 ? 3.5 : 13.5,
      rotulo: "Contas vencidas",
      icone: CircleAlert,
      alerta: vencidos > 0,
      valor: String(vencidos),
      detalhe: `${formatarCentavos(f.vencidosReceber.totalCentavos)} a receber · ${formatarCentavos(f.vencidosPagar.totalCentavos)} a pagar`,
    });
    if (f.vencendoEmBreve) {
      const b = f.vencendoEmBreve;
      add({
        id: "vence-em-breve",
        prioridade: b.quantidade > 0 ? 4 : 14,
        rotulo: `Vence em ${b.dias} ${b.dias === 1 ? "dia" : "dias"}`,
        icone: CalendarClock,
        alerta: b.quantidade > 0,
        valor: String(b.quantidade),
        detalhe:
          b.quantidade > 0
            ? `${formatarCentavos(b.totalCentavos)} em contas pendentes`
            : "Nenhuma conta vence nesse prazo",
      });
    }
    add({
      id: "a-receber",
      prioridade: 6.5,
      rotulo: "A receber",
      icone: ArrowDownCircle,
      valor: formatarCentavos(f.aReceber.totalCentavos),
      detalhe: `${plural(f.aReceber.quantidade, "conta pendente", "contas pendentes")} · ${formatarCentavos(f.recebidoNoMesCentavos)} recebidos ${noMes}`,
    });
    add({
      id: "a-pagar",
      prioridade: 7.5,
      rotulo: "A pagar",
      icone: ArrowUpCircle,
      valor: formatarCentavos(f.aPagar.totalCentavos),
      detalhe: `${plural(f.aPagar.quantidade, "conta pendente", "contas pendentes")} · ${formatarCentavos(f.pagoNoMesCentavos)} pagos ${noMes}`,
    });
  }
  if (p.pagamentos) {
    const [mais] = p.pagamentos;
    add({
      id: "forma-mais-usada",
      prioridade: 10.5,
      rotulo: `Forma mais usada ${noMes}`,
      icone: Banknote,
      valor: mais ? ROTULO_PAGAMENTO[mais.forma] : "—",
      detalhe: mais
        ? `${formatarCentavos(mais.totalCentavos)} em ${vendasTexto(mais.quantidade)}`
        : `Nenhuma venda ${noMes}`,
    });
  }
  if (p.compras) {
    const c = p.compras;
    const balancoNoEstoque = !!p.estoque?.custo;
    add({
      id: "compras-mes",
      prioridade: 11.5,
      rotulo: `Compras ${noMes}`,
      icone: ShoppingBag,
      valor: formatarCentavos(c.noMes.totalCentavos),
      detalhe: `${plural(c.noMes.quantidade, "compra", "compras")} · ${plural(c.fornecedoresAtivos, "fornecedor ativo", "fornecedores ativos")}`,
    });
    // Com o balanço do estoque, o valor a custo já aparece no "Lucro previsto".
    if (!balancoNoEstoque)
      add({
        id: "estoque-custo",
        prioridade: 12.5,
        rotulo: "Estoque a preço de custo",
        icone: Warehouse,
        valor: formatarCentavos(c.valorCustoCentavos),
        detalhe: "Pelo último custo de compra de cada produto",
      });
  }
  // Os mais importantes, mostrados na ordem dos módulos (vendas, clientes, estoque, agenda).
  const escolhidos = new Set(
    [...lista]
      .sort((x, y) => x.prioridade - y.prioridade)
      .slice(0, LIMITE_INDICADORES)
      .map((i) => i.id),
  );
  return lista.filter((i) => escolhidos.has(i.id));
}

export function Painel() {
  const app = useApp();
  const { config } = app;
  // Mês dos números "do mês" (null = o atual), guardado por sistema: ao trocar de sistema, volta
  // ao mês atual. Hoje e o estado atual não mudam com ele.
  const [filtro, setFiltro] = useState<{ sistema: string; mes: string | null } | null>(null);
  const mes = filtro?.sistema === app.id ? filtro.mes : null;
  const q = useQuery({
    queryKey: ["painel", app.id, mes ?? "atual"],
    queryFn: () => obterPainel(app.id, mes ?? undefined),
    refetchInterval: 60_000,
    // Ao trocar o mês, os números anteriores ficam na tela até os novos chegarem; nunca os de
    // outro sistema.
    placeholderData: (anterior, consulta) =>
      consulta?.queryKey[1] === app.id ? anterior : undefined,
  });
  const p = q.data;
  const outroMes = p !== undefined && p.mes !== mesDoDia(p.hoje);
  const regras = config.regras.map((r) => textoDaRegra(r, config));
  const caminho = (c: string) => `/sistemas/$id/app/${c}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {outroMes && !q.isPlaceholderData && (
          <p className="text-sm text-muted-foreground">
            Números de {nomeDoMes(p.mes)}; hoje, estoque e contas em aberto continuam atuais.
          </p>
        )}
        <FiltroMes
          valor={mes}
          onMudar={(m) => setFiltro({ sistema: app.id, mes: m })}
          carregando={q.isPlaceholderData}
          hoje={p?.hoje}
        />
      </div>
      <section aria-labelledby="titulo-numeros" aria-busy={q.isPlaceholderData}>
        <h2 id="titulo-numeros" className="sr-only">
          Números do negócio
        </h2>
        {q.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: LIMITE_INDICADORES }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
        ) : (
          // Enquanto o mês escolhido carrega, os números do anterior ficam esmaecidos.
          <div
            className={cn(
              "grid gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-4",
              q.isPlaceholderData && "opacity-60",
            )}
          >
            {p &&
              indicadores(p).map((i) => (
                <Indicador
                  key={i.id}
                  rotulo={i.rotulo}
                  valor={i.valor}
                  detalhe={i.detalhe}
                  icone={i.icone}
                  alerta={i.alerta}
                />
              ))}
          </div>
        )}
      </section>

      {p && (
        // Cartão sozinho na linha (ex.: Controle financeiro, só "Contas a vencer") ocupa a largura.
        <div className="grid gap-6 lg:grid-cols-2 lg:[&>*:only-child]:col-span-2">
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
                      {/* Sem vendas não há reserva (controle de estoque). */}
                      {config.modulos.includes("vendas") && (
                        <th className="pb-2 text-right font-medium">Reservado</th>
                      )}
                      <th className="pb-2 pl-3 font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {p.estoque.criticos.map((c) => {
                      const zerado = c.disponivel <= 0;
                      const abaixo = c.minimo !== null && c.disponivel < c.minimo;
                      return (
                        <tr key={c.id}>
                          <td className="py-2">{c.nome}</td>
                          <td className="py-2 text-right tabular-nums">{c.disponivel}</td>
                          {config.modulos.includes("vendas") && (
                            <td className="py-2 text-right tabular-nums text-muted-foreground">
                              {c.reservado}
                            </td>
                          )}
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

          {p.financeiro && (
            <section
              aria-labelledby="titulo-contas"
              className="rounded-xl border bg-card p-4 shadow-card"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id="titulo-contas" className="text-lg font-semibold">
                  Contas a vencer
                </h2>
                <Link
                  to={caminho("financeiro")}
                  params={{ id: app.id }}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Ver financeiro
                </Link>
              </div>
              {p.financeiro.proximos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conta pendente.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {p.financeiro.proximos.map((l) => {
                    const [a, m, d] = l.vencimento.split("-");
                    const vencida = l.vencimento < p.hoje;
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{l.descricao}</span>
                          <span
                            className={cn(
                              "block text-xs",
                              vencida ? "text-warning" : "text-muted-foreground",
                            )}
                          >
                            {vencida ? "Venceu em" : "Vence em"} {d}/{m}/{a}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 tabular-nums",
                            l.tipo === "receber" ? "text-success" : "text-destructive",
                          )}
                        >
                          {l.tipo === "pagar" ? "−" : "+"} {formatarCentavos(l.valorCentavos)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
          {p.financeiro?.orcamento && p.financeiro.orcamento.length > 0 && (
            <section
              aria-labelledby="titulo-orcamento-painel"
              className="rounded-xl border bg-card p-4 shadow-card"
            >
              <h2 id="titulo-orcamento-painel" className="mb-3 text-lg font-semibold">
                Orçamento {outroMes ? `de ${nomeDoMes(p.mes)}` : "do mês"}
              </h2>
              <OrcamentoDoMes itens={p.financeiro.orcamento} />
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
