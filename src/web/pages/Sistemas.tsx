import { Link } from "@/lib/rotas";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, LayoutGrid, Plus } from "lucide-react";
import { listarSistemas } from "@/api/sistemas";
import { formatarData } from "@/lib/nexus";
import { CriarSistemaDialog } from "@/components/nexus/CriarSistemaDialog";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
import { StatusBadge } from "@/components/nexus/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function Sistemas() {
  const q = useQuery({ queryKey: ["sistemas"], queryFn: listarSistemas });
  const botao = (
    <CriarSistemaDialog
      gatilho={
        <Button>
          <Plus aria-hidden /> Criar sistema
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        titulo="Sistemas"
        descricao="Cada sistema é configurado e versionado separadamente."
        acoes={q.data?.length ? botao : undefined}
      />
      {q.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando sistemas">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icone={LayoutGrid}
          titulo="Nenhum sistema ainda"
          descricao="Crie o primeiro sistema e configure-o em poucos passos."
          acao={botao}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {q.data.map((s) => (
            <li key={s.id}>
              <Link
                to="/sistemas/$id"
                params={{ id: s.id }}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted focus-visible:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{s.nome}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Atualizado em{" "}
                    <span className="tabular-nums">{formatarData(s.atualizadoEm)}</span>
                    {" · "}
                    {s.versaoAtiva ? "versão ativa definida" : "sem versão ativa"}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
