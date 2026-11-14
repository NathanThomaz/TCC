import { Fragment, useState } from "react";
import { CampoDinheiro } from "@/components/nexus/CampoDinheiro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Gauge, Loader2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import type { ConsumoContaDto, ConsumoDto } from "../../shared/api";
import { formatarCentavos } from "../../shared/dominio/precos";
import { definirLimite, obterConsumo } from "@/api/consumo";
import { ErroApi, Tabela } from "@/components/app/Comum";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { centavosParaReais, reaisParaCentavos } from "@/lib/nexus";
import { cn } from "@/lib/utils";

// Consumo da IA (ADR-009): só o dono do Nexus vê quanto cada conta gastou no mês, em que etapa,
// e ajusta o limite mensal de cada uma. O dono não tem limite por conta, só o teto do Nexus.

export const ETAPA: Record<ConsumoContaDto["porEtapa"][number]["finalidade"], string> = {
  levantamento: "Entrevista",
  modelagem: "Montagem do sistema",
  correcao: "Correções da IA",
  consulta: "Perguntas no sistema",
};

/** Percentual do limite usado (0 a 100); null quando não há limite. */
export function usoDoLimite(conta: Pick<ConsumoContaDto, "gastoCentavos" | "limiteCentavos">) {
  if (conta.limiteCentavos === null) return null;
  if (conta.limiteCentavos === 0) return 100;
  return Math.min(100, Math.round((conta.gastoCentavos / conta.limiteCentavos) * 100));
}

export function Consumo() {
  const { usuario } = useAuth();
  if (!usuario?.dono) {
    return (
      <>
        <PageHeader titulo="Consumo da IA" />
        <EmptyState
          icone={ShieldCheck}
          titulo="Só o dono do Nexus vê o consumo das contas"
          descricao="O uso da IA da sua conta aparece na tela inicial."
        />
      </>
    );
  }
  return <PainelConsumo />;
}

