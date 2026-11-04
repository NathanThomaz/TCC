import { useQuery } from "@tanstack/react-query";
import { Plus, ShoppingCart } from "lucide-react";
import type { VendaDto } from "../../../shared/api";
import { formatarDataHora } from "../../../shared/dominio/agenda";
import { formatarCentavos } from "../../../shared/dominio/precos";
import { listarVendas } from "@/api/operacao";
import { Tabela } from "@/components/app/Comum";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/lib/rotas";
import { cn } from "@/lib/utils";
import { rotuloModulo, useApp } from "./Aplicacao";

// Lista de vendas (seção 12): rascunhos (com reserva no prazo ou vencida), concluídas,
// canceladas e descartadas — estados distintos, nunca misturados.

export function situacaoVenda(v: Pick<VendaDto, "status" | "expirada">): {
  rotulo: string;
  classe: string;
} {
  if (v.status === "draft") {
    return v.expirada
      ? { rotulo: "Rascunho · reserva vencida", classe: "bg-warning-soft text-warning" }
      : { rotulo: "Rascunho · reservado", classe: "bg-info-soft text-info" };
  }
  if (v.status === "completed")
    return { rotulo: "Concluída", classe: "bg-success-soft text-success" };
  if (v.status === "cancelled")
    return { rotulo: "Cancelada", classe: "bg-danger-soft text-destructive" };
  return { rotulo: "Descartada", classe: "bg-muted text-muted-foreground" };
}

export function SituacaoVenda({ venda }: { venda: Pick<VendaDto, "status" | "expirada"> }) {
  const s = situacaoVenda(venda);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", s.classe)}>{s.rotulo}</span>
  );
}

export function Vendas() {
  const app = useApp();
  const q = useQuery({ queryKey: ["app", app.id, "vendas"], queryFn: () => listarVendas(app.id) });

  return (
    <>
      <PageHeader
        titulo={rotuloModulo(app, "vendas")}
        descricao="O rascunho reserva o estoque ao ser salvo; a reserva vence se ficar sem alteração."
        acoes={
          <Button asChild>
            <Link to="/sistemas/$id/app/vendas/nova" params={{ id: app.id }}>
              <Plus aria-hidden /> Nova venda
            </Link>
          </Button>
        }
      />
      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icone={ShoppingCart}
          titulo="Nenhuma venda ainda"
          descricao="Comece por Nova venda."
        />
      ) : (
        <Tabela cabecalho={["Criada em", "Cliente", "Situação", "Faixa", "Total"]}>
          {q.data.map((v) => (
            <tr key={v.id} className="hover:bg-muted/40">
              <td className="px-4 py-2 tabular-nums text-muted-foreground">
                <Link
                  to="/sistemas/$id/app/vendas/$venda"
                  params={{ id: app.id, venda: v.id }}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {formatarDataHora(v.criadoEm)}
                </Link>
              </td>
              <td className="px-4 py-2">{v.nomeCliente}</td>
              <td className="px-4 py-2">
                <SituacaoVenda venda={v} />
              </td>
              <td className="px-4 py-2">{v.faixa === "atacado" ? "Atacado" : "Varejo"}</td>
              <td className="px-4 py-2 font-medium tabular-nums">
                {formatarCentavos(v.totalCentavos)}
              </td>
            </tr>
          ))}
        </Tabela>
      )}
    </>
  );
}
