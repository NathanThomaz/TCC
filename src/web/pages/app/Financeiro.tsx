import { useState } from "react";
import { CampoDinheiro } from "@/components/nexus/CampoDinheiro";
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
import { AvisoRascunho, ErroApi, Tabela, useChavePorConteudo } from "@/components/app/Comum";
import { type Rascunho, useRascunho, useRascunhoDaBusca } from "@/lib/rascunhos";
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
import { OrcamentoDoMes } from "@/components/app/Orcamento";
import { cn } from "@/lib/utils";
import { regraDo } from "../../../shared/dominio/regras";
import { useApp } from "./Aplicacao";

// Financeiro (ADR-006): contas a receber e a pagar, com vencimento, baixa e cancelamento. Venda a
// prazo e compra geram a conta sozinhas e só são canceladas pela origem; as manuais, aqui.

const TODAS = "__todas__";
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
  // Regras do financeiro (ADR-015): categorias (filtro, coluna e totais) e orçamento do mês.
  const categorias = regraDo(app.config, "categorias_financeiras");
  const [categoria, setCategoria] = useState(TODAS);
  const filtro: FiltroFinanceiro = {
    ...(tipo !== "todos" ? { tipo } : {}),
    ...(situacao !== "todas" ? { status: situacao } : {}),
    ...(de ? { de } : {}),
    ...(ate ? { ate } : {}),
    ...(categorias && categoria !== TODAS ? { categoria } : {}),
  };
  const q = useQuery({
    queryKey: ["app", app.id, "financeiro", filtro],
    queryFn: () => listarLancamentos(app.id, filtro),
    // Multa e juros mudam a cada dia: o valor de hoje se atualiza sozinho.
    refetchInterval: 5 * 60_000,
  });
  // Aberto pela aba Rascunhos: a conta volta como a pessoa deixou.
  const retomado = useRascunhoDaBusca<DadosConta>(app.id, "conta");
  const [rascunho, setRascunho] = useState(retomado);
  const [nova, setNova] = useState(retomado !== null);
  const [cancelando, setCancelando] = useState<LancamentoDto | null>(null);

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ["app", app.id, "financeiro"] });
    void qc.invalidateQueries({ queryKey: ["painel", app.id] });
  };
  const baixar = useMutation({
    mutationFn: (l: LancamentoDto) =>
      // Sempre o valor que a tela mostrou: se a conta venceu desde então (virou o dia), o
      // servidor recusa em vez de cobrar multa que a pessoa não viu.
      acaoLancamento(
        app.id,
        l.id,
        "baixar",
        undefined,
        l.encargosHoje?.totalCentavos ?? l.valorCentavos,
      ),
    onSuccess: (l) => {
      toast.success(l.tipo === "receber" ? "Recebimento registrado." : "Pagamento registrado.");
      atualizar();
    },
    onError: (e) => {
      toast.error(e.message);
      // Valor mudou (virou o dia): recarrega para mostrar o novo.
      atualizar();
    },
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
      {(q.data?.porCategoria?.length || q.data?.orcamento?.length) && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2 lg:[&>*:only-child]:col-span-2">
          {q.data.porCategoria && q.data.porCategoria.length > 0 && (
            <section
              aria-labelledby="titulo-por-categoria"
              className="rounded-xl border bg-card p-5 shadow-card"
            >
              <h2 id="titulo-por-categoria" className="mb-3 font-semibold">
                Por categoria neste mês
              </h2>
              <ul className="divide-y text-sm">
                {q.data.porCategoria.map((c) => (
                  <li
                    key={`${c.tipo}-${c.categoria}`}
                    className="flex justify-between gap-3 py-1.5"
                  >
                    <span>{c.categoria}</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        c.tipo === "receber" ? "text-success" : "text-destructive",
                      )}
                    >
                      {c.tipo === "pagar" ? "−" : "+"} {formatarCentavos(c.totalCentavos)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {q.data.orcamento && q.data.orcamento.length > 0 && (
            <section
              aria-labelledby="titulo-orcamento"
              className="rounded-xl border bg-card p-5 shadow-card"
            >
              <h2 id="titulo-orcamento" className="mb-3 font-semibold">
                Orçamento do mês
              </h2>
              <OrcamentoDoMes itens={q.data.orcamento} />
            </section>
          )}
        </div>
      )}
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
        {categorias && (
          <div className="w-48 space-y-1.5">
            <Label htmlFor="fin-categoria">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="fin-categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas</SelectItem>
                {[
                  ...new Set([
                    ...categorias.despesas,
                    ...categorias.receitas,
                    ...(q.data?.categoriasUsadas ?? []),
                  ]),
                ].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
            ...(categorias ? ["Categoria"] : []),
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
              {categorias && (
                <td className="px-4 py-2 text-muted-foreground">{l.categoria ?? "—"}</td>
              )}
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
                {l.encargosHoje && (
                  <span className="block text-xs font-normal text-warning">
                    Hoje: {formatarCentavos(l.encargosHoje.totalCentavos)} com multa e juros (
                    {l.encargosHoje.dias} {l.encargosHoje.dias === 1 ? "dia" : "dias"})
                  </span>
                )}
                {l.valorPagoCentavos !== null && l.valorPagoCentavos !== l.valorCentavos && (
                  <span className="block text-xs font-normal">
                    Recebido: {formatarCentavos(l.valorPagoCentavos)}
                  </span>
                )}
              </td>
              <td className="px-4 py-2">
                <SituacaoConta lancamento={l} />
              </td>
              <td className="px-4 py-2 text-right">
                {l.status === "pendente" && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" disabled={baixar.isPending} onClick={() => baixar.mutate(l)}>
                      {l.tipo === "receber"
                        ? l.encargosHoje
                          ? `Receber ${formatarCentavos(l.encargosHoje.totalCentavos)}`
                          : "Receber"
                        : "Pagar"}
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
      {nova && (
        <NovaContaDialog
          rascunho={rascunho}
          onFechar={() => {
            setNova(false);
            setRascunho(null);
          }}
          onCriada={atualizar}
        />
      )}
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

interface DadosConta {
  tipo: TipoLancamento;
  descricao: string;
  valor: string;
  vencimento: string;
  contraparte: string;
  categoria?: string;
}

function NovaContaDialog({
  rascunho,
  onFechar,
  onCriada,
}: {
  rascunho: Rascunho<DadosConta> | null;
  onFechar: () => void;
  onCriada: () => void;
}) {
  const app = useApp();
  const temFornecedores = app.config.modulos.includes("fornecedores");
  // Sem o cadastro (ex.: Controle financeiro, ADR-015), a conta fica sem cliente ou fornecedor.
  const temClientes = app.config.modulos.includes("clientes");
  const r = rascunho?.dados;
  const [tipo, setTipo] = useState<TipoLancamento>(r?.tipo ?? "pagar");
  const [descricao, setDescricao] = useState(r?.descricao ?? "");
  const [valor, setValor] = useState(r?.valor ?? "");
  const [vencimento, setVencimento] = useState(r?.vencimento ?? "");
  const [contraparte, setContraparte] = useState(r?.contraparte ?? NENHUM);
  const temContraparte = tipo === "receber" ? temClientes : temFornecedores;
  // Com a regra de categorias, toda conta escolhe uma do seu tipo (ADR-015).
  const regraCategorias = regraDo(app.config, "categorias_financeiras");
  const opcoesCategoria = regraCategorias
    ? tipo === "pagar"
      ? regraCategorias.despesas
      : regraCategorias.receitas
    : [];
  const [categoria, setCategoria] = useState(r?.categoria ?? "");
  const chave = useChavePorConteudo();
  const guardado = useRascunho<DadosConta>({
    sistema: app.id,
    tipo: "conta",
    ativo: true,
    inicial: rascunho,
    dados: { tipo, descricao, valor, vencimento, contraparte, categoria },
    vazio:
      !descricao.trim() && !valor.trim() && !vencimento && contraparte === NENHUM && !categoria,
    titulo: descricao.trim() || "Conta sem descrição",
    resumo: `${tipo === "pagar" ? "A pagar" : "A receber"}${valor.trim() ? ` · R$ ${valor.trim()}` : ""}`,
  });
  const pessoas = useQuery({
    queryKey: ["app", app.id, tipo === "receber" ? "clientes" : "fornecedores"],
    queryFn: () => listarPessoas(app.id, tipo === "receber" ? "clientes" : "fornecedores"),
    enabled: temContraparte,
  });

  const m = useMutation({
    mutationFn: () => {
      const centavos = reaisParaCentavos(valor);
      if (centavos === null || centavos <= 0) throw new Error("Informe o valor.");
      if (!vencimento) throw new Error("Informe o vencimento.");
      if (regraCategorias && !opcoesCategoria.includes(categoria)) {
        throw new Error("Escolha a categoria.");
      }
      const dados: NovoLancamento = {
        ...(regraCategorias ? { categoria } : {}),
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
      guardado.descartar();
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
                  setCategoria("");
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
              <CampoDinheiro
                id="conta-valor"
                required
                placeholder="0,00"
                valor={valor}
                onValor={setValor}
              />
            </div>
          </div>
          {regraCategorias && (
            <div className="space-y-1.5">
              <Label htmlFor="conta-categoria">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger id="conta-categoria">
                  <SelectValue placeholder="Escolha a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesCategoria.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
            {temContraparte && (
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
          <AvisoRascunho salvoEm={guardado.salvoEm} />
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
