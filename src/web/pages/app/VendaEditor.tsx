import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CalendarPlus, Clock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  AtendimentoDto,
  CamposInformativos,
  FaltaDto,
  ProdutoDto,
  VendaDto,
} from "../../../shared/api";
import { formatarDataHora } from "../../../shared/dominio/agenda";
import { calcularTotais, formatarCentavos, unidadesDoItem } from "../../../shared/dominio/precos";
import {
  cancelarVenda,
  concluirVenda,
  criarVenda,
  descartarVenda,
  listarPessoas,
  listarProdutos,
  obterVenda,
  salvarItens,
  type ItemPedido,
} from "@/api/operacao";
import {
  CamposForm,
  codigoDoErro,
  dadosDoErro,
  ErroApi,
  Tabela,
  useChavePorConteudo,
} from "@/components/app/Comum";
import { ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Link, useNavigate } from "@/lib/rotas";
import { useApp } from "./Aplicacao";
import { SituacaoVenda } from "./Vendas";
import type { PaymentMethod } from "../../../shared/contract/catalog";
import { ROTULO_PAGAMENTO, rotuloCampo } from "@/lib/nexus";

// Editor da venda (seções 10 a 12). Salvar o rascunho reserva o estoque (RES-01), tudo ou nada
// (RES-02), e reinicia o prazo (RES-03). A prévia do total usa as mesmas regras do backend,
// mas o valor que vale é o devolvido pela API depois de salvar.

interface Linha {
  produto: string;
  caixas: string;
  unidades: string;
}

const linhaVazia = (): Linha => ({ produto: "", caixas: "0", unidades: "0" });

function paraPedido(linhas: Linha[]): ItemPedido[] {
  return linhas
    .filter((l) => l.produto !== "")
    .map((l) => ({
      produto: l.produto,
      caixas: Number(l.caixas || 0),
      unidades: Number(l.unidades || 0),
    }));
}

function deVenda(v: VendaDto): Linha[] {
  return v.itens.map((i) => ({
    produto: i.produto,
    caixas: String(i.caixas),
    unidades: String(i.unidadesSoltas),
  }));
}

export function VendaEditor() {
  const app = useApp();
  const { venda: vendaId = "nova" } = useParams();
  const nova = vendaId === "nova";
  const q = useQuery({
    queryKey: ["app", app.id, "venda", vendaId],
    queryFn: () => obterVenda(app.id, vendaId),
    enabled: !nova,
  });

  const voltar = (
    <Link
      to="/sistemas/$id/app/vendas"
      params={{ id: app.id }}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> Vendas
    </Link>
  );

  if (!nova && q.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!nova && q.isError) {
    return (
      <>
        {voltar}
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );
  }
  const dados = nova ? null : (q.data ?? null);
  return (
    <>
      {voltar}
      {dados && dados.venda.status !== "draft" ? (
        <VendaFechada venda={dados.venda} servicos={dados.servicos} />
      ) : (
        <Rascunho
          key={dados?.venda.id ?? "nova"}
          venda={dados?.venda ?? null}
          servicos={dados?.servicos ?? []}
        />
      )}
    </>
  );
}

function useInvalidarVenda() {
  const app = useApp();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["app", app.id, "vendas"] });
    void qc.invalidateQueries({ queryKey: ["app", app.id, "venda"] });
    void qc.invalidateQueries({ queryKey: ["app", app.id, "produtos"] });
    void qc.invalidateQueries({ queryKey: ["app", app.id, "movimentos"] });
  };
}

