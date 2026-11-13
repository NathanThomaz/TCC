import { useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Loader2,
  Power,
  RotateCw,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import type { CriacaoApiBody, IssueDto } from "../../shared/api";
import {
  confirmarResumo,
  corrigirConfiguracao,
  estado as estadoDaResposta,
  gerarConfiguracao,
  obterCriacao,
} from "@/api/criacao";
import { aprovarVersao, ativarSistema, obterSistema } from "@/api/sistemas";
import { codigoDoErro, ErroApi, useChavePorConteudo } from "@/components/app/Comum";
import { EstadoPedido } from "@/components/criacao/Pedido";
import { ErrorState, PageHeader } from "@/components/nexus/Estados";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ORDEM_ASSUNTOS, pendenciasDaEntrevista, ROTULO_ASSUNTO } from "@/lib/criacao";
import { NATIVE_FIELDS } from "../../shared/contract/catalog";
import { ModulosProntos } from "@/components/nexus/ModulosProntos";
import { entidadesDosModulos, ROTULO_ENTIDADE, ROTULO_MODULO, textoDaRegra } from "@/lib/nexus";

const TIPO_CAMPO = { texto: "texto", numero: "número", data: "data", lista: "lista" } as const;
import { Link, useNavigate } from "@/lib/rotas";

// Revisão da criação guiada (ADR-004): o dono confere em linguagem de negócio o que fica pronto e
// o que vai para o desenvolvedor, confirma UMA vez e o Nexus monta a configuração pelo mesmo
// validador do formulário (T33). Ativar aprova exatamente a versão mostrada.

