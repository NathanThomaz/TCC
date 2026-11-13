import { useRef, useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, SlidersHorizontal, TriangleAlert } from "lucide-react";
import type { AssuntoDto, RequisitoDto } from "../../shared/api";
import { acaoRequisito, enviarMensagem, obterCriacao, type EstadoCriacao } from "@/api/criacao";
import { obterSistema } from "@/api/sistemas";
import { codigoDoErro, useChavePorConteudo } from "@/components/app/Comum";
import { Conversa, ResumoSistema, TrilhaAssuntos } from "@/components/criacao/Entrevista";
import { FichaPedido } from "@/components/criacao/Pedido";
import { ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ROTULO_ASSUNTO } from "@/lib/criacao";
import { Link } from "@/lib/rotas";

// Criação guiada pela IA (seção 8 e ADR-004). A IA pergunta um assunto por vez; o resumo ao lado
// mostra o sistema tomando forma. Sugestões da IA só valem quando o usuário as aceita, e o resumo
// inteiro é confirmado de uma vez na revisão. Tudo fica salvo no servidor.

export function Criar() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["criacao", id], queryFn: () => obterCriacao(id) });
  const detalhe = useQuery({ queryKey: ["sistema", id], queryFn: () => obterSistema(id) });
  const [texto, setTexto] = useState("");
  // Mensagem já enviada, à espera da IA: aparece na conversa na hora (envio fluido).
  const [pendente, setPendente] = useState<string | null>(null);
  const [pedidoAberto, setPedidoAberto] = useState<string | null>(null);
  const [resumoAberto, setResumoAberto] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const chave = useChavePorConteudo();

  const atualizar = (e: EstadoCriacao) => qc.setQueryData(["criacao", id], e);
  // Se o estado mudou em outra tela, recarrega para o usuário ver o atual.
  const recarregar = (erro: unknown) => {
    if (codigoDoErro(erro) === "estado_alterado") {
      void qc.invalidateQueries({ queryKey: ["criacao", id] });
    }
  };
  const revisao = q.data?.revisao ?? 0;
  const enviar = useMutation({
    // Mesma chave enquanto o texto não mudar: repetir depois de uma falha não duplica a rodada.
    mutationFn: (t: string) => enviarMensagem(id, revisao, t, chave({ t, revisao })),
    onSuccess: (e) => atualizar(e),
    // Falhou: o texto volta para a caixa, para tentar de novo (mesma chave, sem duplicar).
    onError: (erro, enviado) => {
      // A caixa fica travada durante o envio: a resposta que falhou volta inteira.
      setTexto(enviado);
      recarregar(erro);
    },
    onSettled: () => setPendente(null),
  });
  const sugestao = useMutation({
    mutationFn: (codigo: string) =>
      acaoRequisito(id, codigo, "confirmar", revisao, undefined, chave({ codigo, revisao })),
    onSuccess: atualizar,
    onError: recarregar,
  });
  const remover = useMutation({
    mutationFn: (codigo: string) =>
      acaoRequisito(
        id,
        codigo,
        "descartar",
        revisao,
        undefined,
        chave({ remover: codigo, revisao }),
      ),
    onSuccess: atualizar,
    onError: recarregar,
  });

  const voltar = (
    <Link
      to="/sistemas/$id"
      params={{ id }}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> {detalhe.data?.sistema.nome ?? "Sistema"}
    </Link>
  );

  if (q.isPending) {
    return (
      <div aria-busy="true" aria-label="Carregando" className="space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-96 rounded-lg lg:col-span-3" />
          <Skeleton className="hidden h-96 rounded-lg lg:col-span-2 lg:block" />
        </div>
      </div>
    );
  }
  if (q.isError) {
    return (
      <>
        {voltar}
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );
  }

  const estado = q.data;
  const ativo = detalhe.data?.sistema.status === "active";
  const bloqueado = !estado.iaDisponivel || ativo;
  const ocupado = enviar.isPending || sugestao.isPending || remover.isPending;

  const escrever = (t: string) => {
    setTexto(t);
    setResumoAberto(false);
    // Depois que o painel do celular fecha, o foco volta para a caixa de resposta.
    setTimeout(() => campo.current?.focus(), 0);
  };
  const onEnviar = (t: string) => {
    const limpo = t.trim();
    if (!limpo || ocupado || bloqueado) return;
    setPendente(limpo);
    setTexto("");
    enviar.mutate(limpo);
  };
  const onMudar = (r: RequisitoDto) => escrever(`Quero mudar "${r.titulo ?? r.texto}": `);
  const onEscolher = (a: AssuntoDto) =>
    escrever(`Quero rever ${ROTULO_ASSUNTO[a].toLowerCase()}: `);
  const onVerPedido = (p: { id: string }) => {
    setResumoAberto(false);
    setPedidoAberto(p.id);
  };
  const erroEnvio = enviar.error ?? sugestao.error ?? remover.error;
  const resumo = (
    <ResumoSistema
      sistema={id}
      estado={estado}
      bloqueado={bloqueado}
      ocupado={ocupado}
      onUsarSugestao={(codigo) => sugestao.mutate(codigo)}
      onMudar={onMudar}
      onRemover={(codigo) => remover.mutate(codigo)}
      onVerPedido={onVerPedido}
    />
  );

  return (
    <>
      {voltar}
      <PageHeader
        titulo="Crie seu sistema com o assistente"
        descricao="Responda uma pergunta de cada vez. O resumo ao lado mostra o seu sistema tomando forma; você confere tudo antes de criar."
        acoes={
          <Button asChild variant="outline">
            <Link to="/sistemas/$id/configurar" params={{ id }}>
              <SlidersHorizontal aria-hidden /> Configurar sozinho
            </Link>
          </Button>
        }
      />
      {ativo && (
        <div role="note" className="mb-6 rounded-lg border bg-muted p-4 text-sm">
          Este sistema já está ativo. A entrevista fica só para consulta.
        </div>
      )}
      {!estado.iaDisponivel && !ativo && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm"
        >
          <TriangleAlert className="size-5 text-warning" aria-hidden />
          <span className="flex-1">
            O assistente está indisponível agora. Você pode configurar o sistema sozinho.
          </span>
          <Button asChild variant="outline" size="sm">
            <Link to="/sistemas/$id/configurar" params={{ id }}>
              Configurar sozinho
            </Link>
          </Button>
        </div>
      )}
      <TrilhaAssuntos estado={estado} onEscolher={onEscolher} />
      <div className="grid gap-8 pb-20 lg:grid-cols-5 lg:pb-0">
        <div className="min-w-0 lg:col-span-3">
          <Conversa
            estado={estado}
            bloqueado={bloqueado}
            ocupado={ocupado}
            pendente={pendente}
            texto={texto}
            setTexto={setTexto}
            campo={campo}
            erro={erroEnvio instanceof Error ? erroEnvio.message : null}
            onEnviar={onEnviar}
            onUsarSugestao={(codigo) => sugestao.mutate(codigo)}
            onMudar={onMudar}
            onVerPedido={onVerPedido}
          />
        </div>
        <aside
          aria-label="Resumo do seu sistema"
          className="hidden min-w-0 self-start border-l pl-6 lg:sticky lg:top-20 lg:col-span-2 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
        >
          <h2 className="mb-5 text-lg font-semibold">Resumo do seu sistema</h2>
          {resumo}
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card p-3 lg:hidden">
        <Button variant="outline" className="w-full" onClick={() => setResumoAberto(true)}>
          <ClipboardList aria-hidden /> Ver resumo ({estado.requisitos.length})
        </Button>
      </div>
      <Sheet open={resumoAberto} onOpenChange={setResumoAberto}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Resumo do seu sistema</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{resumo}</div>
        </SheetContent>
      </Sheet>
      <FichaPedido
        pedido={estado.pedidos.find((p) => p.id === pedidoAberto) ?? null}
        onFechar={() => setPedidoAberto(null)}
      />
    </>
  );
}
