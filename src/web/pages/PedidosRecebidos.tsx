import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import type { EstadoPedidoDto } from "../../shared/api";
import { listarTodosPedidos } from "@/api/pedidos";
import { EstadoPedido, FichaPedido } from "@/components/criacao/Pedido";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { dataBr, ROTULO_ESTADO_PEDIDO } from "@/lib/criacao";

// Pedidos recebidos (pedido do dono, 2026-11-15): o dono do Nexus é o desenvolvedor e vê o que
// todas as contas pediram e o Nexus ainda não faz; dá o andamento e responde pela ficha.

const ESTADOS = Object.keys(ROTULO_ESTADO_PEDIDO) as EstadoPedidoDto[];
const PENDENTES: EstadoPedidoDto[] = ["aberto", "em_analise"];

export function PedidosRecebidos() {
  const q = useQuery({ queryKey: ["pedidos-gerais"], queryFn: listarTodosPedidos });
  // Abre nos que esperam decisão: é o que o desenvolvedor precisa ver primeiro.
  const [estado, setEstado] = useState<EstadoPedidoDto | "pendentes" | "todos">("pendentes");
  const [sistema, setSistema] = useState("todos");
  const [aberto, setAberto] = useState<string | null>(null);

  const cabecalho = (
    <PageHeader
      titulo="Pedidos ao desenvolvedor"
      descricao="O que as contas pediram e o Nexus ainda não faz. Dê o andamento e responda pela ficha de cada pedido."
    />
  );
  if (q.isPending) {
    return (
      <>
        {cabecalho}
        <Skeleton className="h-64 w-full rounded-lg" />
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        {cabecalho}
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );
  }

  const sistemas = [...new Map(q.data.map((p) => [p.sistema.id, p.sistema.nome])).entries()];
  const lista = q.data.filter(
    (p) =>
      (estado === "todos" ||
        (estado === "pendentes" ? PENDENTES.includes(p.estado) : p.estado === estado)) &&
      (sistema === "todos" || p.sistema.id === sistema),
  );
  const selecionado = q.data.find((p) => p.id === aberto) ?? null;
  return (
    <>
      {cabecalho}
      {q.data.length === 0 ? (
        <EmptyState
          icone={Inbox}
          titulo="Nenhum pedido ainda"
          descricao="Quando alguém pedir algo que o Nexus ainda não faz, o pedido aparece aqui."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="recebidos-estado">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
                <SelectTrigger id="recebidos-estado" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendentes">Esperando decisão</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {ROTULO_ESTADO_PEDIDO[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recebidos-sistema">Sistema</Label>
              <Select value={sistema} onValueChange={setSistema}>
                <SelectTrigger id="recebidos-sistema" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os sistemas</SelectItem>
                  {sistemas.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="pb-2 text-sm text-muted-foreground tabular-nums">
              {lista.length} {lista.length === 1 ? "pedido" : "pedidos"}
            </span>
          </div>
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido com esses filtros.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card shadow-card">
              {lista.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="grid w-full gap-1 p-4 text-left hover:bg-muted sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
                    onClick={() => setAberto(p.id)}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{p.titulo}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {p.sistema.nome} · {p.pedidoPor.nome ?? p.pedidoPor.email}
                      </span>
                    </span>
                    <EstadoPedido estado={p.estado} />
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {dataBr(p.criadoEm)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <FichaPedido
        pedido={selecionado}
        desenvolvedor
        origem={
          selecionado
            ? `${selecionado.sistema.nome} · pedido por ${selecionado.pedidoPor.nome ?? ""} (${selecionado.pedidoPor.email})`
            : undefined
        }
        onFechar={() => setAberto(null)}
      />
    </>
  );
}
