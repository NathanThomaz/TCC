import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  Check,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import type { CriacaoApiBody, RequisitoDto } from "../../shared/api";
import { TEMPLATE_LABELS } from "../../shared/contract/catalog";
import type { ConfigDraft } from "../../shared/contract/schema";
import { formatarCentavos } from "../../shared/dominio/precos";
import {
  acaoRequisito,
  adicionarRequisito,
  corrigirConfiguracao,
  enviarMensagem,
  gerarConfiguracao,
  obterCriacao,
  type EstadoCriacao,
} from "@/api/criacao";
import { aprovarVersao, ativarSistema, obterSistema } from "@/api/sistemas";
import { codigoDoErro, ErroApi, useChavePorConteudo } from "@/components/app/Comum";
import { ErrorState, PageHeader } from "@/components/nexus/Estados";
import { IssueList } from "@/components/nexus/IssueList";
import { StatusBadge } from "@/components/nexus/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ROTULO_MODULO } from "@/lib/nexus";
import { Link, useNavigate } from "@/lib/rotas";
import { cn } from "@/lib/utils";

/** Se o estado mudou em outra tela (revisão), recarrega para o usuário ver a versão atual. */
function useRecarregarSeAlterado(sistema: string) {
  const qc = useQueryClient();
  return (erro: unknown) => {
    if (codigoDoErro(erro) === "estado_alterado") {
      void qc.invalidateQueries({ queryKey: ["criacao", sistema] });
    }
  };
}

// Criação por conversa (seção 8). A IA conversa e propõe; o usuário confirma cada requisito,
// pede a geração, revisa a prévia, pede correção se houver erro e aprova a versão exata. Tudo
// fica salvo no servidor: recarregar a página não perde nada.

