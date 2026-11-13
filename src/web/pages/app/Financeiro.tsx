import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, CircleAlert, Landmark, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { LancamentoDto, TipoLancamento } from "../../../shared/api";
import { formatarCentavos } from "../../../shared/dominio/precos";
import {
  acaoLancamento,
  criarLancamento,
  listarLancamentos,
  listarPessoas,
  type FiltroFinanceiro,
  type NovoLancamento,
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
import { reaisParaCentavos } from "@/lib/nexus";
import { Link } from "@/lib/rotas";
import { cn } from "@/lib/utils";
import { useApp } from "./Aplicacao";

// Financeiro (ADR-006): contas a receber e a pagar, com vencimento, baixa e cancelamento. Venda a
// prazo e compra geram a conta sozinhas e só são canceladas pela origem; as manuais, aqui.

const NENHUM = "__nenhum";
type Situacao = NonNullable<FiltroFinanceiro["status"]> | "todas";

const dataBr = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

function Resumo({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  alerta,
}: {
  rotulo: string;
  valor: number;
  detalhe: string;
  icone: typeof Landmark;
  alerta?: boolean;
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
      <p className="mt-2 text-2xl font-semibold tabular-nums">{formatarCentavos(valor)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
    </div>
  );
}

export function Financeiro() {
  const app = useApp();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoLancamento | "todos">("todos");
  const [situacao, setSituacao] = useState<Situacao>("pendente");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const filtro: FiltroFinanceiro = {
    ...(tipo !== "todos" ? { tipo } : {}),
    ...(situacao !== "todas" ? { status: situacao } : {}),
    ...(de ? { de } : {}),
    ...(ate ? { ate } : {}),
  };
  const q = useQuery({
    queryKey: ["app", app.id, "financeiro", filtro],
    queryFn: () => listarLancamentos(app.id, filtro),
  });
  const [nova, setNova] = useState(false);
  const [cancelando, setCancelando] = useState<LancamentoDto | null>(null);

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ["app", app.id, "financeiro"] });
    void qc.invalidateQueries({ queryKey: ["painel", app.id] });
  };
  const baixar = useMutation({
    mutationFn: (l: LancamentoDto) => acaoLancamento(app.id, l.id, "baixar"),
    onSuccess: (l) => {
      toast.success(l.tipo === "receber" ? "Recebimento registrado." : "Pagamento registrado.");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  // Resumo calculado no backend sobre todas as pendentes (independe do filtro e do limite).
  const r = q.data?.resumo;

  return (
    <>
      <PageHeader
        titulo="Financeiro"
        descricao="Contas a receber e a pagar. Venda a prazo e compra entram aqui sozinhas."
        acoes={
          <Button onClick={() => setNova(true)}>
            <Plus aria-hidden /> Nova conta
          </Button>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Resumo
          rotulo="A receber"
          icone={ArrowDownCircle}
          valor={r?.aReceber.totalCentavos ?? 0}
          detalhe={`${r?.aReceber.quantidade ?? 0} pendente(s)`}
        />
        <Resumo
          rotulo="A pagar"
          icone={ArrowUpCircle}
          valor={r?.aPagar.totalCentavos ?? 0}
          detalhe={`${r?.aPagar.quantidade ?? 0} pendente(s)`}
        />
        <Resumo
          rotulo="Vencidos"
          icone={CircleAlert}
          alerta={(r?.vencidos.receber ?? 0) + (r?.vencidos.pagar ?? 0) > 0}
          valor={r?.vencidos.totalCentavos ?? 0}
          detalhe={`${r?.vencidos.receber ?? 0} a receber · ${r?.vencidos.pagar ?? 0} a pagar`}
        />
        <Resumo
          rotulo="Saldo previsto"
          icone={Landmark}
          valor={(r?.aReceber.totalCentavos ?? 0) - (r?.aPagar.totalCentavos ?? 0)}
          detalhe="A receber menos a pagar (pendentes)"
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-44 space-y-1.5">
          <Label htmlFor="fin-tipo">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
            <SelectTrigger id="fin-tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="receber">A receber</SelectItem>
              <SelectItem value="pagar">A pagar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-44 space-y-1.5">
          <Label htmlFor="fin-situacao">Situação</Label>
          <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
            <SelectTrigger id="fin-situacao">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="vencido">Vencidas</SelectItem>
              <SelectItem value="pago">Pagas</SelectItem>
              <SelectItem value="cancelado">Canceladas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-44 space-y-1.5">
          <Label htmlFor="fin-de">Vencimento de</Label>
          <Input id="fin-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="w-44 space-y-1.5">
          <Label htmlFor="fin-ate">até</Label>
          <Input id="fin-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>
      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.lancamentos.length === 0 ? (
        <EmptyState
          icone={Landmark}
          titulo="Nenhuma conta neste filtro"
          descricao="Lance uma conta pelo botão Nova conta ou mude o filtro."
        />
      ) : (
        <Tabela
          cabecalho={[
            "Vencimento",
            "Descrição",
            "Cliente / fornecedor",
            "Tipo",
            "Valor",
            "Situação",
            <span className="sr-only">Ações</span>,
          ]}
        >
          {q.data.lancamentos.map((l) => (
            <tr
              key={l.id}
              className={l.status !== "pendente" ? "text-muted-foreground" : undefined}
            >
              <td className="px-4 py-2 whitespace-nowrap tabular-nums">{dataBr(l.vencimento)}</td>
              <td className="px-4 py-2">
                {l.descricao}
                {l.venda && (
                  <Link
                    to="/sistemas/$id/app/vendas/$venda"
                    params={{ id: app.id, venda: l.venda }}
                    className="ml-2 text-xs whitespace-nowrap underline"
                  >
                    Ver venda
                  </Link>
                )}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{l.contraparte ?? "—"}</td>
              <td className="px-4 py-2 whitespace-nowrap">
                {l.tipo === "receber" ? "A receber" : "A pagar"}
              </td>
              <td
                className={cn(
                  "px-4 py-2 font-medium whitespace-nowrap tabular-nums",
                  l.tipo === "receber" ? "text-success" : "text-destructive",
                )}
              >
                {l.tipo === "pagar" ? "−" : "+"} {formatarCentavos(l.valorCentavos)}
              </td>
              <td className="px-4 py-2">
                <SituacaoConta lancamento={l} />
              </td>
              <td className="px-4 py-2 text-right">
                {l.status === "pendente" && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" disabled={baixar.isPending} onClick={() => baixar.mutate(l)}>
                      {l.tipo === "receber" ? "Receber" : "Pagar"}
                    </Button>
                    {!l.venda && !l.compra && (
                      <Button size="sm" variant="outline" onClick={() => setCancelando(l)}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Tabela>
      )}
      {q.data?.resumo.limiteAtingido && (
        <p className="mt-2 text-sm text-muted-foreground">
          Mostrando as 500 primeiras contas pelo vencimento. Use o período de vencimento para ver as
          demais.
        </p>
      )}
      {nova && <NovaContaDialog onFechar={() => setNova(false)} onCriada={atualizar} />}
      {cancelando && (
        <CancelarContaDialog
          lancamento={cancelando}
          onFechar={() => setCancelando(null)}
          onCancelada={atualizar}
        />
      )}
    </>
  );
}

function SituacaoConta({ lancamento: l }: { lancamento: LancamentoDto }) {
  const [texto, classe] =
    l.status === "pago"
      ? [l.tipo === "receber" ? "Recebida" : "Paga", "bg-success/15 text-success"]
      : l.status === "cancelado"
        ? ["Cancelada", "bg-muted text-muted-foreground"]
        : l.vencido
          ? ["Vencida", "bg-warning-soft text-warning"]
          : ["Pendente", "bg-secondary text-secondary-foreground"];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classe}`}
      title={l.motivoCancelamento ?? undefined}
    >
      {texto}
    </span>
  );
}

function NovaContaDialog({ onFechar, onCriada }: { onFechar: () => void; onCriada: () => void }) {
  const app = useApp();
  const temFornecedores = app.config.modulos.includes("fornecedores");
  const [tipo, setTipo] = useState<TipoLancamento>("pagar");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [contraparte, setContraparte] = useState(NENHUM);
  const chave = useChavePorConteudo();
  const pessoas = useQuery({
    queryKey: ["app", app.id, tipo === "receber" ? "clientes" : "fornecedores"],
    queryFn: () => listarPessoas(app.id, tipo === "receber" ? "clientes" : "fornecedores"),
    enabled: tipo === "receber" || temFornecedores,
  });

  const m = useMutation({
    mutationFn: () => {
      const centavos = reaisParaCentavos(valor);
      if (centavos === null || centavos <= 0) throw new Error("Informe o valor.");
      if (!vencimento) throw new Error("Informe o vencimento.");
      const dados: NovoLancamento = {
        tipo,
        descricao: descricao.trim(),
        valorCentavos: centavos,
        vencimento,
        ...(contraparte !== NENHUM
          ? tipo === "receber"
            ? { cliente: contraparte }
            : { fornecedor: contraparte }
          : {}),
      };
      return criarLancamento(app.id, dados, chave(dados));
    },
    onSuccess: () => {
      toast.success("Conta lançada.");
      onCriada();
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
            <DialogTitle>Nova conta</DialogTitle>
            <DialogDescription>
              Para contas do dia a dia, como aluguel, luz ou um serviço a receber.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="conta-tipo">Tipo</Label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  setTipo(v as TipoLancamento);
                  setContraparte(NENHUM);
                }}
              >
                <SelectTrigger id="conta-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagar">A pagar</SelectItem>
                  <SelectItem value="receber">A receber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-valor">Valor (R$)</Label>
              <Input
                id="conta-valor"
                inputMode="decimal"
                required
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conta-descricao">Descrição</Label>
            <Input
              id="conta-descricao"
              required
              minLength={3}
              maxLength={200}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="conta-vencimento">Vencimento</Label>
              <Input
                id="conta-vencimento"
                type="date"
                required
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
            {(tipo === "receber" || temFornecedores) && (
              <div className="space-y-1.5">
                <Label htmlFor="conta-contraparte">
                  {tipo === "receber" ? "Cliente (opcional)" : "Fornecedor (opcional)"}
                </Label>
                <Select value={contraparte} onValueChange={setContraparte}>
                  <SelectTrigger id="conta-contraparte">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Nenhum</SelectItem>
                    {(pessoas.data ?? [])
                      .filter((p) => p.status === "active")
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending || descricao.trim().length < 3}>
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Lançar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelarContaDialog({
  lancamento,
  onFechar,
  onCancelada,
}: {
  lancamento: LancamentoDto;
  onFechar: () => void;
  onCancelada: () => void;
}) {
  const app = useApp();
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: () => acaoLancamento(app.id, lancamento.id, "cancelar", motivo.trim()),
    onSuccess: () => {
      toast.success("Conta cancelada.");
      onCancelada();
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
            <DialogTitle>Cancelar “{lancamento.descricao}”</DialogTitle>
            <DialogDescription>A conta sai dos pendentes e fica no histórico.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="conta-motivo">Motivo</Label>
            <Textarea
              id="conta-motivo"
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
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Cancelar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
