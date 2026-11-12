import { useEffect, useRef, type RefObject } from "react";
import {
  ArrowRight,
  Bot,
  CircleCheck,
  CircleDashed,
  Lightbulb,
  MessageCircle,
  Pencil,
  RotateCw,
  Send,
  Wrench,
} from "lucide-react";
import type { AssuntoDto, PedidoDto, RequisitoDto } from "../../../shared/api";
import type { EstadoCriacao } from "@/api/criacao";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  assuntosDaEntrevista,
  estadoDoItem,
  pendenciasDaEntrevista,
  type EstadoAssunto,
} from "@/lib/criacao";
import { Link } from "@/lib/rotas";
import { cn } from "@/lib/utils";

// Entrevista guiada (ADR-004): trilha de assuntos, conversa com respostas rápidas, cartões de
// sugestão e de pedido ao desenvolvedor, e o "Resumo do seu sistema" em linguagem de negócio.

const VISUAL_ASSUNTO: Record<
  EstadoAssunto,
  { texto: string; Icone: typeof CircleCheck; classe: string }
> = {
  feito: { texto: "Feito", Icone: CircleCheck, classe: "text-success" },
  atual: { texto: "Atual", Icone: MessageCircle, classe: "text-primary" },
  pendente: { texto: "Pendente", Icone: CircleDashed, classe: "text-muted-foreground" },
};

