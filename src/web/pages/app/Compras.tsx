import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CompraDto } from "../../../shared/api";
import { formatarDataHora, paraCampoLocal } from "../../../shared/dominio/agenda";
import { formatarCentavos } from "../../../shared/dominio/precos";
import {
  cancelarCompra,
  criarCompra,
  listarCompras,
  listarPessoas,
  listarProdutos,
  type NovaCompra,
} from "@/api/operacao";
import { ErroApi, Tabela, useChavePorConteudo } from "@/components/app/Comum";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { centavosParaReais, reaisParaCentavos } from "@/lib/nexus";
import { Link } from "@/lib/rotas";
import { useApp } from "./Aplicacao";

// Compras (ADR-006): cada compra dá entrada no estoque, grava o custo dos produtos e, com o
// financeiro, gera a conta a pagar. Cancelar devolve o estoque, se ele ainda estiver livre.

export function Compras() {
  const app = useApp();
  const qc = useQueryClient();
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const q = useQuery({
    queryKey: ["app", app.id, "compras", de, ate],
    queryFn: () => listarCompras(app.id, { de, ate }),
  });
  const [nova, setNova] = useState(false);
  const [cancelando, setCancelando] = useState<CompraDto | null>(null);
  const financeiro = app.config.modulos.includes("financeiro");

  return (
    <>
      <PageHeader
        titulo="Compras"
        descricao="Cada compra dá entrada no estoque e grava o custo dos produtos."
        acoes={
          <Button onClick={() => setNova(true)}>
            <Plus aria-hidden /> Nova compra
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-44 space-y-1.5">
          <Label htmlFor="compras-de">Comprado de</Label>
          <Input id="compras-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="w-44 space-y-1.5">
          <Label htmlFor="compras-ate">até</Label>
          <Input
            id="compras-ate"
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
        </div>
      </div>
      {q.data?.length === 200 && (
        <p className="mb-2 text-sm text-muted-foreground">
          Mostrando as 200 compras mais recentes do período. Use as datas para ver as anteriores.
        </p>
      )}
      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icone={ShoppingBag}
          titulo="Nenhuma compra ainda"
          descricao="Cadastre um fornecedor e registre a primeira compra."
        />
      ) : (
        <Tabela
          cabecalho={[
            "Data",
            "Fornecedor",
            "Itens",
            "Total",
            ...(financeiro ? ["Conta a pagar"] : []),
            "Situação",
            <span className="sr-only">Ações</span>,
          ]}
        >
          {q.data.map((c) => (
            <tr
              key={c.id}
              className={c.status === "cancelled" ? "text-muted-foreground" : undefined}
            >
              <td className="px-4 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                {formatarDataHora(c.criadoEm)}
              </td>
              <td className="px-4 py-2 font-medium">{c.nomeFornecedor}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {c.itens.map((i) => `${i.unidades} × ${i.nomeProduto}`).join(", ")}
                {c.observacao && <span className="block text-xs">{c.observacao}</span>}
              </td>
              <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                {formatarCentavos(c.totalCentavos)}
              </td>
              {financeiro && (
                <td className="px-4 py-2">
                  {c.conta ? (
                    <Link
                      to="/sistemas/$id/app/financeiro"
                      params={{ id: app.id }}
                      className="underline"
                    >
                      Ver no financeiro
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td className="px-4 py-2">
                {c.status === "completed" ? (
                  <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    Concluída
                  </span>
                ) : (
                  <span title={c.motivoCancelamento ?? undefined}>Cancelada</span>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                {c.status === "completed" && (
                  <Button size="sm" variant="outline" onClick={() => setCancelando(c)}>
                    Cancelar
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
      )}
      {nova && (
        <NovaCompraDialog
          onFechar={() => setNova(false)}
          onCriada={() => {
            void qc.invalidateQueries({ queryKey: ["app", app.id] });
            void qc.invalidateQueries({ queryKey: ["painel", app.id] });
          }}
        />
      )}
      {cancelando && (
        <CancelarCompraDialog compra={cancelando} onFechar={() => setCancelando(null)} />
      )}
    </>
  );
}

interface Linha {
  chave: string;
  produto: string;
  caixas: string;
  unidades: string;
  custo: string;
}

const linhaVazia = (): Linha => ({
  chave: crypto.randomUUID(),
  produto: "",
  caixas: "",
  unidades: "",
  custo: "",
});

/** Hoje no fuso do Nexus (AAAA-MM-DD), para o vencimento padrão; não o fuso do navegador. */
export const hojeIso = (agora = Date.now()) => paraCampoLocal(agora).slice(0, 10);

function NovaCompraDialog({ onFechar, onCriada }: { onFechar: () => void; onCriada: () => void }) {
  const app = useApp();
  const financeiro = app.config.modulos.includes("financeiro");
  const fornecedores = useQuery({
    queryKey: ["app", app.id, "fornecedores"],
    queryFn: () => listarPessoas(app.id, "fornecedores"),
  });
  const produtos = useQuery({
    queryKey: ["app", app.id, "produtos"],
    queryFn: () => listarProdutos(app.id),
  });
  const [fornecedor, setFornecedor] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);
  const [vencimento, setVencimento] = useState(hojeIso());
  const [observacao, setObservacao] = useState("");
  const chave = useChavePorConteudo();
  const ativos = (fornecedores.data ?? []).filter((f) => f.status === "active");
  const produtosAtivos = (produtos.data ?? []).filter((p) => p.status === "active");

  const mudar = (chaveLinha: string, campo: keyof Linha, valor: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chaveLinha ? { ...l, [campo]: valor } : l)));
  // Trocar o produto zera as caixas: o novo pode não ter caixa (e o campo some da tela).
  const trocarProduto = (chaveLinha: string, produto: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chaveLinha ? { ...l, produto, caixas: "" } : l)));
  const total = linhas.reduce((soma, l) => {
    const p = produtosAtivos.find((x) => x.id === l.produto);
    const unidades = Number(l.caixas || 0) * (p?.unidadesPorCaixa ?? 0) + Number(l.unidades || 0);
    return soma + unidades * (reaisParaCentavos(l.custo) ?? 0);
  }, 0);

  const m = useMutation({
    mutationFn: () => {
      if (!fornecedor) throw new Error("Escolha o fornecedor.");
      const itens = linhas
        .filter((l) => l.produto)
        .map((l) => {
          const custo = reaisParaCentavos(l.custo);
          if (custo === null || custo < 0)
            throw new Error("Informe o custo unitário de cada item.");
          return {
            produto: l.produto,
            caixas: Number(l.caixas || 0),
            unidades: Number(l.unidades || 0),
            custoUnitarioCentavos: custo,
          };
        });
      if (itens.length === 0) throw new Error("Acrescente ao menos um produto.");
      const dados: NovaCompra = {
        fornecedor,
        itens,
        ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
        ...(financeiro ? { vencimento } : {}),
      };
      return criarCompra(app.id, dados, chave(dados));
    },
    onSuccess: () => {
      toast.success("Compra registrada e estoque atualizado.");
      onCriada();
      onFechar();
    },
  });

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-w-3xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Nova compra</DialogTitle>
            <DialogDescription>
              A quantidade entra no estoque assim que a compra é registrada.
            </DialogDescription>
          </DialogHeader>
          {ativos.length === 0 && !fornecedores.isPending ? (
            <p className="text-sm">
              Cadastre um fornecedor antes, em{" "}
              <Link
                to="/sistemas/$id/app/fornecedores"
                params={{ id: app.id }}
                className="underline"
              >
                Fornecedores
              </Link>
              .
            </p>
          ) : (
            <div className="max-w-sm space-y-1.5">
              <Label htmlFor="compra-fornecedor">Fornecedor</Label>
              <Select value={fornecedor} onValueChange={setFornecedor}>
                <SelectTrigger id="compra-fornecedor">
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {ativos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Itens</legend>
            {linhas.map((l, i) => {
              const p = produtosAtivos.find((x) => x.id === l.produto);
              return (
                <div key={l.chave} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-12 space-y-1 sm:col-span-5">
                    <Label htmlFor={`item-produto-${i}`} className="text-xs">
                      Produto
                    </Label>
                    <Select value={l.produto} onValueChange={(v) => trocarProduto(l.chave, v)}>
                      <SelectTrigger id={`item-produto-${i}`}>
                        <SelectValue placeholder="Escolha" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtosAtivos.map((x) => (
                          <SelectItem key={x.id} value={x.id}>
                            {x.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {p?.unidadesPorCaixa ? (
                    <div className="col-span-4 space-y-1 sm:col-span-2">
                      <Label htmlFor={`item-caixas-${i}`} className="text-xs">
                        Caixas ({p.unidadesPorCaixa} un.)
                      </Label>
                      <Input
                        id={`item-caixas-${i}`}
                        type="number"
                        min={0}
                        value={l.caixas}
                        onChange={(e) => mudar(l.chave, "caixas", e.target.value)}
                      />
                    </div>
                  ) : null}
                  <div className="col-span-4 space-y-1 sm:col-span-2">
                    <Label htmlFor={`item-unidades-${i}`} className="text-xs">
                      Unidades
                    </Label>
                    <Input
                      id={`item-unidades-${i}`}
                      type="number"
                      min={0}
                      value={l.unidades}
                      onChange={(e) => mudar(l.chave, "unidades", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3 space-y-1 sm:col-span-2">
                    <Label htmlFor={`item-custo-${i}`} className="text-xs">
                      Custo unit. (R$)
                    </Label>
                    <Input
                      id={`item-custo-${i}`}
                      inputMode="decimal"
                      placeholder={p?.custoCentavos ? centavosParaReais(p.custoCentavos) : "0,00"}
                      value={l.custo}
                      onChange={(e) => mudar(l.chave, "custo", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="col-span-1"
                    aria-label={`Remover item ${i + 1}`}
                    disabled={linhas.length === 1}
                    onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}
            >
              <Plus aria-hidden /> Outro produto
            </Button>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {financeiro && (
              <div className="space-y-1.5">
                <Label htmlFor="compra-vencimento">Vencimento da conta a pagar</Label>
                <Input
                  id="compra-vencimento"
                  type="date"
                  required
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="compra-obs">Observação (nota fiscal, por exemplo)</Label>
              <Input
                id="compra-obs"
                maxLength={300}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>
          <p className="text-right text-sm">
            Total previsto: <strong className="tabular-nums">{formatarCentavos(total)}</strong>
          </p>
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Registrar compra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelarCompraDialog({ compra, onFechar }: { compra: CompraDto; onFechar: () => void }) {
  const app = useApp();
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: () => cancelarCompra(app.id, compra.id, motivo.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["app", app.id] });
      void qc.invalidateQueries({ queryKey: ["painel", app.id] });
      toast.success("Compra cancelada e estoque devolvido.");
      onFechar();
    },
  });
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Cancelar compra de {compra.nomeFornecedor}</DialogTitle>
            <DialogDescription>
              As quantidades saem do estoque e a conta a pagar pendente é cancelada. Se parte do
              estoque já foi vendida ou reservada, o cancelamento é recusado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="compra-motivo">Motivo</Label>
            <Textarea
              id="compra-motivo"
              required
              minLength={3}
              maxLength={300}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={m.isPending || motivo.trim().length < 3}
            >
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Cancelar compra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
