import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/rotas";
import { CheckCircle2, Loader2, Power, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { aprovarVersao, ativarSistema, salvarVersao } from "@/api/sistemas";
import type { ConfigDraft, Issue, Versao } from "@/types/nexus";
import { centavosParaReais, ROTULO_MODULO } from "@/lib/nexus";
import { IssueList } from "@/components/nexus/IssueList";
import { StatusBadge } from "@/components/nexus/StatusBadge";
import { HashCurto } from "@/components/nexus/HashCurto";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MODELO = {
  comercio: "Comércio",
  servicos: "Serviços agendados",
  comercio_com_servicos: "Comércio com serviços",
};

export interface Resultado {
  versao: Versao | null;
  issues: Issue[];
}

export function Revisao({
  sistemaId,
  draft,
  resultado,
  setResultado,
  irPara,
}: {
  sistemaId: string;
  draft: ConfigDraft;
  resultado: Resultado | null;
  setResultado: (r: Resultado | null) => void;
  irPara: (n: number) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dlgAprovar, setDlgAprovar] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [dlgAtivar, setDlgAtivar] = useState(false);

  const salvar = useMutation({
    mutationFn: () => salvarVersao(sistemaId, draft),
    onSuccess: (r) => {
      setResultado(r);
      void qc.invalidateQueries({ queryKey: ["sistema", sistemaId] });
    },
  });
  const aprovar = useMutation({
    mutationFn: (v: Versao) => aprovarVersao(sistemaId, v.id, v.hash),
    onSuccess: (v) => {
      setResultado(resultado && { ...resultado, versao: v });
      setDlgAprovar(false);
      toast.success(`Versão v${v.versao} aprovada.`);
    },
  });
  const ativar = useMutation({
    mutationFn: (v: Versao) => ativarSistema(sistemaId, v.id),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success("Sistema ativado.");
      navigate({ to: "/sistemas/$id", params: { id: sistemaId } });
    },
  });

  const bloq = resultado?.issues.filter((i) => i.severity === "bloqueante").length ?? 0;
  const avisos = (resultado?.issues.length ?? 0) - bloq;
  const v = resultado?.versao;

  const resumo: [string, string][] = [
    ["Modelo", MODELO[draft.modelo]],
    ["Módulos", draft.modulos.map((m) => ROTULO_MODULO[m]).join(", ")],
    ["Nome / título", `${draft.aparencia.nome || "—"} / ${draft.aparencia.titulo || "—"}`],
    [
      "Requisitos",
      `${draft.requisitos.length} (${draft.requisitos.filter((r) => r.status === "confirmado").length} confirmados)`,
    ],
    ["Campos informativos", String(draft.campos.length)],
    [
      "Tipos de atendimento",
      draft.modulos.includes("agenda") ? String(draft.tipos_atendimento.length) : "Não se aplica",
    ],
    [
      "Regras",
      draft.regras
        .map((r) =>
          r.tipo === "limite_atacado"
            ? `Atacado R$ ${centavosParaReais(r.valor_centavos)}`
            : r.tipo === "unidades_por_caixa"
              ? `${r.unidades} un./caixa`
              : r.tipo === "prazo_reserva"
                ? `Reserva ${r.minutos || "?"} min`
                : "Par de atendimentos",
        )
        .join(" · ") || "Nenhuma",
    ],
    ["Fora do catálogo", String(draft.fora_do_catalogo.length)],
  ];

  return (
    <div className="space-y-6">
      <dl className="divide-y rounded-xl border bg-card shadow-card">
        {resumo.map(([k, val]) => (
          <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-3">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium tabular-nums sm:col-span-2">{val}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 aria-hidden />
          )}
          Validar e salvar versão
        </Button>
        {salvar.isError && (
          <p role="alert" className="text-sm text-destructive">
            {salvar.error.message} Tente de novo.
          </p>
        )}
      </div>

      <section aria-labelledby="diag" aria-live="polite">
        {resultado && v && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h3 id="diag" className="text-lg font-semibold">
                Diagnóstico da versão <span className="tabular-nums">v{v.versao}</span>
              </h3>
              <StatusBadge status={v.status} />
              <HashCurto hash={v.hash} />
            </div>
            <p className="mb-3 text-sm text-muted-foreground tabular-nums">
              {bloq} bloqueante(s) · {avisos} aviso(s)
            </p>
            {resultado.issues.length > 0 ? (
              <IssueList issues={resultado.issues} onIr={irPara} />
            ) : (
              <p className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm">
                Nenhum problema encontrado.
              </p>
            )}

            {bloq === 0 && (
              <div className="mt-6 flex flex-wrap gap-3 rounded-xl border bg-card p-4 shadow-card">
                {v.status !== "approved" ? (
                  <Button
                    onClick={() => {
                      setAceite(false);
                      setDlgAprovar(true);
                    }}
                  >
                    <ShieldCheck aria-hidden /> Aprovar esta versão
                  </Button>
                ) : (
                  <Button onClick={() => setDlgAtivar(true)}>
                    <Power aria-hidden /> Ativar sistema
                  </Button>
                )}
                <p className="self-center text-sm text-muted-foreground">
                  {v.status !== "approved"
                    ? "A aprovação vale apenas para este conteúdo exato."
                    : "Versão aprovada. Pronta para ativar."}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <AlertDialog open={dlgAprovar} onOpenChange={setDlgAprovar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar versão {v && `v${v.versao}`}</AlertDialogTitle>
            <AlertDialogDescription>
              Hash do conteúdo:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                {v?.hash.slice(0, 8)}
              </code>
              . Qualquer alteração posterior gera uma nova versão e exige nova aprovação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-2">
            <Checkbox id="aceite" checked={aceite} onCheckedChange={(c) => setAceite(c === true)} />
            <Label htmlFor="aceite" className="font-normal leading-snug">
              Aprovo o conteúdo exato desta versão
            </Label>
          </div>
          {aprovar.isError && (
            <p role="alert" className="text-sm text-destructive">
              {aprovar.error.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!aceite || aprovar.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (v) aprovar.mutate(v);
              }}
            >
              {aprovar.isPending && <Loader2 className="animate-spin" aria-hidden />}Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dlgAtivar} onOpenChange={setDlgAtivar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar sistema?</AlertDialogTitle>
            <AlertDialogDescription>
              O sistema passa a funcionar com esta versão. Os dados reais (clientes, vendas, agenda)
              começam vazios. Alterar a configuração depois da ativação ainda não está disponível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {ativar.isError && (
            <p role="alert" className="text-sm text-destructive">
              {ativar.error.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={ativar.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (v) ativar.mutate(v);
              }}
            >
              {ativar.isPending && <Loader2 className="animate-spin" aria-hidden />}Ativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