export function Criar() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["criacao", id], queryFn: () => obterCriacao(id) });
  const detalhe = useQuery({ queryKey: ["sistema", id], queryFn: () => obterSistema(id) });
  const atualizar = (estado: EstadoCriacao) => {
    qc.setQueryData(["criacao", id], estado);
    void qc.invalidateQueries({ queryKey: ["sistema", id] });
  };

  const voltar = (
    <Link
      to="/sistemas/$id"
      params={{ id }}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> Sistema
    </Link>
  );

  if (q.isPending) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (q.isError) {
    return (
      <>
        {voltar}
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );
  }
  const estado = q.data;
  const rascunho = detalhe.data?.sistema.status !== "active";

  return (
    <>
      {voltar}
      <PageHeader
        titulo={
          <span className="flex items-center gap-2">
            <Sparkles className="size-6 text-primary" aria-hidden /> Criar por conversa
          </span>
        }
        descricao="Conte como é o seu negócio. A IA faz perguntas e propõe requisitos; você confirma cada um e aprova a configuração antes de ativar."
        acoes={
          <Button asChild variant="outline">
            <Link to="/sistemas/$id/configurar" params={{ id }} search={{ passo: 1 }}>
              Usar o formulário
            </Link>
          </Button>
        }
      />
      {!estado.iaDisponivel && (
        <div role="note" className="mb-6 rounded-lg border bg-muted p-4 text-sm">
          A IA não está configurada neste ambiente. Você pode configurar o sistema pelo formulário.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <Conversa
          sistema={id}
          estado={estado}
          bloqueado={!estado.iaDisponivel || !rascunho}
          onEstado={atualizar}
        />
        <div className="space-y-6 lg:col-span-2">
          <Requisitos sistema={id} estado={estado} bloqueado={!rascunho} onEstado={atualizar} />
          <Configuracao
            sistema={id}
            estado={estado}
            bloqueado={!estado.iaDisponivel || !rascunho}
            onEstado={atualizar}
          />
        </div>
      </div>
    </>
  );
}

function Conversa({
  sistema,
  estado,
  bloqueado,
  onEstado,
}: {
  sistema: string;
  estado: EstadoCriacao;
  bloqueado: boolean;
  onEstado: (e: EstadoCriacao) => void;
}) {
  const [texto, setTexto] = useState("");
  const chave = useChavePorConteudo();
  const recarregar = useRecarregarSeAlterado(sistema);
  const fim = useRef<HTMLDivElement>(null);
  const m = useMutation({
    // Mesma chave enquanto o texto não mudar: reenviar depois de uma falha não duplica a rodada.
    mutationFn: (t: string) =>
      enviarMensagem(sistema, estado.revisao, t, chave({ t, revisao: estado.revisao })),
    onSuccess: (e, enviado) => {
      onEstado(e);
      // Só limpa se a caixa ainda tem o que foi enviado (o usuário pode ter começado outra).
      setTexto((atual) => (atual.trim() === enviado ? "" : atual));
    },
    onError: recarregar,
  });
  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: "nearest" });
  }, [estado.mensagens.length]);
  const enviar = () => {
    if (texto.trim() && !m.isPending) m.mutate(texto.trim());
  };

  return (
    <section
      aria-label="Conversa"
      className="flex min-h-[28rem] flex-col rounded-xl border bg-card shadow-card lg:col-span-3 lg:self-start"
    >
      <ol className="max-h-[65vh] flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {estado.mensagens.length === 0 && (
          <li className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            Exemplo: “Tenho uma distribuidora de bebidas. Vendo cerveja avulsa ou na caixa, chope em
            barril, e levo a chopeira na casa do cliente…”
          </li>
        )}
        {estado.mensagens.map((msg) => {
          const ia = msg.papel === "assistente";
          const Icone = ia ? Bot : User;
          return (
            <li key={msg.id} className={cn("flex gap-3", !ia && "flex-row-reverse")}>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  ia ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground",
                )}
              >
                <Icone className="size-4" aria-hidden />
                <span className="sr-only">{ia ? "Nexus" : "Você"}</span>
              </span>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2 text-sm",
                  ia ? "bg-muted" : "bg-primary/10",
                )}
              >
                <p className="whitespace-pre-wrap">{msg.texto}</p>
                {msg.foraDoCatalogo.length > 0 && (
                  <div className="mt-2 rounded-md border border-warning/40 bg-warning-soft p-2 text-xs">
                    <p className="font-medium">Fora do catálogo desta versão (fica registrado):</p>
                    <ul className="list-disc pl-4">
                      {msg.foraDoCatalogo.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {m.isPending && (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> O Nexus está pensando…
          </li>
        )}
        <div ref={fim} />
      </ol>
      <form
        className="space-y-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <Label htmlFor="mensagem" className="sr-only">
          Mensagem
        </Label>
        <Textarea
          id="mensagem"
          value={texto}
          maxLength={2000}
          rows={3}
          disabled={bloqueado}
          placeholder={bloqueado ? "Conversa indisponível." : "Escreva aqui (Ctrl+Enter envia)"}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              enviar();
            }
          }}
        />
        <ErroApi erro={m.error} />
        <div className="flex justify-end">
          <Button type="submit" disabled={bloqueado || m.isPending || texto.trim() === ""}>
            {m.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            Enviar
          </Button>
        </div>
      </form>
    </section>
  );
}