export function TrilhaAssuntos({
  estado,
  onEscolher,
}: {
  estado: EstadoCriacao;
  onEscolher: (assunto: AssuntoDto) => void;
}) {
  return (
    <nav aria-label="Assuntos da entrevista" className="mb-6 border-y py-3">
      <ol className="flex gap-2 overflow-x-auto">
        {assuntosDaEntrevista(estado).map((a) => {
          const { texto, Icone, classe } = VISUAL_ASSUNTO[a.estado];
          const conteudo = (
            <>
              <Icone className={cn("size-4 shrink-0", classe)} aria-hidden />
              <span className="text-left leading-tight">
                <span className="block text-xs font-medium">{a.rotulo}</span>
                <span className={cn("block text-xs", classe)}>{texto}</span>
              </span>
            </>
          );
          return (
            <li key={a.id} className="shrink-0">
              {a.estado === "feito" ? (
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted"
                  title={`Voltar a ${a.rotulo}`}
                  onClick={() => onEscolher(a.id)}
                >
                  {conteudo}
                </button>
              ) : (
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2",
                    a.estado === "atual" && "bg-accent",
                  )}
                  aria-current={a.estado === "atual" ? "step" : undefined}
                >
                  {conteudo}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Conversa({
  estado,
  bloqueado,
  ocupado,
  texto,
  setTexto,
  campo,
  erro,
  onEnviar,
  onUsarSugestao,
  onMudar,
  onVerPedido,
}: {
  estado: EstadoCriacao;
  bloqueado: boolean;
  ocupado: boolean;
  texto: string;
  setTexto: (t: string) => void;
  campo: RefObject<HTMLTextAreaElement | null>;
  erro: string | null;
  onEnviar: (t: string) => void;
  onUsarSugestao: (codigo: string) => void;
  onMudar: (r: RequisitoDto) => void;
  onVerPedido: (p: PedidoDto) => void;
}) {
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: "nearest" });
  }, [estado.mensagens.length, ocupado]);
  const ultima = estado.mensagens.at(-1);
  const porCodigo = new Map(estado.requisitos.map((r) => [r.codigo, r]));
  const porId = new Map(estado.pedidos.map((p) => [p.id, p]));
  const desativado = bloqueado || ocupado;

  return (
    <section aria-label="Conversa com o assistente" className="flex min-w-0 flex-col">
      <div
        className="h-[min(60vh,40rem)] min-h-72 space-y-4 overflow-y-auto pb-4 pr-1"
        role="log"
        aria-label="Mensagens da entrevista"
        aria-live="polite"
      >
        {estado.mensagens.length === 0 && (
          <div className="rounded-lg border bg-card p-4 shadow-card">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Bot className="size-4 text-primary" aria-hidden /> Assistente Nexus
            </p>
            <p className="text-sm leading-relaxed">
              Olá! Vou montar o seu sistema com você, uma pergunta de cada vez. Para começar: o que
              o seu negócio vende ou faz, e como você vende?
            </p>
          </div>
        )}
        {estado.mensagens.map((m) =>
          m.papel === "usuario" ? (
            <div
              key={m.id}
              className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-primary p-4 text-sm text-primary-foreground"
            >
              {m.texto}
            </div>
          ) : (
            <div key={m.id} className="rounded-lg border bg-card p-4 shadow-card">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Bot className="size-4 text-primary" aria-hidden /> Assistente Nexus
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.texto}</p>
              {m.sugestoes.map((codigo) => {
                const r = porCodigo.get(codigo);
                if (!r) return null;
                const pendente = estadoDoItem(r) === "sugestao";
                return (
                  <div key={codigo} className="mt-3 rounded-lg bg-warning-soft p-4">
                    <p className="flex items-start gap-2 text-sm font-medium text-warning">
                      <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
                      Sugestão: {r.texto}
                    </p>
                    {pendente ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={desativado}
                          onClick={() => onUsarSugestao(codigo)}
                        >
                          Usar sugestão
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={desativado}
                          onClick={() => onMudar(r)}
                        >
                          Mudar valor
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Resolvida no resumo.</p>
                    )}
                  </div>
                );
              })}
              {m.pedidos.map((id) => {
                const p = porId.get(id);
                if (!p) return null;
                return (
                  <div key={id} className="mt-3 rounded-lg bg-info-soft p-4">
                    <p className="flex items-start gap-2 text-sm font-medium text-info">
                      <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {p.titulo}
                    </p>
                    <p className="mt-1 text-xs text-info">
                      Pedido ao desenvolvedor · sem prazo definido
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => onVerPedido(p)}
                    >
                      Ver ficha
                    </Button>
                  </div>
                );
              })}
            </div>
          ),
        )}
        {ultima?.papel === "assistente" && ultima.respostasRapidas.length > 0 && !bloqueado && (
          <div className="flex flex-wrap gap-2">
            {ultima.respostasRapidas.map((r) => (
              <Button
                key={r}
                variant="outline"
                size="sm"
                className="h-auto min-h-8 max-w-full whitespace-normal rounded-full"
                disabled={ocupado}
                onClick={() => onEnviar(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        )}
        {ocupado && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="size-4 animate-pulse motion-reduce:animate-none" aria-hidden />
            Assistente está digitando…
          </p>
        )}
        <div ref={fim} />
      </div>
      {erro && (
        <div
          id="erro-envio"
          role="alert"
          className="my-3 rounded-lg border border-destructive/30 bg-danger-soft p-3 text-sm"
        >
          <p className="text-destructive">{erro}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={desativado || !texto.trim()}
            onClick={() => onEnviar(texto)}
          >
            <RotateCw aria-hidden /> Tentar de novo
          </Button>
        </div>
      )}
      <form
        className="mt-3 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          onEnviar(texto);
        }}
      >
        <label htmlFor="resposta-entrevista" className="mb-2 block text-sm font-medium">
          Sua resposta
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            ref={campo}
            id="resposta-entrevista"
            placeholder="Escreva sua resposta…"
            value={texto}
            maxLength={2000}
            disabled={bloqueado}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onEnviar(texto);
              }
            }}
            className="min-h-20 resize-none"
            aria-describedby={erro ? "erro-envio" : undefined}
          />
          <Button
            type="submit"
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Enviar"
            title="Enviar"
            disabled={desativado || !texto.trim()}
          >
            <Send className="size-5" aria-hidden />
          </Button>
        </div>
      </form>
    </section>
  );
}

