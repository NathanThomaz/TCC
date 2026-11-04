import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AtendimentoDto, CamposInformativos } from "../../../shared/api";
import {
  deCampoLocal,
  ehSegundoDePar,
  FUSO,
  parDoTipo,
  paraCampoLocal,
} from "../../../shared/dominio/agenda";
import { acaoAtendimento, agendar, listarAgenda, listarPessoas } from "@/api/operacao";
import { CamposForm, ErroApi, resumoCampos, useChavePorConteudo } from "@/components/app/Comum";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusca } from "@/lib/rotas";
import { cn } from "@/lib/utils";
import { rotuloModulo, useApp } from "./Aplicacao";
import { ROTULO_STATUS, rotuloTipo } from "./VendaEditor";

// Agenda simples por profissional (seções 6 e 13), sem arrastar e soltar. Horários exibidos em
// America/Sao_Paulo (AGE-10). Início e conclusão são registrados pelo usuário (AGE-08): um
// horário passado sem registro aparece como atrasado e continua agendado (ADR-002).

const DIA = 24 * 3_600_000;
const TODOS = "__todos";

const dia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});
const hora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  hour: "2-digit",
  minute: "2-digit",
});

type Dialogo = { tipo: "agendar" } | { tipo: "remarcar" | "cancelar"; atendimento: AtendimentoDto };