function Requisitos({
  sistema,
  estado,
  bloqueado,
  onEstado,
}: {
  sistema: string;
  estado: EstadoCriacao;
  bloqueado: boolean;
  onEstado: (e: EstadoCriacao) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [novo, setNovo] = useState("");
  const chave = useChavePorConteudo();
  const recarregar = useRecarregarSeAlterado(sistema);
  // Mesma chave para o mesmo ato sobre a mesma revisão: um retry não aplica duas vezes.
  const chaveAcao = useChavePorConteudo();
  const acao = useMutation({
    mutationFn: (a: {
      codigo: string;
      acao: "confirmar" | "editar" | "descartar";
      texto?: string;
      revisao: number;
    }) => acaoRequisito(sistema, a.codigo, a.acao, a.revisao, a.texto, chaveAcao(a)),
    onSuccess: (e) => {
      onEstado(e);
      setEditando(null);
    },
    onError: (e) => {
      toast.error(e.message);
      recarregar(e);
    },
  });
  const adicionar = useMutation({
    mutationFn: (t: string) =>
      adicionarRequisito(sistema, estado.revisao, t, chave({ t, revisao: estado.revisao })),
    onSuccess: (e) => {
      onEstado(e);
      setNovo("");
    },
    onError: recarregar,
  });
  const pendentes = estado.requisitos.filter((r) => r.status === "pendente").length;

  return (
    <section
      aria-labelledby="titulo-requisitos"
      className="rounded-xl border bg-card p-4 shadow-card"
    >
      <h2 id="titulo-requisitos" className="text-lg font-semibold">
        Requisitos
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {estado.requisitos.length === 0
          ? "Os requisitos que a IA entender aparecem aqui para você confirmar."
          : pendentes > 0
            ? `${pendentes} aguardando sua confirmação.`
            : "Todos confirmados."}
      </p>
      <ul className="space-y-2">
        {estado.requisitos.map((r) => (
          <ItemRequisito
            // Texto novo (a IA reescreveu) = componente novo: a edição nunca parte do texto antigo.
            key={`${r.codigo}:${r.texto}`}
            revisao={estado.revisao}
            requisito={r}
            editando={editando === r.codigo}
            bloqueado={bloqueado || acao.isPending}
            onEditar={() => setEditando(r.codigo)}
            onCancelar={() => setEditando(null)}
            onAcao={(a, revisao, texto) =>
              acao.mutate({ codigo: r.codigo, acao: a, revisao, ...(texto ? { texto } : {}) })
            }
          />
        ))}
      </ul>
      {!bloqueado && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (novo.trim().length >= 3) adicionar.mutate(novo.trim());
          }}
        >
          <Label htmlFor="novo-requisito" className="sr-only">
            Novo requisito
          </Label>
          <Input
            id="novo-requisito"
            value={novo}
            maxLength={400}
            placeholder="Acrescentar com suas palavras"
            onChange={(e) => setNovo(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={adicionar.isPending || novo.trim().length < 3}
          >
            <Plus aria-hidden /> Acrescentar
          </Button>
        </form>
      )}
      <ErroApi erro={adicionar.error} />
    </section>
  );
}

