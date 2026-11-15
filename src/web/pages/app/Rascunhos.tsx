import { ArrowRight, FilePen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import { type TipoRascunho, useRascunhos } from "@/lib/rascunhos";
import { Link } from "@/lib/rotas";
import { rotuloModulo, useApp } from "./Aplicacao";

// Aba Rascunhos (pedido do dono, 2026-11-15): formulários começados e não salvos neste aparelho.
// "Continuar" abre o formulário como a pessoa deixou; ao salvar, o rascunho sai da lista.

/** Tela que abre cada tipo de rascunho (a página lê ?rascunho=id e abre o formulário). */
const DESTINO: Record<TipoRascunho, string> = {
  venda: "vendas/nova",
  produto: "produtos",
  clientes: "clientes",
  profissionais: "profissionais",
  fornecedores: "fornecedores",
  compra: "compras",
  conta: "financeiro",
  agendamento: "agenda",
};

const quando = (em: number) =>
  new Date(em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function Rascunhos() {
  const app = useApp();
  const { lista, remover } = useRascunhos(app.id);
  const tipoDe = (t: TipoRascunho) =>
    t === "venda"
      ? "Venda"
      : t === "produto"
        ? rotuloModulo(app, "produtos")
        : t === "compra"
          ? "Compra"
          : t === "conta"
            ? "Conta"
            : t === "agendamento"
              ? "Agendamento"
              : rotuloModulo(app, t);

  return (
    <>
      <PageHeader
        titulo="Rascunhos"
        descricao="Formulários começados e ainda não salvos, guardados automaticamente neste aparelho. Vendas já salvas (com estoque reservado) ficam em Vendas."
      />
      {lista.length === 0 ? (
        <EmptyState
          icone={FilePen}
          titulo="Nenhum rascunho"
          descricao="Comece uma venda, um cadastro ou uma conta e feche sem salvar: o que você preencheu fica aqui para continuar depois."
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-card">
          {lista.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{r.titulo}</p>
                <p className="text-sm text-muted-foreground">
                  {tipoDe(r.tipo)} · {r.resumo} · editado em {quando(r.atualizadoEm)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild size="sm">
                  <Link
                    to={`/sistemas/$id/app/${DESTINO[r.tipo]}`}
                    params={{ id: app.id }}
                    search={{ rascunho: r.id }}
                  >
                    Continuar <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Descartar o rascunho ${r.titulo}`}
                  onClick={() => {
                    remover(r.id);
                    toast.success("Rascunho descartado.");
                  }}
                >
                  <Trash2 aria-hidden /> Descartar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
