import { Link } from "@/lib/rotas";
import { useQuery } from "@tanstack/react-query";
import { Archive, CheckCircle2, CircleDashed, Plus } from "lucide-react";
import { listarSistemas } from "@/api/sistemas";
import { useAuth } from "@/lib/auth";
import { CriarSistemaDialog } from "@/components/nexus/CriarSistemaDialog";
import { ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function Inicio() {
  const { usuario } = useAuth();
  const q = useQuery({ queryKey: ["sistemas"], queryFn: listarSistemas });
  const conta = (s: string) => q.data?.filter((x) => x.status === s).length ?? 0;
  const cards = [
    {
      rotulo: "Rascunho",
      valor: conta("draft"),
      Icone: CircleDashed,
      cor: "text-warning bg-warning-soft",
    },
    {
      rotulo: "Ativos",
      valor: conta("active"),
      Icone: CheckCircle2,
      cor: "text-success bg-success-soft",
    },
    {
      rotulo: "Arquivados",
      valor: conta("archived"),
      Icone: Archive,
      cor: "text-muted-foreground bg-neutral-soft",
    },
  ];

  return (
    <>
      <PageHeader
        titulo={`Olá, ${usuario?.nome.split(" ")[0] ?? ""}`}
        descricao="Acompanhe seus sistemas e comece uma nova configuração quando quiser."
        acoes={
          <CriarSistemaDialog
            gatilho={
              <Button>
                <Plus aria-hidden /> Criar sistema
              </Button>
            }
          />
        }
      />
      {q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map(({ rotulo, valor, Icone, cor }) => (
            <Link
              key={rotulo}
              to="/sistemas"
              className="rounded-xl border bg-card p-5 shadow-card transition-shadow hover:shadow-raised"
            >
              <div className={`mb-4 flex size-9 items-center justify-center rounded-lg ${cor}`}>
                <Icone className="size-4.5" aria-hidden />
              </div>
              {q.isPending ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums">{valor}</p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">{rotulo}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
