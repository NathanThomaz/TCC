import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, MessageCircleQuestion, Send, User } from "lucide-react";
import { obterConsulta, perguntar, type EstadoConsulta } from "@/api/consulta";
import { ErroApi, useChavePorConteudo } from "@/components/app/Comum";
import { ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useApp } from "./Aplicacao";

// Perguntar ao sistema (seção 15): somente leitura. Os números vêm do sistema, com os filtros e a
// origem de cada resposta; a conversa é só sua e só deste sistema.

const SUGESTOES = [
  "Quanto vendi hoje?",
  "Quanto tenho de estoque?",
  "Quais pedidos estão segurando estoque?",
  "O que tem na agenda amanhã?",
  "Como funciona o atacado?",
];

export function Consulta() {
  const app = useApp();
  const qc = useQueryClient();
  const chaveQuery = ["app", app.id, "consulta"];
  const q = useQuery({ queryKey: chaveQuery, queryFn: () => obterConsulta(app.id) });
  const [texto, setTexto] = useState("");
  const chave = useChavePorConteudo();
  const fim = useRef<HTMLDivElement>(null);
  const m = useMutation({
    mutationFn: (t: string) => perguntar(app.id, t, chave(t)),
    onSuccess: (e: EstadoConsulta, enviado) => {
      qc.setQueryData(chaveQuery, e);
      setTexto((atual) => (atual.trim() === enviado ? "" : atual));
    },
  });
  const total = q.data?.mensagens.length ?? 0;
  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: "nearest" });
  }, [total]);

  if (q.isPending) return <Skeleton className="h-80 w-full rounded-xl" />;
  if (q.isError) return <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />;
  const enviar = (t: string) => {
    if (t.trim() && !m.isPending) m.mutate(t.trim());
  };

  return (
    <>
      <PageHeader
        titulo="Perguntar"
        descricao="Consulte vendas, estoque, reservas, agenda e regras deste sistema. Só leitura: para alterar dados, use as telas."
      />
      {!q.data.iaDisponivel && (
        <div role="note" className="mb-4 rounded-lg border bg-muted p-4 text-sm">
          A IA não está configurada neste ambiente. As telas continuam disponíveis.
        </div>
      )}
      <section aria-label="Conversa" className="rounded-xl border bg-card shadow-card">
        <ol className="max-h-[60vh] space-y-4 overflow-y-auto p-4" aria-live="polite">
          {q.data.mensagens.length === 0 && (
            <li className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  disabled={!q.data.iaDisponivel || m.isPending}
                  onClick={() => enviar(s)}
                >
                  {s}
                </Button>
              ))}
            </li>
          )}
          {q.data.mensagens.map((msg) => {
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
                  {ia && (msg.filtros.length > 0 || msg.origem) && (
                    <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                      {[...msg.filtros, msg.origem ? `Origem: ${msg.origem}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          {m.isPending && (
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Consultando…
            </li>
          )}
          <div ref={fim} />
        </ol>
        <form
          className="flex gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(texto);
          }}
        >
          <Label htmlFor="pergunta" className="sr-only">
            Pergunta
          </Label>
          <Input
            id="pergunta"
            value={texto}
            maxLength={500}
            disabled={!q.data.iaDisponivel}
            placeholder="Ex.: quanto vendi esta semana?"
            onChange={(e) => setTexto(e.target.value)}
          />
          <Button
            type="submit"
            disabled={!q.data.iaDisponivel || m.isPending || texto.trim() === ""}
          >
            {m.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            <span className="sr-only sm:not-sr-only">Perguntar</span>
          </Button>
        </form>
        <div className="px-3 pb-3">
          <ErroApi erro={m.error} />
        </div>
      </section>
      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <MessageCircleQuestion className="size-3" aria-hidden /> O total vendido considera vendas
        concluídas, sem as canceladas, e não é lucro nem dinheiro recebido.
      </p>
    </>
  );
}
