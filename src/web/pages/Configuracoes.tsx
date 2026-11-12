import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, ShieldOff, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import type { ContaDto } from "../../shared/api";
import {
  convidarConta,
  definirAcesso,
  definirStatusConta,
  listarContas,
  reenviarConvite,
} from "@/api/contas";
import { listarSistemas } from "@/api/sistemas";
import { ErroApi, useChavePorConteudo } from "@/components/app/Comum";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Contas e acessos (seção 7): o administrador convida contas secundárias por e-mail, escolhe os
// sistemas que cada uma opera, revoga acessos e desativa contas. A senha é definida pela própria
// pessoa, pelo link que o Firebase envia; o administrador nunca a conhece.

const STATUS: Record<ContaDto["status"], { rotulo: string; classe: string }> = {
  pending: { rotulo: "Convite enviado", classe: "bg-info-soft text-info" },
  active: { rotulo: "Ativa", classe: "bg-success-soft text-success" },
  disabled: { rotulo: "Desativada", classe: "bg-muted text-muted-foreground" },
};

export function Configuracoes() {
  const { usuario } = useAuth();
  if (usuario?.papel !== "administrador") {
    return (
      <>
        <PageHeader titulo="Configurações" />
        <EmptyState
          icone={Users}
          titulo="Contas são gerenciadas pelo administrador"
          descricao="Peça ao administrador para conceder ou revisar o seu acesso aos sistemas."
        />
      </>
    );
  }
  return <ContasEAcessos />;
}

function ContasEAcessos() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["contas"], queryFn: listarContas });
  const [convidando, setConvidando] = useState(false);
  const atualizar = (conta: ContaDto) =>
    qc.setQueryData<ContaDto[]>(["contas"], (lista) =>
      (lista ?? []).map((c) => (c.id === conta.id ? conta : c)),
    );

  return (
    <>
      <PageHeader
        titulo="Contas e acessos"
        descricao="Contas secundárias operam só os sistemas marcados. Correção de saldo e configuração continuam só com você."
        acoes={
          <Button onClick={() => setConvidando(true)}>
            <UserPlus aria-hidden /> Convidar conta
          </Button>
        }
      />
      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icone={Users}
          titulo="Nenhuma conta secundária"
          descricao="Convide quem vai operar vendas, estoque ou agenda. A pessoa recebe um link para definir a própria senha."
        />
      ) : (
        <ul className="space-y-3">
          {q.data.map((conta) => (
            <CartaoConta key={conta.id} conta={conta} onAtualizar={atualizar} />
          ))}
        </ul>
      )}
      {convidando && <ConvidarDialog onFechar={() => setConvidando(false)} />}
    </>
  );
}

function CartaoConta({
  conta,
  onAtualizar,
}: {
  conta: ContaDto;
  onAtualizar: (c: ContaDto) => void;
}) {
  const desativada = conta.status === "disabled";
  const acesso = useMutation({
    mutationFn: (a: { sistema: string; ativo: boolean }) =>
      definirAcesso(conta.id, a.sistema, a.ativo),
    onSuccess: onAtualizar,
    onError: (e) => toast.error(e.message),
  });
  const status = useMutation({
    mutationFn: () => definirStatusConta(conta.id, desativada ? "active" : "disabled"),
    onSuccess: (c) => {
      onAtualizar(c);
      toast.success(
        c.status === "disabled"
          ? "Conta desativada: as sessões abertas foram encerradas e os acessos, revogados."
          : "Conta reativada. Revise os sistemas que ela pode operar.",
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const convite = useMutation({
    mutationFn: () => reenviarConvite(conta.id),
    onSuccess: () => toast.success(`Convite reenviado para ${conta.email}.`),
    onError: (e) => toast.error(e.message),
  });
  const s = STATUS[conta.status];

  return (
    <li className={cn("rounded-xl border bg-card p-4 shadow-card", desativada && "opacity-75")}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{conta.nome ?? conta.email}</p>
          {conta.nome && <p className="text-sm text-muted-foreground">{conta.email}</p>}
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", s.classe)}>
          {s.rotulo}
        </span>
        {conta.status === "pending" && (
          <Button
            size="sm"
            variant="outline"
            disabled={convite.isPending}
            onClick={() => convite.mutate()}
          >
            <Mail aria-hidden /> Reenviar convite
          </Button>
        )}
        <Button
          size="sm"
          variant={desativada ? "outline" : "ghost"}
          disabled={status.isPending}
          onClick={() => status.mutate()}
        >
          {status.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : desativada ? null : (
            <ShieldOff aria-hidden />
          )}
          {desativada ? "Reativar" : "Desativar"}
        </Button>
      </div>
      <fieldset className="mt-3 border-t pt-3" disabled={desativada}>
        <legend className="mb-2 text-sm text-muted-foreground">
          {desativada ? "Reative a conta para conceder acessos." : "Sistemas que esta conta opera"}
        </legend>
        {conta.sistemas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não tem sistemas.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {conta.sistemas.map((sis) => (
              <li
                key={sis.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <Label htmlFor={`acesso-${conta.id}-${sis.id}`} className="font-normal">
                  {sis.nome}
                </Label>
                <Switch
                  id={`acesso-${conta.id}-${sis.id}`}
                  checked={sis.ativo}
                  disabled={desativada || acesso.isPending}
                  onCheckedChange={(ativo) => acesso.mutate({ sistema: sis.id, ativo })}
                />
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </li>
  );
}

function ConvidarDialog({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const sistemas = useQuery({ queryKey: ["sistemas"], queryFn: listarSistemas });
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const chave = useChavePorConteudo();
  const m = useMutation({
    mutationFn: () => {
      const dados = { email: email.trim(), nome: nome.trim() || undefined, sistemas: marcados };
      return convidarConta(dados, chave(dados));
    },
    onSuccess: ({ conta, conviteEnviado }) => {
      void qc.invalidateQueries({ queryKey: ["contas"] });
      if (conviteEnviado) toast.success(`Convite enviado para ${conta.email}.`);
      else toast.warning("Conta criada, mas o convite não saiu agora. Use “Reenviar convite”.");
      onFechar();
    },
  });
  const disponiveis = (sistemas.data ?? []).filter((s) => s.status !== "archived");
  const alternar = (id: string, marcar: boolean) =>
    setMarcados((atual) => (marcar ? [...atual, id] : atual.filter((x) => x !== id)));

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
            <DialogTitle>Convidar conta</DialogTitle>
            <DialogDescription>
              A pessoa recebe um e-mail para definir a senha. Ela entra com esse e-mail e opera só
              os sistemas marcados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="convite-email">E-mail</Label>
            <Input
              id="convite-email"
              type="email"
              required
              autoFocus
              value={email}
              maxLength={320}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="convite-nome">
              Nome <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="convite-nome"
              value={nome}
              maxLength={120}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Sistemas</legend>
            {disponiveis.length === 0 ? (
              <p className="text-sm text-muted-foreground">Crie um sistema antes de dar acesso.</p>
            ) : (
              disponiveis.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={marcados.includes(s.id)}
                    onCheckedChange={(v) => alternar(s.id, v === true)}
                  />
                  {s.nome}
                </label>
              ))
            )}
          </fieldset>
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending || !email.includes("@")}>
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
