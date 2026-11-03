import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { novaChave } from "@/api/cliente";
import { useNavigate } from "@/lib/rotas";
import { Loader2 } from "lucide-react";
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

export function CriarSistemaDialog({ gatilho }: { gatilho: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tocado, setTocado] = useState(false);
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
      navigate({ to: "/sistemas/$id", params: { id: s.id } });
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
              O sistema começa em rascunho. Você poderá configurá-lo em seguida.
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
