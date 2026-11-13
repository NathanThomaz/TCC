import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { ContaDto } from "../../shared/api";
import {
  convidarConta,
  definirAcesso,
  definirSenhaConta,
  definirStatusConta,
  gerarSenha,
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

// Contas e acessos (seção 7): o administrador cria contas, escolhe os sistemas que cada uma opera,
// revoga acessos e desativa contas. Desde 2026-11-13 (pedido do dono), ele define a senha e manda
// à pessoa, sem validação por e-mail (o link por e-mail continua como alternativa). O dono do Nexus
// também cria administradores independentes, que montam os próprios sistemas.

const STATUS: Record<ContaDto["status"], { rotulo: string; classe: string }> = {
  pending: { rotulo: "Aguardando o primeiro acesso", classe: "bg-info-soft text-info" },
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
            <UserPlus aria-hidden /> Nova conta
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
          titulo="Nenhuma conta ainda"
          descricao="Crie a conta de quem vai operar vendas, estoque ou agenda: você define a senha e manda para a pessoa."
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
    onSuccess: () => toast.success(`Link de definir senha enviado para ${conta.email}.`),
    onError: (e) => toast.error(e.message),
  });
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const admin = conta.papel === "admin";
  const s = STATUS[conta.status];

  return (
    <li className={cn("rounded-xl border bg-card p-4 shadow-card", desativada && "opacity-75")}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{conta.nome ?? conta.email}</p>
          {conta.nome && <p className="text-sm text-muted-foreground">{conta.email}</p>}
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            admin ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          {admin ? "Administrador" : "Operador"}
        </span>
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
            <Mail aria-hidden /> Link por e-mail
          </Button>
        )}
        {!desativada && (
          <Button size="sm" variant="outline" onClick={() => setTrocandoSenha(true)}>
            <KeyRound aria-hidden /> Definir senha
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
      {trocandoSenha && <SenhaDialog conta={conta} onFechar={() => setTrocandoSenha(false)} />}
      {admin ? (
        <p className="mt-3 flex items-center gap-2 border-t pt-3 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          Administrador independente: cria e configura os próprios sistemas, sem ver os seus.
        </p>
      ) : (
        <fieldset className="mt-3 border-t pt-3" disabled={desativada}>
          <legend className="mb-2 text-sm text-muted-foreground">
            {desativada
              ? "Reative a conta para conceder acessos."
              : "Sistemas que esta conta opera"}
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
      )}
    </li>
  );
}

