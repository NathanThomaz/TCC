import { useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wrench } from "lucide-react";
import type { EstadoPedidoDto } from "../../shared/api";
import { listarPedidos } from "@/api/pedidos";
import { obterSistema } from "@/api/sistemas";
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
import { dataBr, ROTULO_ASSUNTO, ROTULO_ESTADO_PEDIDO } from "@/lib/criacao";
import { Link } from "@/lib/rotas";

// Pedidos ao desenvolvedor do sistema (ADR-004): o que o Nexus ainda não faz, com a ficha de cada
// pedido, o histórico, comentários e o cancelamento enquanto estiver aberto.

const ESTADOS = Object.keys(ROTULO_ESTADO_PEDIDO) as EstadoPedidoDto[];

export function Pedidos() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["pedidos", id], queryFn: () => listarPedidos(id) });
  const detalhe = useQuery({ queryKey: ["sistema", id], queryFn: () => obterSistema(id) });
  const [filtro, setFiltro] = useState<EstadoPedidoDto | "todos">("todos");
  const [aberto, setAberto] = useState<string | null>(null);

  const voltar = (
    <Link
      to="/sistemas/$id"
      params={{ id }}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> {detalhe.data?.sistema.nome ?? "Sistema"}
    </Link>
  );
  const cabecalho = (
    <PageHeader
      titulo="Pedidos ao desenvolvedor"
      descricao="O que você pediu e o Nexus ainda não faz. Não há prazo definido para nenhum pedido."
    />
  );
  if (q.isPending) {
    return (
      <>
        {voltar}
        {cabecalho}
        <Skeleton className="h-64 w-full rounded-lg" />
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        {voltar}
        {cabecalho}
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );
  }

  const pedidos = q.data.filter((p) => filtro === "todos" || p.estado === filtro);
  return (
    <>
      {voltar}
      {cabecalho}
      {q.data.length === 0 ? (
        <EmptyState
          icone={Wrench}
          titulo="Nenhum pedido"
          descricao="Quando você pedir algo que o Nexus ainda não faz, ele aparece aqui."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Label htmlFor="filtro-estado">Estado</Label>
            <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
              <SelectTrigger id="filtro-estado" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ROTULO_ESTADO_PEDIDO[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground tabular-nums">
              {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}
            </span>
          </div>
          {pedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido neste estado.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card shadow-card">
              {pedidos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="grid w-full gap-1 p-4 text-left hover:bg-muted sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
                    onClick={() => setAberto(p.id)}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{p.titulo}</span>
                      <span className="block text-sm text-muted-foreground">
                        {p.assunto ? ROTULO_ASSUNTO[p.assunto] : "Pedido do modo avançado"}
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
        pedido={q.data.find((p) => p.id === aberto) ?? null}
        sistema={id}
        onFechar={() => setAberto(null)}
      />
    </>
  );
}