export function CriarRevisao() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["criacao", id], queryFn: () => obterCriacao(id) });
  const detalhe = useQuery({ queryKey: ["sistema", id], queryFn: () => obterSistema(id) });
  // O aceite vale para a revisão do estado que o dono conferiu: se outra tela mudar algo, ele
  // precisa conferir e marcar de novo.
  const [conferidoEm, setConferidoEm] = useState<number | null>(null);
  const [estrutural, setEstrutural] = useState(false);
  const chave = useChavePorConteudo();

  const tratar = (r: CriacaoApiBody) => {
    if (r.versao === null) {
      setEstrutural(true);
      return;
    }
    setEstrutural(false);
    qc.setQueryData(["criacao", id], estadoDaResposta(r));
  };
  const recarregar = (erro: unknown) => {
    if (codigoDoErro(erro) === "estado_alterado") {
      void qc.invalidateQueries({ queryKey: ["criacao", id] });
    }
  };
  const criar = useMutation({
    mutationFn: async () => {
      // Confirma exatamente a revisão que o dono conferiu: se algo mudou, o backend recusa.
      const vista = conferidoEm!;
      let e = q.data!;
      if (e.requisitos.some((r) => r.status === "pendente")) {
        e = await confirmarResumo(id, vista, chave({ confirmar: true, revisao: vista }));
        qc.setQueryData(["criacao", id], e);
      }
      return gerarConfiguracao(id, e.revisao, chave({ gerar: true, revisao: e.revisao }));
    },
    onSuccess: tratar,
    onError: recarregar,
  });
  const corrigir = useMutation({
    mutationFn: (versao: string) =>
      corrigirConfiguracao(
        id,
        q.data!.revisao,
        versao,
        chave({ corrigir: versao, revisao: q.data!.revisao }),
      ),
    onSuccess: tratar,
    onError: recarregar,
  });
  const ativar = useMutation({
    mutationFn: async () => {
      const v = q.data!.versao!;
      if (v.status !== "approved") await aprovarVersao(id, v.id, v.hash);
      return ativarSistema(id, v.id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sistema", id] });
      void qc.invalidateQueries({ queryKey: ["sistemas"] });
      toast.success("Sistema ativado.");
      navigate({ to: "/sistemas/$id/app", params: { id } });
    },
  });

  const voltar = (
    <Link
      to="/sistemas/$id/criar"
      params={{ id }}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> Voltar à conversa
    </Link>
  );
  if (q.isPending) return <Skeleton className="h-96 w-full rounded-lg" />;
  if (q.isError) {
    return (
      <>
        {voltar}
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );
  }

  const e = q.data;
  const pend = pendenciasDaEntrevista(e);
  const v = e.versao;
  const semPendentes = !e.requisitos.some((r) => r.status === "pendente");
  // Resultado vale só para a versão gerada da conversa sobre o resumo já confirmado.
  const resultado = v && v.origem === "chat" && semPendentes ? v : null;
  const pronto = resultado && (resultado.status === "valid" || resultado.status === "approved");
  const invalida = resultado?.status === "invalid";
  const bloqueantes = e.issues.filter((i: IssueDto) => i.severity === "bloqueante");
  const ativo = detalhe.data?.sistema.status === "active";
  const grupos = [
    ...ORDEM_ASSUNTOS.map((a) => ({
      id: a,
      rotulo: ROTULO_ASSUNTO[a],
      itens: e.requisitos.filter((r) => r.assunto === a),
    })),
    { id: "outros", rotulo: "Outros", itens: e.requisitos.filter((r) => !r.assunto) },
  ].filter((g) => g.itens.length > 0);
  const ocupado = criar.isPending || corrigir.isPending;
  const conferido = conferidoEm !== null && conferidoEm === e.revisao;

  return (
    <>
      {voltar}
      <PageHeader
        titulo="Revise e crie seu sistema"
        descricao="Confira se está tudo como você quer. Você confirma uma vez e o Nexus monta o sistema."
      />
      {!pend.podeRevisar && !pronto && (
        <div role="note" className="mb-6 rounded-lg border bg-warning-soft p-4 text-sm">
          {pend.motivo || "Ainda falta responder ao assistente."}{" "}
          <Link
            to="/sistemas/$id/criar"
            params={{ id }}
            className="font-medium text-primary underline underline-offset-4"
          >
            Voltar à conversa
          </Link>
        </div>
      )}

      <section aria-labelledby="pronto-agora" className="mb-8">
        <h2 id="pronto-agora" className="mb-4 text-lg font-semibold">
          O que fica pronto agora
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {grupos.map((g) => (
            <article key={g.id} className="flex flex-col rounded-lg border bg-card p-4 shadow-card">
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <CircleCheck className="size-4 text-success" aria-hidden /> {g.rotulo}
              </h3>
              <ul className="flex-1 space-y-1 text-sm">
                {g.itens.map((r) => (
                  <li key={r.codigo}>{r.texto}</li>
                ))}
              </ul>
              {!ativo && (
                <Link
                  to="/sistemas/$id/criar"
                  params={{ id }}
                  className="mt-3 inline-flex items-center gap-1 self-start rounded text-sm text-primary underline-offset-4 hover:underline"
                >
                  Mudar na conversa <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="vai-dev" className="mb-8">
        <h2 id="vai-dev" className="mb-4 text-lg font-semibold">
          O que vai para o desenvolvedor
        </h2>
        {e.pedidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pedido. Tudo cabe nos módulos do Nexus.
          </p>
        ) : (
          <ul className="space-y-3">
            {e.pedidos.map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded-lg border border-info/30 bg-info-soft p-4 text-sm"
              >
                <Wrench className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {p.titulo} <EstadoPedido estado={p.estado} />
                  </p>
                  <p className="mt-1">
                    Não entra nesta criação. Você acompanha em{" "}
                    <Link
                      to="/sistemas/$id/pedidos"
                      params={{ id }}
                      className="text-primary underline underline-offset-4"
                    >
                      Pedidos ao desenvolvedor
                    </Link>
                    .
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {e.config && pronto && (
        <section aria-labelledby="como-ficou" className="mb-8">
          <h2 id="como-ficou" className="mb-1 text-lg font-semibold">
            Como o sistema foi montado
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Estes são os valores que entram em vigor ao ativar. Confira se batem com o que você
            disse; se algo estiver diferente, mude na conversa antes de ativar.
          </p>
          <dl className="divide-y rounded-lg border bg-card text-sm shadow-card">
            {[
              ["Módulos", e.config.modulos.map((m) => ROTULO_MODULO[m]).join(", ")],
              [
                "Regras",
                e.config.regras.map((r) => textoDaRegra(r, e.config!)).join(" · ") || "Nenhuma",
              ],
              // Um cadastro por linha: o que já vem pronto e os extras pedidos, sem duplicidade.
              ...entidadesDosModulos(e.config.modulos).map((ent) => {
                const extras = e
                  .config!.campos.filter((c) => c.entidade === ent)
                  .map((c) => {
                    const opcoes = c.tipo === "lista" && c.opcoes ? `: ${c.opcoes.join(", ")}` : "";
                    const obrigatorio = c.obrigatorio ? ", obrigatório" : "";
                    return `${c.rotulo} (${TIPO_CAMPO[c.tipo]}${opcoes}${obrigatorio})`;
                  });
                const prontos = NATIVE_FIELDS[ent].map((n) => n.label).join(", ");
                return [
                  `Cadastro de ${ROTULO_ENTIDADE[ent].toLowerCase()}`,
                  `${prontos}${extras.length ? ` + extras: ${extras.join(", ")}` : ""}`,
                ];
              }),
              ...(e.config.tipos_atendimento.length
                ? [
                    [
                      "Atendimentos",
                      e.config.tipos_atendimento
                        .map((t) => `${t.rotulo} (${t.duracao_minutos} min)`)
                        .join(", "),
                    ],
                  ]
                : []),
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium sm:col-span-2">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <ModulosProntos modulos={e.config.modulos} titulo="O que cada módulo já traz pronto" />
          </div>
        </section>
      )}

      {e.config && pronto && (
        <section aria-labelledby="previa" className="mb-8">
          <h2 id="previa" className="mb-4 text-lg font-semibold">
            Prévia da aparência
          </h2>
          {/* Exceção do padrão visual: as cores são as que o dono escolheu para o próprio sistema. */}
          <div className="overflow-hidden rounded-lg border">
            <div
              className="flex items-center gap-3 px-4 py-3 font-semibold text-white"
              style={{ backgroundColor: e.config.aparencia.cor_primaria }}
            >
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: e.config.aparencia.cor_destaque }}
                aria-hidden
              />
              {e.config.aparencia.titulo}
            </div>
            {e.config.aparencia.texto_boas_vindas && (
              <p className="bg-card p-4 text-sm text-muted-foreground">
                {e.config.aparencia.texto_boas_vindas}
              </p>
            )}
          </div>
        </section>
      )}

      <section
        aria-label="Criar o sistema"
        className="rounded-lg border bg-card p-4 shadow-card sm:p-6"
      >
        {pronto && resultado ? (
          <div className="rounded-lg border border-success/30 bg-success-soft p-4">
            <p className="flex items-center gap-2 font-semibold">
              <CircleCheck className="size-5 text-success" aria-hidden />
              {ativo ? "Seu sistema está ativo" : "Seu sistema está pronto para ativar"}
            </p>
            <p className="mt-1 text-sm">
              {ativo
                ? "Você e sua equipe já podem usar."
                : "Ao ativar, você e sua equipe já podem usar."}
            </p>
            {ativo ? (
              <Button asChild className="mt-4">
                <Link to="/sistemas/$id/app" params={{ id }}>
                  Abrir o sistema
                </Link>
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="mt-4" disabled={ativar.isPending}>
                    {ativar.isPending ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Power aria-hidden />
                    )}
                    Ativar sistema
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Ativar o sistema?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você aprova exatamente esta versão. Os dados começam vazios: clientes,
                      produtos e vendas são cadastrados depois.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => ativar.mutate()}>
                      Ativar sistema
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <ErroApi erro={ativar.error} />
            <details className="group mt-4 text-sm">
              <summary className="inline-flex cursor-pointer items-center gap-1 font-medium">
                Detalhes técnicos
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-2 text-muted-foreground">
                Versão {resultado.versao} · código de conferência{" "}
                <span className="font-mono tabular-nums">{resultado.hash.slice(0, 8)}</span>
              </p>
            </details>
          </div>
        ) : (
          <>
            {invalida && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-destructive/30 bg-danger-soft p-4 text-sm"
              >
                <p className="flex items-center gap-2 font-semibold">
                  <CircleAlert className="size-5 text-destructive" aria-hidden /> Falta resolver
                  antes de criar
                </p>
                <p className="mt-1">
                  O sistema montado não passou na conferência do Nexus.{" "}
                  {bloqueantes.length === 1
                    ? "Há 1 ponto a resolver."
                    : `Há ${bloqueantes.length} pontos a resolver.`}{" "}
                  Converse com o assistente sobre isso ou peça a ele para corrigir.
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">Detalhes técnicos</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {bloqueantes.map((i, n) => (
                      <li key={n}>{i.message}</li>
                    ))}
                  </ul>
                </details>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/sistemas/$id/criar" params={{ id }}>
                      Resolver na conversa
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ocupado || !e.iaDisponivel}
                    onClick={() => corrigir.mutate(resultado.id)}
                  >
                    {corrigir.isPending && <Loader2 className="animate-spin" aria-hidden />}
                    Pedir ao assistente para corrigir
                  </Button>
                </div>
              </div>
            )}
            {estrutural && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-destructive/30 bg-danger-soft p-4 text-sm"
              >
                O assistente não conseguiu montar a configuração desta vez. Nada foi gravado: tente
                de novo.
              </div>
            )}
            <div className="flex items-start gap-3">
              <Checkbox
                id="conferi"
                checked={conferido}
                disabled={!pend.podeRevisar || ativo}
                onCheckedChange={(c) => setConferidoEm(c === true ? e.revisao : null)}
              />
              <Label htmlFor="conferi" className="font-normal leading-snug">
                Conferi o resumo e é isso que eu quero
              </Label>
            </div>
            <Button
              className="mt-4"
              disabled={!conferido || !pend.podeRevisar || ocupado || !e.iaDisponivel || ativo}
              onClick={() => criar.mutate()}
            >
              {criar.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : invalida || estrutural ? (
                <RotateCw aria-hidden />
              ) : null}
              {criar.isPending
                ? "Montando e conferindo o seu sistema…"
                : invalida || estrutural
                  ? "Tentar criar de novo"
                  : "Criar meu sistema"}
            </Button>
            <ErroApi erro={criar.error ?? corrigir.error} />
          </>
        )}
      </section>
    </>
  );
}
