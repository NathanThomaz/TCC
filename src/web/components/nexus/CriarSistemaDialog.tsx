import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { novaChave } from "@/api/cliente";
import { useNavigate } from "@/lib/rotas";
import { Bot, CircleCheck, Loader2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { criarSistema } from "@/api/sistemas";
import { validarNomeSistema } from "@/lib/nexus";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MODOS = [
  {
    id: "assistente",
    titulo: "Conversar com o assistente",
    descricao: "Responda uma pergunta de cada vez; o assistente monta o sistema com você.",
    Icone: Bot,
  },
  {
    id: "sozinho",
    titulo: "Configurar sozinho",
    descricao: "Modo avançado: escolha o modelo e ajuste os módulos em 3 passos.",
    Icone: SlidersHorizontal,
  },
] as const;

export function CriarSistemaDialog({ gatilho }: { gatilho: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tocado, setTocado] = useState(false);
  const [modo, setModo] = useState<(typeof MODOS)[number]["id"]>("assistente");
  const qc = useQueryClient();
  // Mesma chave enquanto o nome não mudar: retry ou clique repetido não cria outro sistema.
  const chaveRef = useRef<{ nome: string; chave: string } | null>(null);
  const navigate = useNavigate();
  const erro = validarNomeSistema(nome);

  const m = useMutation({
    mutationFn: (nome: string) => {
      if (chaveRef.current?.nome !== nome) chaveRef.current = { nome, chave: novaChave() };
      return criarSistema(nome, chaveRef.current.chave);
    },
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ["sistemas"] });
      toast.success(`Sistema "${s.nome}" criado.`);
      setAberto(false);
      setNome("");
      setTocado(false);
      navigate({
        to: modo === "assistente" ? "/sistemas/$id/criar" : "/sistemas/$id/configurar",
        params: { id: s.id },
      });
    },
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTocado(true);
            if (!erro) m.mutate(nome);
          }}
        >
          <DialogHeader>
            <DialogTitle>Criar sistema</DialogTitle>
            <DialogDescription>
              Escolha um nome e como quer montar o seu sistema. Ele começa em rascunho.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-2">
            <Label htmlFor="nome-sistema">Nome do sistema</Label>
            <Input
              id="nome-sistema"
              value={nome}
              maxLength={80}
              onChange={(e) => setNome(e.target.value)}
              onBlur={() => setTocado(true)}
              aria-invalid={tocado && !!erro}
              aria-describedby="nome-sistema-ajuda"
              autoFocus
            />
            <p
              id="nome-sistema-ajuda"
              className={
                tocado && erro ? "text-sm text-destructive" : "text-xs text-muted-foreground"
              }
            >
              {tocado && erro ? (
                erro
              ) : (
                <span className="tabular-nums">{nome.trim().length}/80 caracteres</span>
              )}
            </p>
            {m.isError && (
              <p role="alert" className="text-sm text-destructive">
                {m.error.message}
              </p>
            )}
          </div>
          <fieldset className="mb-5 space-y-3" disabled={m.isPending}>
            <legend className="mb-2 text-sm font-medium">Como você quer começar?</legend>
            {MODOS.map((o) => {
              const selecionado = modo === o.id;
              return (
                <label
                  key={o.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-4 focus-within:ring-2 focus-within:ring-ring",
                    selecionado ? "border-primary bg-accent" : "bg-card",
                  )}
                >
                  <input
                    type="radio"
                    name="modo-criacao"
                    value={o.id}
                    checked={selecionado}
                    onChange={() => setModo(o.id)}
                    className="sr-only"
                  />
                  <o.Icone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {o.titulo}
                      {o.id === "assistente" && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-xs text-success">
                          <CircleCheck className="size-3.5" aria-hidden /> Recomendado
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{o.descricao}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
