import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { formatarDataHora } from "../../../shared/dominio/agenda";
import { listarMovimentos, listarProdutos } from "@/api/operacao";
import { Tabela } from "@/components/app/Comum";
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
import { Link } from "@/lib/rotas";
import { rotuloModulo, useApp } from "./Aplicacao";

// Movimentos de estoque (seção 11): entradas, correções, baixas de venda e estornos, com
// responsável, data e saldo depois de cada um. Entradas e correções ficam na tela de produtos.

const TIPO = {
  entrada: "Entrada",
  correcao: "Correção",
  venda: "Venda",
  estorno: "Estorno",
} as const;
const TODOS = "__todos";

export function Estoque() {
  const app = useApp();
  const [produto, setProduto] = useState(TODOS);
  const produtos = useQuery({
    queryKey: ["app", app.id, "produtos"],
    queryFn: () => listarProdutos(app.id),
  });
  const filtro = produto === TODOS ? undefined : produto;
  const q = useQuery({
    queryKey: ["app", app.id, "movimentos", filtro ?? null],
    queryFn: () => listarMovimentos(app.id, filtro),
  });
  const nome = (id: string) => produtos.data?.find((p) => p.id === id)?.nome ?? "…";

  return (
    <>
      <PageHeader
        titulo={rotuloModulo(app, "estoque")}
        descricao={
          <>
            Histórico de movimentos. Para registrar entrada ou corrigir saldo, use{" "}
            <Link to="/sistemas/$id/app/produtos" params={{ id: app.id }} className="underline">
              {rotuloModulo(app, "produtos")}
            </Link>
            .
          </>
        }
      />
      <div className="mb-4 max-w-xs space-y-1.5">
        <Label htmlFor="filtro-produto">Produto</Label>
        <Select value={produto} onValueChange={setProduto}>
          <SelectTrigger id="filtro-produto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {(produtos.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icone={History}
          titulo="Nenhum movimento"
          descricao="As entradas e vendas aparecem aqui."
        />
      ) : (
        <Tabela
          cabecalho={[
            "Data",
            "Produto",
            "Tipo",
            "Quantidade",
            "Saldo depois",
            "Motivo / venda",
            "Responsável",
          ]}
        >
          {q.data.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2 tabular-nums text-muted-foreground">
                {formatarDataHora(m.criadoEm)}
              </td>
              <td className="px-4 py-2">{nome(m.produto)}</td>
              <td className="px-4 py-2">{TIPO[m.tipo]}</td>
              <td
                className={`px-4 py-2 font-medium tabular-nums ${m.delta < 0 ? "text-destructive" : "text-success"}`}
              >
                {m.delta > 0 ? "+" : ""}
                {m.delta}
                {m.caixasInformadas ? (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({m.caixasInformadas} cx + {m.unidadesInformadas ?? 0} un.)
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-2 tabular-nums">{m.saldoDepois}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {m.venda ? (
                  <Link
                    to="/sistemas/$id/app/vendas/$venda"
                    params={{ id: app.id, venda: m.venda }}
                    className="underline"
                  >
                    Ver venda
                  </Link>
                ) : (
                  (m.motivo ?? "—")
                )}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{m.autorEmail}</td>
            </tr>
          ))}
        </Tabela>
      )}
    </>
  );
}