function Rascunho({ venda, servicos }: { venda: VendaDto | null; servicos: AtendimentoDto[] }) {
  const app = useApp();
  const navigate = useNavigate();
  const invalidar = useInvalidarVenda();
  const chave = useChavePorConteudo();
  const clientes = useQuery({
    queryKey: ["app", app.id, "clientes"],
    queryFn: () => listarPessoas(app.id, "clientes"),
  });
  const produtos = useQuery({
    queryKey: ["app", app.id, "produtos"],
    queryFn: () => listarProdutos(app.id),
  });
  const [cliente, setCliente] = useState(venda?.cliente ?? "");
  // Módulo de pagamentos (ADR-006): a forma é escolhida na conclusão, entre as aceitas.
  const formasAceitas =
    (app.config.modulos.includes("pagamentos") &&
      app.config.regras.find(
        (r): r is Extract<typeof r, { tipo: "formas_pagamento" }> => r.tipo === "formas_pagamento",
      )?.formas) ||
    [];
  const [forma, setForma] = useState<PaymentMethod | "">("");
  const [linhas, setLinhas] = useState<Linha[]>(venda ? deVenda(venda) : [linhaVazia()]);
  // Revisão de onde partem as edições locais. Se a venda mudar em outra tela (revisão nova vinda
  // do servidor), nada é salvo nem concluído até o usuário carregar a versão atual.
  const [base, setBase] = useState<VendaDto | null>(venda);
  const desatualizada = venda !== null && base !== null && venda.revisao !== base.revisao;
  const [campos, setCampos] = useState<CamposInformativos>(venda?.campos ?? {});
  const [faltas, setFaltas] = useState<FaltaDto[] | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const pedido = paraPedido(linhas);
  const alterado = !base || JSON.stringify(pedido) !== JSON.stringify(paraPedido(deVenda(base)));
  // Expiração mostrada pelo relógio local só como aviso; quem decide é o backend (RES-05).
  const vencida = venda !== null && (venda.expirada || venda.expiraEm <= agora);

  // Recalculada a cada render (o React Compiler memoiza).
  const previa = (() => {
    const porId = new Map((produtos.data ?? []).map((p) => [p.id, p]));
    const salvos = new Map((base?.itens ?? []).map((i) => [i.produto, i]));
    const itens = [];
    for (const item of pedido) {
      const p = porId.get(item.produto);
      if (!p) continue;
      const salvo = salvos.get(item.produto);
      const fator = salvo ? salvo.unidadesPorCaixa : p.unidadesPorCaixa;
      let unidades: number;
      try {
        unidades = unidadesDoItem(item.caixas, item.unidades, fator);
      } catch {
        continue;
      }
      // Produto que já estava no rascunho mantém o preço de quando entrou.
      itens.push({
        unidades,
        varejoCentavos: salvo ? salvo.varejoCentavos : p.varejoCentavos,
        atacadoCentavos: salvo ? salvo.atacadoCentavos : p.atacadoCentavos,
      });
    }
    const limite = venda
      ? venda.limiteAtacadoCentavos
      : (app.config.regras.find((r) => r.tipo === "limite_atacado")?.valor_centavos ?? null);
    try {
      return calcularTotais(itens, limite);
    } catch {
      return null;
    }
  })();

  const salvar = useMutation({
    mutationFn: () => {
      setFaltas(null);
      if (venda) {
        const dados = { revisao: (base ?? venda).revisao, itens: pedido };
        return salvarItens(app.id, venda.id, dados, chave({ venda: venda.id, ...dados }));
      }
      const dados = { cliente, itens: pedido, campos };
      return criarVenda(app.id, dados, chave(dados));
    },
    onSuccess: (v) => {
      setBase(v);
      setLinhas(deVenda(v));
      invalidar();
      toast.success(`Rascunho salvo. Estoque reservado até ${formatarDataHora(v.expiraEm)}.`);
      if (!venda)
        navigate({
          to: "/sistemas/$id/app/vendas/$venda",
          params: { id: app.id, venda: v.id },
          replace: true,
        });
    },
    onError: (e) => setFaltas(dadosDoErro<FaltaDto[]>(e, "faltas") ?? null),
  });
  const concluir = useMutation({
    mutationFn: () =>
      concluirVenda(app.id, venda!.id, (base ?? venda!).revisao, forma || undefined),
    onSuccess: () => {
      invalidar();
      toast.success("Venda concluída. O estoque foi baixado.");
    },
  });
  const descartar = useMutation({
    mutationFn: () => descartarVenda(app.id, venda!.id),
    onSuccess: () => {
      invalidar();
      toast.success("Rascunho descartado. A reserva foi liberada.");
    },
  });

  const mudarLinha = (i: number, campo: keyof Linha, valor: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  const ativos = (produtos.data ?? []).filter(
    (p) => p.status === "active" || pedido.some((x) => x.produto === p.id),
  );
  const produtoDe = (id: string): ProdutoDto | undefined => produtos.data?.find((p) => p.id === id);
  // O disponível da API já desconta a reserva desta venda; para ela, essa reserva volta a contar.
  const disponivelParaEsta = (p: ProdutoDto) =>
    p.disponivel +
    (venda && !vencida ? (venda.itens.find((i) => i.produto === p.id)?.unidades ?? 0) : 0);

  return (
    <>
      <PageHeader
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {venda ? `Venda de ${venda.nomeCliente}` : "Nova venda"}
            {venda && <SituacaoVenda venda={{ status: "draft", expirada: vencida }} />}
          </span>
        }
        descricao={
          venda ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden />
              {vencida
                ? "A reserva venceu: salve de novo para reservar o estoque e poder concluir."
                : `Estoque reservado até ${formatarDataHora(venda.expiraEm)}.`}
            </span>
          ) : (
            "Ao salvar, os itens ficam reservados pelo prazo configurado."
          )
        }
      />

      {desatualizada && venda && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm"
        >
          <AlertTriangle className="size-4 text-warning" aria-hidden />
          <span className="flex-1">
            Esta venda foi alterada em outra tela. Carregue a versão atual antes de salvar ou
            concluir; suas alterações locais serão descartadas.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setBase(venda);
              setLinhas(deVenda(venda));
            }}
          >
            Carregar versão atual
          </Button>
        </div>
      )}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        {!venda && (
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="venda-cliente">Cliente</Label>
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger id="venda-cliente">
                <SelectValue
                  placeholder={clientes.isPending ? "Carregando…" : "Escolha o cliente"}
                />
              </SelectTrigger>
              <SelectContent>
                {(clientes.data ?? [])
                  .filter((c) => c.status === "active")
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">Itens</legend>
          {linhas.map((l, i) => {
            const p = produtoDe(l.produto);
            // Item já no rascunho usa o fator dele, mesmo nulo; produto novo, o do cadastro.
            const salvo = base?.itens.find((x) => x.produto === l.produto);
            const fator = salvo ? salvo.unidadesPorCaixa : (p?.unidadesPorCaixa ?? null);
            return (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
                <div className="min-w-48 flex-1 space-y-1.5">
                  <Label htmlFor={`item-${i}-produto`}>
                    {rotuloCampo(app.config, "produtos.item")}
                  </Label>
                  <Select value={l.produto} onValueChange={(v) => mudarLinha(i, "produto", v)}>
                    <SelectTrigger id={`item-${i}-produto`}>
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {ativos.map((x) => (
                        <SelectItem
                          key={x.id}
                          value={x.id}
                          disabled={linhas.some((o, j) => j !== i && o.produto === x.id)}
                        >
                          {x.nome} · disp. {disponivelParaEsta(x)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {fator !== null && (
                  <div className="w-28 space-y-1.5">
                    <Label htmlFor={`item-${i}-caixas`}>Caixas de {fator}</Label>
                    <Input
                      id={`item-${i}-caixas`}
                      type="number"
                      min={0}
                      value={l.caixas}
                      onChange={(e) => mudarLinha(i, "caixas", e.target.value)}
                    />
                  </div>
                )}
                <div className="w-28 space-y-1.5">
                  <Label htmlFor={`item-${i}-unidades`}>Unidades</Label>
                  <Input
                    id={`item-${i}-unidades`}
                    type="number"
                    min={0}
                    value={l.unidades}
                    onChange={(e) => mudarLinha(i, "unidades", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remover item"
                  disabled={linhas.length === 1}
                  onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}
          >
            <Plus aria-hidden /> Adicionar item
          </Button>
        </fieldset>

        {!venda && (
          <CamposForm
            config={app.config}
            entidade="vendas"
            valores={campos}
            onChange={setCampos}
            prefixo="venda"
          />
        )}

        {previa && (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm" aria-live="polite">
            <p>
              Subtotal a varejo:{" "}
              <span className="tabular-nums">
                {formatarCentavos(previa.subtotalVarejoCentavos)}
              </span>
            </p>
            <p className="text-base font-semibold">
              Total{alterado ? " (prévia)" : ""}:{" "}
              <span className="tabular-nums">{formatarCentavos(previa.totalCentavos)}</span>{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {previa.faixa === "atacado" ? "preço de atacado" : "preço de varejo"}
              </span>
            </p>
          </div>
        )}

        {faltas && faltas.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-danger-soft p-4 text-sm"
          >
            <p className="mb-2 flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4 text-destructive" aria-hidden />
              Estoque insuficiente. Nada foi reservado nem alterado.
            </p>
            <ul className="list-disc pl-5">
              {faltas.map((f) => (
                <li key={f.produto}>
                  {f.nomeProduto}: pedido {f.pedido}, disponível {f.disponivel}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!faltas && <ErroApi erro={salvar.error} />}
        <ErroApi erro={concluir.error} />
        <ErroApi erro={descartar.error} />

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={
              salvar.isPending ||
              desatualizada ||
              pedido.length === 0 ||
              (!venda && cliente === "") ||
              (!!venda && !alterado && !vencida)
            }
          >
            {salvar.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {venda
              ? vencida && !alterado
                ? "Reservar de novo"
                : "Salvar e reservar"
              : "Salvar e reservar"}
          </Button>
          {venda && (
            <>
              {formasAceitas.length > 0 && (
                <Select value={forma} onValueChange={(v) => setForma(v as PaymentMethod)}>
                  <SelectTrigger className="w-48" aria-label="Forma de pagamento">
                    <SelectValue placeholder="Forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {formasAceitas.map((f) => (
                      <SelectItem key={f} value={f}>
                        {ROTULO_PAGAMENTO[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={
                  concluir.isPending ||
                  alterado ||
                  vencida ||
                  desatualizada ||
                  (formasAceitas.length > 0 && !forma)
                }
                onClick={() => concluir.mutate()}
              >
                {concluir.isPending && <Loader2 className="animate-spin" aria-hidden />}Concluir
                venda
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={descartar.isPending}
                onClick={() => descartar.mutate()}
              >
                Descartar rascunho
              </Button>
            </>
          )}
        </div>
        {venda && alterado && (
          <p className="text-sm text-muted-foreground">Salve as alterações antes de concluir.</p>
        )}
        {venda && !alterado && formasAceitas.length > 0 && !forma && (
          <p className="text-sm text-muted-foreground">
            Escolha a forma de pagamento para concluir a venda.
          </p>
        )}
      </form>
      {venda && <ServicosVinculados venda={venda} servicos={servicos} />}
    </>
  );
}

function Itens({ venda }: { venda: VendaDto }) {
  const app = useApp();
  return (
    <Tabela
      cabecalho={[
        rotuloCampo(app.config, "produtos.item"),
        "Quantidade",
        "Unidades",
        "Preço unit.",
        "Total",
      ]}
    >
      {venda.itens.map((i) => (
        <tr key={i.produto}>
          <td className="px-4 py-2 font-medium">{i.nomeProduto}</td>
          <td className="px-4 py-2 tabular-nums">
            {i.caixas > 0 ? `${i.caixas} cx de ${i.unidadesPorCaixa} + ` : ""}
            {i.unidadesSoltas} un.
          </td>
          <td className="px-4 py-2 tabular-nums">{i.unidades}</td>
          <td className="px-4 py-2 tabular-nums">
            {formatarCentavos(
              venda.faixa === "atacado" && i.atacadoCentavos !== null
                ? i.atacadoCentavos
                : i.varejoCentavos,
            )}
          </td>
          <td className="px-4 py-2 font-medium tabular-nums">
            {formatarCentavos(i.totalCentavos)}
          </td>
        </tr>
      ))}
    </Tabela>
  );
}

/** Concluída, cancelada ou descartada: itens não mudam (PRE-07). */
function VendaFechada({ venda, servicos }: { venda: VendaDto; servicos: AtendimentoDto[] }) {
  const [cancelando, setCancelando] = useState(false);
  return (
    <>
      <PageHeader
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            Venda de {venda.nomeCliente}
            <SituacaoVenda venda={venda} />
          </span>
        }
        descricao={
          venda.status === "completed"
            ? `Concluída em ${formatarDataHora(venda.concluidaEm ?? venda.criadoEm)}${
                venda.formaPagamento ? ` · ${ROTULO_PAGAMENTO[venda.formaPagamento]}` : ""
              }.`
            : venda.status === "cancelled"
              ? `Cancelada em ${formatarDataHora(venda.canceladaEm ?? venda.criadoEm)} · motivo: ${venda.motivoCancelamento ?? "—"}`
              : "Rascunho descartado; a reserva foi liberada."
        }
        acoes={
          venda.status === "completed" ? (
            <Button variant="outline" onClick={() => setCancelando(true)}>
              Cancelar venda
            </Button>
          ) : undefined
        }
      />
      <Itens venda={venda} />
      <p className="mt-4 text-right text-base font-semibold">
        Total: <span className="tabular-nums">{formatarCentavos(venda.totalCentavos)}</span>{" "}
        <span className="text-sm font-normal text-muted-foreground">
          · {venda.faixa === "atacado" ? "atacado" : "varejo"}
        </span>
      </p>
      <ServicosVinculados venda={venda} servicos={servicos} />
      {cancelando && <CancelarDialog venda={venda} onFechar={() => setCancelando(false)} />}
    </>
  );
}

function ServicosVinculados({ venda, servicos }: { venda: VendaDto; servicos: AtendimentoDto[] }) {
  const app = useApp();
  if (!app.config.modulos.includes("agenda")) return null;
  const podeAgendar = venda.status === "draft" || venda.status === "completed";
  return (
    <section aria-labelledby="titulo-servicos" className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="titulo-servicos" className="text-lg font-semibold">
          Serviços vinculados
        </h2>
        {podeAgendar && (
          <Button asChild variant="outline" size="sm">
            <Link
              to="/sistemas/$id/app/agenda"
              params={{ id: app.id }}
              search={{ venda: venda.id, cliente: venda.cliente }}
            >
              <CalendarPlus aria-hidden /> Agendar serviço
            </Link>
          </Button>
        )}
      </div>
      {servicos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum serviço vinculado a esta venda.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {servicos.map((s) => (
            <li key={s.id}>
              {rotuloTipo(app.config, s.tipo)} · {formatarDataHora(s.inicio)} · {s.nomeProfissional}{" "}
              · {ROTULO_STATUS[s.status]}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const ROTULO_STATUS: Record<AtendimentoDto["status"], string> = {
  scheduled: "Agendado",
  in_progress: "Em atendimento",
  done: "Concluído",
  cancelled: "Cancelado",
};

export function rotuloTipo(
  config: { tipos_atendimento: { id: string; rotulo: string }[] },
  tipo: string,
) {
  return config.tipos_atendimento.find((t) => t.id === tipo)?.rotulo ?? tipo;
}

/** CAN-01/CAN-04/CAN-05: motivo obrigatório; serviços não iniciados pedem confirmação. */
function CancelarDialog({ venda, onFechar }: { venda: VendaDto; onFechar: () => void }) {
  const app = useApp();
  const invalidar = useInvalidarVenda();
  const [motivo, setMotivo] = useState("");
  const [comServicos, setComServicos] = useState(false);
  const m = useMutation({
    mutationFn: () => cancelarVenda(app.id, venda.id, motivo.trim(), comServicos),
    onSuccess: (r) => {
      invalidar();
      toast.success(
        r.jaCancelada
          ? "A venda já estava cancelada."
          : "Venda cancelada. O estoque foi devolvido.",
      );
      onFechar();
    },
  });
  const pendentes = dadosDoErro<AtendimentoDto[]>(m.error, "servicos");
  const codigo = codigoDoErro(m.error);

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Cancelar venda</DialogTitle>
            <DialogDescription>
              O estoque dos itens é devolvido uma única vez. Não há cancelamento parcial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancelar-motivo">Motivo</Label>
            <Input
              id="cancelar-motivo"
              value={motivo}
              minLength={3}
              maxLength={300}
              required
              autoFocus
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          {pendentes && pendentes.length > 0 && (
            <div role="alert" className="rounded-lg border bg-muted/50 p-3 text-sm">
              <p className="mb-1 font-medium">
                {codigo === "servico_iniciado"
                  ? "Um serviço vinculado já começou: a venda não pode ser cancelada."
                  : "Serviços vinculados ainda não iniciados:"}
              </p>
              <ul className="mb-2 list-disc pl-5">
                {pendentes.map((s) => (
                  <li key={s.id}>
                    {rotuloTipo(app.config, s.tipo)} · {formatarDataHora(s.inicio)} ·{" "}
                    {ROTULO_STATUS[s.status]}
                  </li>
                ))}
              </ul>
              {codigo === "confirmar_servicos" && (
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={comServicos}
                    onCheckedChange={(v) => setComServicos(v === true)}
                  />
                  Cancelar a venda e esses serviços juntos
                </label>
              )}
            </div>
          )}
          {!pendentes && <ErroApi erro={m.error} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                m.isPending ||
                motivo.trim().length < 3 ||
                codigo === "servico_iniciado" ||
                (codigo === "confirmar_servicos" && !comServicos)
              }
            >
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Cancelar venda
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
