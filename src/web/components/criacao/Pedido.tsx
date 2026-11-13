import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CircleCheck,
  CircleSlash,
  Clock,
  Loader2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { EstadoPedidoDto, PedidoDto } from "../../../shared/api";
import { cancelarPedido, comentarPedido } from "@/api/pedidos";
import { ErroApi, useChavePorConteudo } from "@/components/app/Comum";
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
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { dataBr, ROTULO_ASSUNTO, ROTULO_ESTADO_PEDIDO } from "@/lib/criacao";
import { cn } from "@/lib/utils";

// Pedido ao desenvolvedor (ADR-004): selo de estado e ficha completa, com comentários e
// cancelamento enquanto o pedido estiver aberto.

const VISUAL: Record<EstadoPedidoDto, { Icone: LucideIcon; classe: string }> = {
  aberto: { Icone: Wrench, classe: "bg-info-soft text-info" },
  em_analise: { Icone: Clock, classe: "bg-warning-soft text-warning" },
  implementado: { Icone: CircleCheck, classe: "bg-success-soft text-success" },
  recusado: { Icone: CircleSlash, classe: "bg-neutral-soft text-muted-foreground" },
  cancelado: { Icone: Ban, classe: "bg-neutral-soft text-muted-foreground" },
};

export function EstadoPedido({ estado }: { estado: EstadoPedidoDto }) {
  const { Icone, classe } = VISUAL[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium",
        classe,
      )}
    >
      <Icone className="size-4" aria-hidden />
      {ROTULO_ESTADO_PEDIDO[estado]}
    </span>
  );
}

/** Ficha num painel lateral. Sem `sistema`, só leitura (ex.: dentro da entrevista). */
export function FichaPedido({
  pedido,
  sistema,
  onFechar,
}: {
  pedido: PedidoDto | null;
  sistema?: string;
  onFechar: () => void;
}) {
  return (
    <Sheet open={pedido !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {pedido && <Ficha pedido={pedido} sistema={sistema} />}
      </SheetContent>
    </Sheet>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

function Ficha({ pedido, sistema }: { pedido: PedidoDto; sistema: string | undefined }) {
  const qc = useQueryClient();
  const [comentario, setComentario] = useState("");
  // Uma chave por intenção: repetir depois de uma falha não duplica; depois de um sucesso, o
  // próximo envio (mesmo com texto igual) é outra intenção.
  const chaveComentario = useChavePorConteudo();
  const chaveCancelar = useChavePorConteudo();
  const [enviados, setEnviados] = useState(0);
  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ["pedidos", sistema] });
    void qc.invalidateQueries({ queryKey: ["criacao", sistema] });
  };
  const comentar = useMutation({
    mutationFn: (texto: string) =>
      comentarPedido(
        sistema!,
        pedido.id,
        texto,
        chaveComentario({ pedido: pedido.id, texto, enviados }),
      ),
    onSuccess: () => {
      setComentario("");
      setEnviados((n) => n + 1);
      atualizar();
    },
  });
  const cancelar = useMutation({
    mutationFn: () => cancelarPedido(sistema!, pedido.id, chaveCancelar({ cancelar: pedido.id })),
    onSuccess: atualizar,
  });

  return (
    <div className="space-y-6 px-4 pb-6">
      <SheetHeader className="px-0">
        <SheetTitle className="pr-6">{pedido.titulo}</SheetTitle>
        <SheetDescription>Pedido ao desenvolvedor. Não há prazo definido.</SheetDescription>
      </SheetHeader>
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <EstadoPedido estado={pedido.estado} />
        {pedido.assunto && <span>{ROTULO_ASSUNTO[pedido.assunto]}</span>}
        <span>· criado em {dataBr(pedido.criadoEm)}</span>
      </p>
      <Secao titulo="O que você pediu">
        <blockquote className="border-l-2 border-primary pl-3 text-sm italic">
          “{pedido.pedidoOriginal}”
        </blockquote>
      </Secao>
      {pedido.contexto && (
        <Secao titulo="Contexto">
          <p className="text-sm text-muted-foreground">{pedido.contexto}</p>
        </Secao>
      )}
      {pedido.regraProposta && (
        <Secao titulo="Regra proposta">
          <p className="text-sm text-muted-foreground">{pedido.regraProposta}</p>
        </Secao>
      )}
      {pedido.exemplos.length > 0 && (
        <Secao titulo="Exemplos">
          <table className="w-full border text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 font-medium">Situação</th>
                <th className="p-2 font-medium">Esperado</th>
              </tr>
            </thead>
            <tbody>
              {pedido.exemplos.map((e, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-2">{e.situacao}</td>
                  <td className="p-2">{e.esperado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
      )}
      {pedido.criteriosAceite.length > 0 && (
        <Secao titulo="Como saber que ficou pronto">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {pedido.criteriosAceite.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Secao>
      )}
      <Secao titulo="Histórico">
        <ol className="space-y-3 border-l pl-4">
          {pedido.historico.map((h, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">{ROTULO_ESTADO_PEDIDO[h.estado]}</span>
              <span className="text-muted-foreground"> · {dataBr(h.em)}</span>
              {h.nota && <p className="text-muted-foreground">{h.nota}</p>}
            </li>
          ))}
        </ol>
      </Secao>
      <Secao titulo="Comentários">
        {pedido.comentarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comentário.</p>
        ) : (
          <ul className="space-y-2">
            {pedido.comentarios.map((c, i) => (
              <li key={i} className="rounded-lg bg-muted p-3 text-sm">
                {c.texto}
                <span className="mt-1 block text-xs text-muted-foreground">{dataBr(c.em)}</span>
              </li>
            ))}
          </ul>
        )}
        {sistema && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (comentario.trim()) comentar.mutate(comentario.trim());
            }}
          >
            <Label htmlFor={`comentario-${pedido.id}`}>Acrescentar comentário</Label>
            <Textarea
              id={`comentario-${pedido.id}`}
              value={comentario}
              maxLength={1000}
              onChange={(e) => setComentario(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={!comentario.trim() || comentar.isPending}
            >
              {comentar.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Comentar
            </Button>
            <ErroApi erro={comentar.error} />
          </form>
        )}
      </Secao>
      {sistema && pedido.estado === "aberto" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full">
              Cancelar pedido
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar este pedido?</AlertDialogTitle>
              <AlertDialogDescription>
                O desenvolvedor deixa de avaliá-lo. O pedido continua no histórico como cancelado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => cancelar.mutate()}>
                Cancelar pedido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <ErroApi erro={cancelar.error} />
    </div>
  );
}