export function Agenda() {
  const app = useApp();
  const busca = useBusca();
  const [profissional, setProfissional] = useState(TODOS);
  const [inicioDia, setInicioDia] = useState(() => paraCampoLocal(Date.now()).slice(0, 10));
  const [dialogo, setDialogo] = useState<Dialogo | null>(busca.venda ? { tipo: "agendar" } : null);
  // O campo de data sempre traz AAAA-MM-DD válido (vazio é ignorado no onChange).
  const de = deCampoLocal(`${inicioDia}T00:00`) ?? 1;
  const filtro = {
    de,
    ate: de + 7 * DIA,
    profissional: profissional === TODOS ? undefined : profissional,
  };
  const profissionais = useQuery({
    queryKey: ["app", app.id, "profissionais"],
    queryFn: () => listarPessoas(app.id, "profissionais"),
  });
  const q = useQuery({
    queryKey: ["app", app.id, "agenda", filtro],
    queryFn: () => listarAgenda(app.id, filtro),
  });

  const porDia = useMemo(() => {
    const grupos = new Map<string, AtendimentoDto[]>();
    for (const a of q.data ?? []) {
      const chave = dia.format(a.inicio);
      grupos.set(chave, [...(grupos.get(chave) ?? []), a]);
    }
    return [...grupos.entries()];
  }, [q.data]);

  return (
    <>
      <PageHeader
        titulo={rotuloModulo(app, "agenda")}
        descricao="Sete dias a partir da data escolhida. Horários de Brasília."
        acoes={
          <Button onClick={() => setDialogo({ tipo: "agendar" })}>
            <CalendarPlus aria-hidden /> Agendar
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="agenda-de">A partir de</Label>
          <Input
            id="agenda-de"
            type="date"
            value={inicioDia}
            onChange={(e) => e.target.value && setInicioDia(e.target.value)}
          />
        </div>
        <div className="min-w-56 space-y-1.5">
          <Label htmlFor="agenda-profissional">{rotuloModulo(app, "profissionais")}</Label>
          <Select value={profissional} onValueChange={setProfissional}>
            <SelectTrigger id="agenda-profissional">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {(profissionais.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : porDia.length === 0 ? (
        <EmptyState icone={CalendarDays} titulo="Nada agendado neste período" />
      ) : (
        <div className="space-y-6">
          {porDia.map(([nomeDia, itens]) => (
            <section key={nomeDia} aria-label={nomeDia}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">
                {nomeDia}
              </h2>
              <ul className="divide-y rounded-xl border bg-card shadow-card">
                {itens.map((a) => (
                  <LinhaAtendimento
                    key={a.id}
                    atendimento={a}
                    todos={q.data}
                    onRemarcar={() => setDialogo({ tipo: "remarcar", atendimento: a })}
                    onCancelar={() => setDialogo({ tipo: "cancelar", atendimento: a })}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {dialogo?.tipo === "agendar" && (
        <AgendarDialog
          venda={busca.venda}
          cliente={busca.cliente}
          onFechar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === "remarcar" && (
        <RemarcarDialog
          atendimento={dialogo.atendimento}
          todos={q.data ?? []}
          onFechar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === "cancelar" && (
        <CancelarDialog atendimento={dialogo.atendimento} onFechar={() => setDialogo(null)} />
      )}
    </>
  );
}

function useInvalidarAgenda() {
  const app = useApp();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["app", app.id, "agenda"] });
    void qc.invalidateQueries({ queryKey: ["app", app.id, "venda"] });
  };
}

function LinhaAtendimento({
  atendimento: a,
  todos,
  onRemarcar,
  onCancelar,
}: {
  atendimento: AtendimentoDto;
  todos: AtendimentoDto[];
  onRemarcar: () => void;
  onCancelar: () => void;
}) {
  const app = useApp();
  const invalidar = useInvalidarAgenda();
  const acao = useMutation({
    mutationFn: (qual: "iniciar" | "concluir") => acaoAtendimento(app.id, a.id, qual),
    onSuccess: () => invalidar(),
    onError: (e) => toast.error(e.message),
  });
  const primeiro =
    a.posicaoNoPar === 2 ? todos.find((x) => x.par === a.par && x.posicaoNoPar === 1) : undefined;
  // No par ainda não iniciado, remarca-se pelo primeiro (com os dois horários).
  const podeRemarcar =
    a.status === "scheduled" && !(a.posicaoNoPar === 2 && primeiro?.status === "scheduled");
  // AGE-04: o segundo do par só começa depois da conclusão registrada do primeiro.
  const podeIniciar =
    a.status === "scheduled" && (a.posicaoNoPar !== 2 || primeiro?.status === "done");

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 px-4 py-3 text-sm",
        a.status === "cancelled" && "opacity-60",
      )}
    >
      <span className="w-24 font-medium tabular-nums">
        {hora.format(a.inicio)}–{hora.format(a.fim)}
      </span>
      <span className="min-w-40 flex-1">
        <span className="font-medium">{rotuloTipo(app.config, a.tipo)}</span>
        {a.posicaoNoPar && (
          <span className="text-muted-foreground"> · {a.posicaoNoPar}º do par</span>
        )}
        <br />
        <span className="text-muted-foreground">
          {[a.nomeCliente, a.nomeProfissional, resumoCampos(app.config, "agendamentos", a.campos)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          a.atrasado ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground",
        )}
      >
        {a.atrasado ? "Atrasado" : ROTULO_STATUS[a.status]}
      </span>
      <span className="flex gap-1">
        {podeIniciar && (
          <Button
            size="sm"
            variant="outline"
            disabled={acao.isPending}
            onClick={() => acao.mutate("iniciar")}
          >
            Registrar início
          </Button>
        )}
        {a.status === "in_progress" && (
          <Button
            size="sm"
            variant="outline"
            disabled={acao.isPending}
            onClick={() => acao.mutate("concluir")}
          >
            Registrar conclusão
          </Button>
        )}
        {podeRemarcar && (
          <Button size="sm" variant="ghost" onClick={onRemarcar}>
            Remarcar
          </Button>
        )}
        {a.status === "scheduled" && (
          <Button size="sm" variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </span>
    </li>
  );
}

function AgendarDialog({
  venda,
  cliente: clienteInicial,
  onFechar,
}: {
  venda?: string | undefined;
  cliente?: string | undefined;
  onFechar: () => void;
}) {
  const app = useApp();
  const invalidar = useInvalidarAgenda();
  const chave = useChavePorConteudo();
  const tipos = app.config.tipos_atendimento.filter((t) => !ehSegundoDePar(app.config, t.id));
  const clientes = useQuery({
    queryKey: ["app", app.id, "clientes"],
    queryFn: () => listarPessoas(app.id, "clientes"),
  });
  const profissionais = useQuery({
    queryKey: ["app", app.id, "profissionais"],
    queryFn: () => listarPessoas(app.id, "profissionais"),
  });
  const [cliente, setCliente] = useState(clienteInicial ?? "");
  const [profissional, setProfissional] = useState("");
  const [tipo, setTipo] = useState(tipos[0]?.id ?? "");
  const [inicio, setInicio] = useState("");
  const [inicioSegundo, setInicioSegundo] = useState("");
  const [campos, setCampos] = useState<CamposInformativos>({});
  const par = parDoTipo(app.config, tipo);

  const m = useMutation({
    mutationFn: () => {
      const i = deCampoLocal(inicio);
      const s = par ? deCampoLocal(inicioSegundo) : null;
      if (i === null || (par && s === null)) throw new Error("Informe data e hora.");
      const dados = {
        cliente,
        profissional,
        tipo,
        inicio: i,
        ...(s !== null ? { inicioSegundo: s } : {}),
        ...(venda ? { venda } : {}),
        campos,
      };
      return agendar(app.id, dados, chave(dados));
    },
    onSuccess: () => {
      invalidar();
      toast.success(par ? "Par agendado." : "Atendimento agendado.");
      onFechar();
    },
  });

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Agendar</DialogTitle>
            <DialogDescription>
              {venda ? "Vinculado à venda aberta. " : ""}O profissional não pode ter dois
              atendimentos no mesmo horário.
            </DialogDescription>
          </DialogHeader>
          <Escolha
            id="agendar-cliente"
            rotulo="Cliente"
            valor={cliente}
            onChange={setCliente}
            opcoes={(clientes.data ?? [])
              .filter((c) => c.status === "active")
              .map((c) => [c.id, c.nome])}
          />
          <Escolha
            id="agendar-profissional"
            rotulo={rotuloModulo(app, "profissionais")}
            valor={profissional}
            onChange={setProfissional}
            opcoes={(profissionais.data ?? [])
              .filter((p) => p.status === "active")
              .map((p) => [p.id, p.nome])}
          />
          <Escolha
            id="agendar-tipo"
            rotulo="Atendimento"
            valor={tipo}
            onChange={setTipo}
            opcoes={tipos.map((t) => [t.id, `${t.rotulo} (${t.duracao_minutos} min)`])}
          />
          <div className="space-y-1.5">
            <Label htmlFor="agendar-inicio">Início</Label>
            <Input
              id="agendar-inicio"
              type="datetime-local"
              value={inicio}
              required
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          {par && (
            <div className="space-y-1.5">
              <Label htmlFor="agendar-segundo">
                Início de {rotuloTipo(app.config, par.segundo)} (mesmo profissional)
              </Label>
              <Input
                id="agendar-segundo"
                type="datetime-local"
                value={inicioSegundo}
                required
                onChange={(e) => setInicioSegundo(e.target.value)}
              />
            </div>
          )}
          <CamposForm
            config={app.config}
            entidade="agendamentos"
            valores={campos}
            onChange={setCampos}
            prefixo="agendar"
          />
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending || !cliente || !profissional || !tipo}>
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Agendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Escolha({
  id,
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: [string, string][];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Escolha" />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map(([v, r]) => (
            <SelectItem key={v} value={v}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** AGE-07: revalida os horários; se houver conflito, nada muda. */
function RemarcarDialog({
  atendimento: a,
  todos,
  onFechar,
}: {
  atendimento: AtendimentoDto;
  todos: AtendimentoDto[];
  onFechar: () => void;
}) {
  const app = useApp();
  const invalidar = useInvalidarAgenda();
  const segundo =
    a.posicaoNoPar === 1 ? todos.find((x) => x.par === a.par && x.posicaoNoPar === 2) : undefined;
  const [inicio, setInicio] = useState(paraCampoLocal(a.inicio));
  const [inicioSegundo, setInicioSegundo] = useState(segundo ? paraCampoLocal(segundo.inicio) : "");
  const m = useMutation({
    mutationFn: () => {
      const i = deCampoLocal(inicio);
      const s = segundo ? deCampoLocal(inicioSegundo) : null;
      if (i === null || (segundo && s === null)) throw new Error("Informe data e hora.");
      return acaoAtendimento(app.id, a.id, "remarcar", {
        inicio: i,
        ...(s !== null ? { inicioSegundo: s } : {}),
      });
    },
    onSuccess: () => {
      invalidar();
      toast.success("Remarcado.");
      onFechar();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Remarcar {rotuloTipo(app.config, a.tipo)}</DialogTitle>
            <DialogDescription>
              A duração registrada é mantida. Em caso de conflito, os horários atuais ficam como
              estão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="remarcar-inicio">Novo início</Label>
            <Input
              id="remarcar-inicio"
              type="datetime-local"
              value={inicio}
              required
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          {segundo && (
            <div className="space-y-1.5">
              <Label htmlFor="remarcar-segundo">
                Novo início de {rotuloTipo(app.config, segundo.tipo)}
              </Label>
              <Input
                id="remarcar-segundo"
                type="datetime-local"
                value={inicioSegundo}
                required
                onChange={(e) => setInicioSegundo(e.target.value)}
              />
            </div>
          )}
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Voltar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Remarcar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** AGE-09: no par ainda não iniciado, cancela os dois. */
function CancelarDialog({
  atendimento: a,
  onFechar,
}: {
  atendimento: AtendimentoDto;
  onFechar: () => void;
}) {
  const app = useApp();
  const invalidar = useInvalidarAgenda();
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: () => acaoAtendimento(app.id, a.id, "cancelar", { motivo: motivo.trim() }),
    onSuccess: () => {
      invalidar();
      toast.success(a.par ? "Par cancelado." : "Atendimento cancelado.");
      onFechar();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Cancelar {rotuloTipo(app.config, a.tipo)}</DialogTitle>
            <DialogDescription>
              {a.par
                ? "Os dois atendimentos do par são cancelados juntos."
                : "O atendimento fica no histórico como cancelado."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancelar-atendimento-motivo">Motivo</Label>
            <Input
              id="cancelar-atendimento-motivo"
              value={motivo}
              minLength={3}
              maxLength={300}
              required
              autoFocus
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={m.isPending || motivo.trim().length < 3}
            >
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
