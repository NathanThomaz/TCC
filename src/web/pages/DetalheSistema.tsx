import { Link } from "@/lib/rotas";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileStack, Info, Settings2 } from "lucide-react";
import { HashCurto } from "@/components/nexus/HashCurto";
import { obterSistema } from "@/api/sistemas";
import { formatarData } from "@/lib/nexus";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
import { StatusBadge } from "@/components/nexus/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function Detalhe() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["sistema", id], queryFn: () => obterSistema(id) });

  const voltar = (
    <Link
      to="/sistemas"
      className="mb-4 inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> Sistemas
    </Link>
  );

  if (q.isPending)
    return (
      <div aria-busy="true" aria-label="Carregando sistema">
        {voltar}
        <Skeleton className="mb-6 h-10 w-72" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  if (q.isError)
    return (
      <>
        {voltar}
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );

  const { sistema, versoes } = q.data;
  const ativa = versoes.find((v) => v.id === sistema.versaoAtiva);

  return (
    <>
      {voltar}
      <PageHeader
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {sistema.nome}
            <StatusBadge status={sistema.status} />
          </span>
        }
        descricao={
          <>
            Versão ativa:{" "}
            {ativa ? <span className="tabular-nums">v{ativa.versao}</span> : "nenhuma"} · criado em{" "}
            <span className="tabular-nums">{formatarData(sistema.criadoEm)}</span>
          </>
        }
        acoes={
          sistema.status === "draft" ? (
            <Button asChild>
              <Link to="/sistemas/$id/configurar" params={{ id }} search={{ passo: 1 }}>
                <Settings2 aria-hidden /> Configurar
              </Link>
            </Button>
          ) : undefined
        }
      />

      {sistema.status === "active" && (
        <div
          role="note"
          className="mb-6 flex gap-3 rounded-lg border border-info/30 bg-info-soft p-4 text-sm"
        >
          <Info className="size-5 shrink-0 text-info" aria-hidden />
          <p>Alterar a configuração de um sistema ativo ainda não está disponível nesta versão.</p>
        </div>
      )}
      {sistema.status === "archived" && (
        <div role="note" className="mb-6 flex gap-3 rounded-lg border bg-muted p-4 text-sm">
          <Info className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p>Este sistema está arquivado e não pode ser configurado.</p>
        </div>
      )}

      <section aria-labelledby="titulo-versoes">
        <h2 id="titulo-versoes" className="mb-3 text-lg font-semibold">
          Histórico de versões
        </h2>
        {versoes.length === 0 ? (
          <EmptyState
            icone={FileStack}
            titulo="Nenhuma versão salva"
            descricao={
              sistema.status === "draft"
                ? "Configure o sistema e valide para salvar a primeira versão."
                : "Este sistema não possui versões."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Versão
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Origem
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Hash
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {versoes.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2 font-medium tabular-nums">
                      v{v.versao}
                      {v.id === sistema.versaoAtiva && (
                        <span className="ml-2 text-xs text-success">(ativa)</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {v.origem === "formulario" ? "Formulário" : "Conversa"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-4 py-2">
                      <HashCurto hash={v.hash} />
                    </td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                      {formatarData(v.criadoEm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export { Detalhe as DetalheSistema };