const VISUAL_ITEM = {
  informado: { texto: "Você informou", Icone: CircleCheck, classe: "bg-success-soft text-success" },
  sugestao: {
    texto: "Sugestão — confirme",
    Icone: Lightbulb,
    classe: "bg-warning-soft text-warning",
  },
};

export function ResumoSistema({
  sistema,
  estado,
  bloqueado,
  ocupado,
  onUsarSugestao,
  onMudar,
  onVerPedido,
}: {
  sistema: string;
  estado: EstadoCriacao;
  bloqueado: boolean;
  ocupado: boolean;
  onUsarSugestao: (codigo: string) => void;
  onMudar: (r: RequisitoDto) => void;
  onVerPedido: (p: PedidoDto) => void;
}) {
  const pend = pendenciasDaEntrevista(estado);
  const grupos = [
    ...assuntosDaEntrevista(estado).map((a) => ({
      id: a.id,
      rotulo: a.rotulo,
      itens: estado.requisitos.filter((r) => r.assunto === a.id),
    })),
    { id: "outros", rotulo: "Outros", itens: estado.requisitos.filter((r) => !r.assunto) },
  ].filter((g) => g.id !== "outros" || g.itens.length > 0);
  const liberado = pend.podeRevisar && !bloqueado && !ocupado;

  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <section key={g.id} aria-label={g.rotulo}>
          <h3 className="mb-3 text-sm font-semibold">{g.rotulo}</h3>
          {g.itens.length === 0 ? (
            <p className="inline-flex items-center gap-1.5 rounded-md bg-neutral-soft px-2 py-1 text-xs text-muted-foreground">
              <CircleDashed className="size-4" aria-hidden /> Falta responder
            </p>
          ) : (
            <ul className="space-y-4">
              {g.itens.map((r) => {
                const e = estadoDoItem(r);
                const { texto, Icone, classe } = VISUAL_ITEM[e];
                return (
                  <li key={r.codigo} className="min-w-0 border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {r.titulo && <p className="text-sm text-muted-foreground">{r.titulo}</p>}
                        <p className="mt-1 break-words text-sm font-medium">{r.texto}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        title={`Mudar: ${r.titulo ?? r.texto}`}
                        aria-label={`Mudar: ${r.titulo ?? r.texto}`}
                        disabled={bloqueado || ocupado}
                        onClick={() => onMudar(r)}
                      >
                        <Pencil aria-hidden />
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                          classe,
                        )}
                      >
                        <Icone className="size-4" aria-hidden />
                        {texto}
                      </span>
                      {e === "sugestao" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bloqueado || ocupado}
                          onClick={() => onUsarSugestao(r.codigo)}
                        >
                          Confirmar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
      <section className="border-t pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="size-4 text-info" aria-hidden />
          Pedidos ao desenvolvedor ({estado.pedidos.length})
        </h3>
        {estado.pedidos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            O que o Nexus ainda não faz vira um pedido aqui.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {estado.pedidos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="rounded text-left text-sm text-info underline-offset-4 hover:underline"
                  onClick={() => onVerPedido(p)}
                >
                  {p.titulo}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/sistemas/$id/pedidos"
          params={{ id: sistema }}
          className="mt-2 inline-block rounded text-sm text-primary underline underline-offset-4"
        >
          Ver pedidos ao desenvolvedor
        </Link>
      </section>
      <footer className="border-t pt-4">
        {liberado ? (
          <Button asChild className="h-auto min-h-10 w-full whitespace-normal">
            <Link to="/sistemas/$id/criar/revisao" params={{ id: sistema }}>
              Revisar e criar meu sistema <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button
            disabled
            className="h-auto min-h-10 w-full whitespace-normal"
            aria-describedby="motivo-revisar"
          >
            Revisar e criar meu sistema <ArrowRight className="size-5" aria-hidden />
          </Button>
        )}
        {pend.motivo && (
          <p id="motivo-revisar" role="status" className="mt-2 text-sm text-muted-foreground">
            {pend.motivo}
          </p>
        )}
      </footer>
    </div>
  );
}