function PainelConsumo() {
  const q = useQuery({ queryKey: ["consumo"], queryFn: obterConsumo });
  const [editando, setEditando] = useState<ConsumoContaDto | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  if (q.isPending) {
    return (
      <div aria-busy="true" aria-label="Carregando">
        <Skeleton className="mb-6 h-10 w-64" />
        <Skeleton className="mb-6 h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (q.isError) return <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />;

  const d = q.data;
  const [ano, mes] = d.mes.split("-");
  return (
    <>
      <PageHeader
        titulo="Consumo da IA"
        descricao={`Mês ${mes}/${ano}. Cada conta é um administrador e as contas secundárias dele.`}
      />
      <Resumo d={d} />
      {d.contas.length === 0 ? (
        <EmptyState icone={Users} titulo="Nenhuma conta ainda" />
      ) : (
        <Tabela cabecalho={["Conta", "Sistemas", "Chamadas", "Gasto no mês", "Limite", ""]}>
          {d.contas.map((c) => (
            <Fragment key={c.id}>
              <LinhaConta
                conta={c}
                aberta={aberta === c.id}
                onAbrir={() => setAberta(aberta === c.id ? null : c.id)}
                onEditar={() => setEditando(c)}
              />
              {aberta === c.id && (
                <tr className="bg-muted/30">
                  <td colSpan={6} className="px-4 py-3">
                    <PorEtapa conta={c} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </Tabela>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Ao chegar no limite, a conversa com a IA daquela conta pausa até o mês seguinte ou até você
        ampliar o limite; o progresso fica salvo e as telas continuam funcionando.
      </p>
      {editando && (
        <EditarLimite
          conta={editando}
          padrao={d.limitePadraoCentavos}
          onFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}

function Resumo({ d }: { d: ConsumoDto }) {
  const pct = d.tetoCentavos > 0 ? Math.min(100, (d.gastoTotalCentavos / d.tetoCentavos) * 100) : 0;
  const ativas = d.contas.filter((c) => c.chamadas > 0).length;
  const cartoes: [string, string, string][] = [
    ["Gasto total no mês", formatarCentavos(d.gastoTotalCentavos), "Todas as contas"],
    ["Teto do Nexus", formatarCentavos(d.tetoCentavos), `${Math.round(pct)}% usado`],
    ["Contas que usaram a IA", String(ativas), `de ${d.contas.length} contas`],
    ["Limite padrão por conta", formatarCentavos(d.limitePadraoCentavos), "Ajustável por conta"],
  ];
  return (
    <section aria-label="Resumo do mês" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cartoes.map(([rotulo, valor, nota]) => (
        <div key={rotulo} className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-sm text-muted-foreground">{rotulo}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
          <p className="text-xs text-muted-foreground">{nota}</p>
        </div>
      ))}
    </section>
  );
}

function LinhaConta({
  conta: c,
  aberta,
  onAbrir,
  onEditar,
}: {
  conta: ConsumoContaDto;
  aberta: boolean;
  onAbrir: () => void;
  onEditar: () => void;
}) {
  const pct = usoDoLimite(c);
  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium">{c.nome ?? c.email}</p>
        <p className="text-xs text-muted-foreground">
          {c.nome ? `${c.email} · ` : ""}
          {c.dono ? "Dono do Nexus" : c.cadastro ? "Criou a conta" : "Criada por você"}
          {c.status === "disabled" && " · Desativada"}
        </p>
      </td>
      <td className="px-4 py-3 tabular-nums">{c.sistemas}</td>
      <td className="px-4 py-3 tabular-nums">{c.chamadas}</td>
      <td className="px-4 py-3 font-medium tabular-nums">{formatarCentavos(c.gastoCentavos)}</td>
      <td className="min-w-40 px-4 py-3">
        {pct === null ? (
          <span className="text-muted-foreground">Sem limite</span>
        ) : (
          <>
            <p className="text-xs tabular-nums">
              {formatarCentavos(c.limiteCentavos ?? 0)}
              {c.limitePadrao && <span className="text-muted-foreground"> (padrão)</span>}
            </p>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={`Limite usado por ${c.nome ?? c.email}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <Button variant="ghost" size="sm" onClick={onAbrir} aria-expanded={aberta}>
          Etapas
          <ChevronDown className={cn("transition-transform", aberta && "rotate-180")} aria-hidden />
        </Button>
        {!c.dono && (
          <Button variant="outline" size="sm" onClick={onEditar}>
            <Gauge aria-hidden /> Limite
          </Button>
        )}
      </td>
    </tr>
  );
}

function PorEtapa({ conta }: { conta: ConsumoContaDto }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Consumo por etapa">
      {conta.porEtapa.map((e) => (
        <li key={e.finalidade} className="rounded-lg border bg-card p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden /> {ETAPA[e.finalidade]}
          </p>
          <p className="mt-1 font-semibold tabular-nums">{formatarCentavos(e.gastoCentavos)}</p>
          <p className="text-xs text-muted-foreground">
            {e.chamadas} {e.chamadas === 1 ? "chamada" : "chamadas"}
          </p>
        </li>
      ))}
    </ul>
  );
}

function EditarLimite({
  conta,
  padrao,
  onFechar,
}: {
  conta: ConsumoContaDto;
  padrao: number;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState(centavosParaReais(conta.limiteCentavos ?? padrao));
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useMutation({
    mutationFn: (limite: number | null) => definirLimite(conta.id, limite),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["consumo"] });
      toast.success("Limite atualizado.");
      onFechar();
    },
  });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const centavos = reaisParaCentavos(texto);
    if (centavos === null || centavos > 100_000) {
      return setErro("Informe um valor entre R$ 0,00 e R$ 1.000,00.");
    }
    setErro(null);
    salvar.mutate(centavos);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <form onSubmit={enviar} noValidate>
          <DialogHeader>
            <DialogTitle>Limite mensal de IA</DialogTitle>
            <DialogDescription>
              {conta.nome ?? conta.email} gastou {formatarCentavos(conta.gastoCentavos)} neste mês.
              O padrão do Nexus é {formatarCentavos(padrao)} (cerca de {Math.round(padrao)} turnos
              de conversa).
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-2">
            <Label htmlFor="limite-conta">Limite por mês (R$)</Label>
            <CampoDinheiro
              id="limite-conta"
              valor={texto}
              onValor={setTexto}
              aria-describedby={erro ? "erro-limite" : undefined}
            />
            {erro && (
              <p id="erro-limite" role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
            <ErroApi erro={salvar.error} />
          </div>
          <DialogFooter className="gap-2">
            {!conta.limitePadrao && (
              <Button
                type="button"
                variant="ghost"
                disabled={salvar.isPending}
                onClick={() => salvar.mutate(null)}
              >
                Voltar ao padrão
              </Button>
            )}
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Salvar limite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