function ItemRequisito({
  requisito: r,
  editando,
  revisao,
  bloqueado,
  onEditar,
  onCancelar,
  onAcao,
}: {
  requisito: RequisitoDto;
  editando: boolean;
  revisao: number;
  bloqueado: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onAcao: (acao: "confirmar" | "editar" | "descartar", revisao: number, texto?: string) => void;
}) {
  const [texto, setTexto] = useState(r.texto);
  // A edição vale para a revisão em que foi aberta: se algo mudar enquanto edita, é recusada.
  const [revisaoDaEdicao, setRevisaoDaEdicao] = useState(revisao);
  const confirmado = r.status === "confirmado";
  return (
    <li
      className={cn(
        "rounded-lg border p-3 text-sm",
        confirmado
          ? "border-success/40 bg-success-soft/40"
          : "border-warning/40 bg-warning-soft/40",
      )}
    >
      {editando ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAcao("editar", revisaoDaEdicao, texto.trim());
          }}
        >
          <Label htmlFor={`req-${r.codigo}`}>{r.codigo}</Label>
          <Textarea
            id={`req-${r.codigo}`}
            value={texto}
            rows={2}
            maxLength={400}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={bloqueado || texto.trim().length < 3}>
              Salvar e confirmar
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p>
            <span className="mr-2 font-mono text-xs text-muted-foreground">{r.codigo}</span>
            {r.texto}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span
              className={cn(
                "mr-auto text-xs font-medium",
                confirmado ? "text-success" : "text-warning",
              )}
            >
              {confirmado ? "Confirmado" : "Aguardando confirmação"}
              {r.origem === "usuario" ? " · escrito por você" : ""}
            </span>
            {!bloqueado && !confirmado && (
              <Button size="sm" variant="outline" onClick={() => onAcao("confirmar", revisao)}>
                <Check aria-hidden /> Confirmar
              </Button>
            )}
            {!bloqueado && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Editar ${r.codigo}`}
                  onClick={() => {
                    setTexto(r.texto);
                    setRevisaoDaEdicao(revisao);
                    onEditar();
                  }}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Descartar ${r.codigo}`}
                  onClick={() => onAcao("descartar", revisao)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function Configuracao({
  sistema,
  estado,
  bloqueado,
  onEstado,
}: {
  sistema: string;
  estado: EstadoCriacao;
  bloqueado: boolean;
  onEstado: (e: EstadoCriacao) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [estrutural, setEstrutural] = useState<CriacaoApiBody["issues"] | null>(null);
  // Mesma chave enquanto a revisão (e a versão a corrigir) não mudar: um retry não chama a IA de novo.
  const chave = useChavePorConteudo();
  const recarregar = useRecarregarSeAlterado(sistema);
  const tratar = (r: CriacaoApiBody) => {
    if (r.versao === null) {
      setEstrutural(r.issues ?? []);
      return;
    }
    setEstrutural(null);
    onEstado({
      revisao: r.revisao ?? estado.revisao,
      mensagens: r.mensagens ?? estado.mensagens,
      requisitos: r.requisitos ?? estado.requisitos,
      iaDisponivel: r.iaDisponivel ?? estado.iaDisponivel,
      versao: r.versao ?? null,
      issues: r.issues ?? [],
      config: r.config ?? null,
    });
  };
  const gerar = useMutation({
    mutationFn: () =>
      gerarConfiguracao(sistema, estado.revisao, chave({ gerar: true, revisao: estado.revisao })),
    onSuccess: tratar,
    onError: recarregar,
  });
  const corrigir = useMutation({
    mutationFn: (versao: string) =>
      corrigirConfiguracao(
        sistema,
        estado.revisao,
        versao,
        chave({ corrigir: versao, revisao: estado.revisao }),
      ),
    onSuccess: tratar,
    onError: recarregar,
  });
  const ativar = useMutation({
    mutationFn: async () => {
      const v = estado.versao!;
      if (v.status !== "approved") await aprovarVersao(sistema, v.id, v.hash);
      return ativarSistema(sistema, v.id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sistema", sistema] });
      void qc.invalidateQueries({ queryKey: ["sistemas"] });
      toast.success("Sistema ativado com a versão aprovada.");
      navigate({ to: "/sistemas/$id/app", params: { id: sistema } });
    },
  });

  const pendentes = estado.requisitos.some((r) => r.status === "pendente");
  const semRequisitos = estado.requisitos.length === 0;
  const v = estado.versao;
  const bloqueantes = estado.issues.filter((i) => i.severity === "bloqueante").length;

  return (
    <section aria-labelledby="titulo-config" className="rounded-xl border bg-card p-4 shadow-card">
      <h2 id="titulo-config" className="text-lg font-semibold">
        Configuração
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        A IA monta a configuração só com os requisitos confirmados e o catálogo do Nexus. O
        validador confere tudo antes de você aprovar.
      </p>
      <Button
        className="w-full"
        disabled={bloqueado || pendentes || semRequisitos || gerar.isPending}
        onClick={() => gerar.mutate()}
      >
        {gerar.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}
        {v ? "Gerar de novo" : "Gerar configuração"}
      </Button>
      {pendentes && (
        <p className="mt-2 text-xs text-muted-foreground">
          Confirme os requisitos pendentes antes.
        </p>
      )}
      <ErroApi erro={gerar.error ?? corrigir.error} />
      {estrutural && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-destructive/30 bg-danger-soft p-3 text-sm"
        >
          A IA devolveu uma estrutura fora do contrato; nada foi gravado. Tente gerar de novo ou use
          o formulário.
        </div>
      )}

      {v && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Versão <span className="font-medium tabular-nums">v{v.versao}</span>
            <StatusBadge status={v.status} />
            <span className="text-muted-foreground">
              · {v.origem === "chat" ? "gerada pela conversa" : "do formulário"}
            </span>
          </p>
          {estado.config && <Previa config={estado.config} />}
          {estado.issues.length > 0 && (
            <IssueList
              issues={estado.issues}
              onIr={(passo) =>
                navigate({
                  to: "/sistemas/$id/configurar",
                  params: { id: sistema },
                  search: { passo },
                })
              }
            />
          )}
          {v.status === "invalid" && bloqueantes > 0 && (
            <Button
              variant="outline"
              className="w-full"
              disabled={bloqueado || corrigir.isPending}
              onClick={() => corrigir.mutate(v.id)}
            >
              {corrigir.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Pedir correção à IA ({bloqueantes} {bloqueantes === 1 ? "erro" : "erros"})
            </Button>
          )}
          {(v.status === "valid" || v.status === "approved") && !bloqueado && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p>
                Ao ativar, você aprova exatamente esta versão (v{v.versao}). Os dados reais começam
                vazios.
              </p>
              <Button
                className="w-full"
                disabled={ativar.isPending}
                onClick={() => ativar.mutate()}
              >
                {ativar.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Aprovar e ativar
              </Button>
              <ErroApi erro={ativar.error} />
            </div>
          )}
          {v.status === "superseded" && (
            <p className="text-sm text-muted-foreground">
              Os requisitos mudaram depois desta versão. Gere de novo para aprovar.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Prévia do que a versão monta (seção 8, passo 6): modelo, menus, campos e regras. */
function Previa({ config }: { config: ConfigDraft }) {
  const rotulo = (id: string) => config.tipos_atendimento.find((t) => t.id === id)?.rotulo ?? id;
  const regras = config.regras.map((r) => {
    switch (r.tipo) {
      case "limite_atacado":
        return `Atacado a partir de ${formatarCentavos(r.valor_centavos)}`;
      case "unidades_por_caixa":
        return `Caixa padrão com ${r.unidades} unidades`;
      case "prazo_reserva":
        return `Reserva de ${r.minutos} min no pedido aberto`;
      case "par_atendimento":
        return `${rotulo(r.primeiro)} → ${rotulo(r.segundo)}, mesmo profissional`;
    }
  });
  return (
    <dl className="grid gap-2 rounded-lg bg-muted/40 p-3 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Modelo</dt>
        <dd>{TEMPLATE_LABELS[config.modelo]}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Menu</dt>
        <dd>
          {config.modulos
            .map((m) => config.aparencia.rotulos_menu?.[m] ?? ROTULO_MODULO[m])
            .join(" · ")}
        </dd>
      </div>
      {config.campos.length > 0 && (
        <div>
          <dt className="text-xs text-muted-foreground">Campos informativos</dt>
          <dd>
            {config.campos
              .map((c) => `${c.rotulo}${c.obrigatorio ? "" : " (opcional)"}`)
              .join(" · ")}
          </dd>
        </div>
      )}
      {config.tipos_atendimento.length > 0 && (
        <div>
          <dt className="text-xs text-muted-foreground">Atendimentos</dt>
          <dd>
            {config.tipos_atendimento
              .map((t) => `${t.rotulo} (${t.duracao_minutos} min)`)
              .join(" · ")}
          </dd>
        </div>
      )}
      <div>
        <dt className="text-xs text-muted-foreground">Regras</dt>
        <dd>{regras.length ? regras.join(" · ") : "Nenhuma"}</dd>
      </div>
      {config.fora_do_catalogo.length > 0 && (
        <div>
          <dt className="text-xs text-muted-foreground">
            Fora do catálogo (registrado, não atendido)
          </dt>
          <dd>{config.fora_do_catalogo.map((f) => f.texto).join(" · ")}</dd>
        </div>
      )}
    </dl>
  );
}
