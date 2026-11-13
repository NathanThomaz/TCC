import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { salvarNome } from "@/api/auth";
import { ErroApi } from "@/components/app/Comum";
import { ROTULO_PAPEL } from "@/components/nexus/AppShell";
import { PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

// Perfil: a pessoa ajusta o próprio nome (aparece na saudação e para o administrador). E-mail e
// papel são definidos por quem criou a conta.

export function Perfil() {
  const { usuario, iniciar } = useAuth();
  const [nome, setNome] = useState(usuario?.temNome ? usuario.nome : "");
  const m = useMutation({
    mutationFn: () => salvarNome(nome.trim()),
    onSuccess: (u) => {
      iniciar(u);
      toast.success("Nome atualizado.");
    },
  });
  if (!usuario) return null;
  return (
    <>
      <PageHeader titulo="Perfil" descricao="Como você aparece no Nexus." />
      <form
        className="max-w-xl space-y-4 rounded-xl border bg-card p-5 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="perfil-nome">Nome</Label>
          <Input
            id="perfil-nome"
            value={nome}
            maxLength={120}
            placeholder={usuario.nome}
            autoComplete="name"
            onChange={(e) => setNome(e.target.value)}
          />
          {!usuario.temNome && (
            <p className="text-xs text-muted-foreground">
              Informe seu nome completo para ser chamado por ele na tela inicial.
            </p>
          )}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium">{usuario.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Papel</dt>
            <dd className="font-medium">
              {ROTULO_PAPEL[usuario.papel]}
              {usuario.dono ? " · dono do Nexus" : ""}
            </dd>
          </div>
        </dl>
        <ErroApi erro={m.error} />
        <Button type="submit" disabled={m.isPending || !nome.trim()}>
          {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Salvar
        </Button>
      </form>
    </>
  );
}