/** Endereço, e-mail e senha prontos para mandar à pessoa, com botão de copiar. */
function Credenciais({ email, senha }: { email: string; senha: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Acesse o Nexus em ${window.location.origin}/entrar\nE-mail: ${email}\nSenha: ${senha}`;
  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <pre className="text-sm whitespace-pre-wrap">{texto}</pre>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          void navigator.clipboard.writeText(texto).then(() => setCopiado(true));
        }}
      >
        {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copiado ? "Copiado" : "Copiar para enviar"}
      </Button>
      <p className="text-xs text-muted-foreground">
        A senha não fica guardada no Nexus: copie agora. A pessoa pode trocá-la depois pelo “Esqueci
        minha senha”, e você pode definir outra quando quiser.
      </p>
    </div>
  );
}

function CampoSenha({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="conta-senha">Senha</Label>
      <div className="flex gap-2">
        <Input
          id="conta-senha"
          value={valor}
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          spellCheck={false}
          className="font-mono"
          onChange={(e) => onChange(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={() => onChange(gerarSenha())}>
          <RefreshCw aria-hidden /> Gerar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
    </div>
  );
}

function SenhaDialog({ conta, onFechar }: { conta: ContaDto; onFechar: () => void }) {
  const [senha, setSenha] = useState(gerarSenha);
  const m = useMutation({ mutationFn: (nova: string) => definirSenhaConta(conta.id, nova) });
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Definir senha de {conta.nome ?? conta.email}</DialogTitle>
          <DialogDescription>
            A senha antiga deixa de valer. Mande a nova para a pessoa.
          </DialogDescription>
        </DialogHeader>
        {m.isSuccess ? (
          <Credenciais email={conta.email} senha={m.variables} />
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate(senha);
            }}
          >
            <fieldset disabled={m.isPending}>
              <CampoSenha valor={senha} onChange={setSenha} />
            </fieldset>
            <ErroApi erro={m.error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onFechar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={m.isPending || senha.length < 8}>
                {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Salvar senha
              </Button>
            </DialogFooter>
          </form>
        )}
        {m.isSuccess && (
          <DialogFooter>
            <Button onClick={onFechar}>Concluir</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConvidarDialog({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const sistemas = useQuery({ queryKey: ["sistemas"], queryFn: listarSistemas });
  const [papel, setPapel] = useState<ContaDto["papel"]>("secondary");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState(gerarSenha);
  const [marcados, setMarcados] = useState<string[]>([]);
  const chave = useChavePorConteudo();
  const m = useMutation({
    // Os dados enviados ficam em m.variables: a confirmação mostra exatamente o que foi criado.
    mutationFn: (dados: {
      email: string;
      nome: string | undefined;
      sistemas: string[];
      senha: string;
      papel: ContaDto["papel"];
    }) => convidarConta(dados, chave(dados)),
    onSuccess: ({ acessoCriado }) => {
      void qc.invalidateQueries({ queryKey: ["contas"] });
      if (!acessoCriado) {
        toast.warning("Conta criada, mas o acesso não saiu agora. Use “Definir senha” na conta.");
        onFechar();
      }
    },
  });
  const disponiveis = (sistemas.data ?? []).filter((s) => s.status !== "archived");
  const alternar = (id: string, marcar: boolean) =>
    setMarcados((atual) => (marcar ? [...atual, id] : atual.filter((x) => x !== id)));

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        {m.isSuccess && m.data.acessoCriado ? (
          <>
            <DialogHeader>
              <DialogTitle>Conta criada</DialogTitle>
              <DialogDescription>
                Envie os dados abaixo para {m.variables.nome ?? "a pessoa"}. Ela já pode entrar.
              </DialogDescription>
            </DialogHeader>
            <Credenciais email={m.variables.email} senha={m.variables.senha} />
            <DialogFooter>
              <Button onClick={onFechar}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate({
                email: email.trim(),
                nome: nome.trim() || undefined,
                sistemas: papel === "admin" ? [] : marcados,
                senha,
                papel,
              });
            }}
          >
            <fieldset disabled={m.isPending} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Nova conta</DialogTitle>
                <DialogDescription>
                  Você define a senha e manda para a pessoa; ela entra direto, sem confirmar e-mail.
                </DialogDescription>
              </DialogHeader>
              {usuario?.dono && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Tipo de conta</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["secondary", "Operador", "Opera os sistemas que você marcar."],
                        ["admin", "Administrador", "Cria e configura os próprios sistemas."],
                      ] as const
                    ).map(([valor, rotulo, texto]) => (
                      <label
                        key={valor}
                        className={cn(
                          "flex cursor-pointer gap-2 rounded-lg border p-3 text-sm",
                          papel === valor && "border-primary ring-2 ring-primary/30",
                        )}
                      >
                        <input
                          type="radio"
                          name="papel"
                          className="mt-0.5 accent-[var(--primary)]"
                          checked={papel === valor}
                          onChange={() => setPapel(valor)}
                        />
                        <span>
                          <span className="block font-medium">{rotulo}</span>
                          <span className="block text-muted-foreground">{texto}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="convite-nome">Nome</Label>
                  <Input
                    id="convite-nome"
                    value={nome}
                    maxLength={120}
                    autoFocus
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="convite-email">E-mail (usuário de acesso)</Label>
                  <Input
                    id="convite-email"
                    type="email"
                    required
                    value={email}
                    maxLength={320}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <CampoSenha valor={senha} onChange={setSenha} />
              {papel === "secondary" && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Sistemas que a conta opera</legend>
                  {disponiveis.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Crie um sistema antes de dar acesso.
                    </p>
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
              )}
            </fieldset>
            <ErroApi erro={m.error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onFechar}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={m.isPending || !email.includes("@") || senha.length < 8}
              >
                {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Criar conta
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
