import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/rotas";
import { CheckCircle2, Loader2, Power, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { novaChave } from "@/api/cliente";
import { aprovarVersao, ativarSistema, salvarVersao } from "@/api/sistemas";
import type { ConfigDraft, Issue, Versao } from "@/types/nexus";
import { ROTULO_MODULO, textoDaRegra } from "@/lib/nexus";
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
  /** Rascunho exato que gerou este diagnóstico (JSON); outro conteúdo = diagnóstico vencido. */
  conteudo: string;
}

export function Revisao({
  sistemaId,
  draft,
  resultado,
  setResultado,
  irPara,
  alteracao = false,
  chavesLocais = [],
}: {
  sistemaId: string;
  draft: ConfigDraft;
  resultado: Resultado | null;
  setResultado: (r: Resultado | null) => void;
  irPara: (n: number) => void;
  /** Sistema já ativo (ADR-008): "Aplicar alterações" em vez de "Ativar". */
  alteracao?: boolean;
  /** Rascunho guardado no navegador, apagado depois de aplicar. */
  chavesLocais?: string[];
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dlgAprovar, setDlgAprovar] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [dlgAtivar, setDlgAtivar] = useState(false);

  const conteudoAtual = JSON.stringify(draft);
  const atualRef = useRef(conteudoAtual);
  useEffect(() => {
    atualRef.current = conteudoAtual;
  }, [conteudoAtual]);
  // Mesma chave de idempotência enquanto o conteúdo for o mesmo: um retry (ou um clique repetido
  // após resposta perdida) não cria outra versão; conteúdo novo, chave nova.
  const chaveRef = useRef<{ conteudo: string; chave: string } | null>(null);

  const salvar = useMutation({
    mutationFn: async (conteudo: string) => {
      if (chaveRef.current?.conteudo !== conteudo)
        chaveRef.current = { conteudo, chave: novaChave() };
      const r = await salvarVersao(
        sistemaId,
        JSON.parse(conteudo) as ConfigDraft,
        chaveRef.current.chave,
      );
      return { ...r, conteudo };
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["sistema", sistemaId] });
      // Resposta de um rascunho que já mudou é descartada (não pode virar aprovação).
      if (r.conteudo === atualRef.current) setResultado(r);
    },
  });
  const vigente = resultado && resultado.conteudo === conteudoAtual ? resultado : null;
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
      if (alteracao) {
        for (const k of chavesLocais) {
          try {
            localStorage.removeItem(k);
          } catch {
            // Sem armazenamento local: nada a apagar.
          }
        }
        toast.success("Alterações aplicadas. As telas já usam a versão nova.");
        navigate({ to: "/sistemas/$id/app", params: { id: sistemaId } });
        return;
      }
      toast.success("Sistema ativado.");
      navigate({ to: "/sistemas/$id", params: { id: sistemaId } });
    },
  });

  const bloq = vigente?.issues.filter((i) => i.severity === "bloqueante").length ?? 0;
  const avisos = (vigente?.issues.length ?? 0) - bloq;
  const v = vigente?.versao;

  const resumo: [string, string][] = [
    ["Modelo", MODELO[draft.modelo]],
    ["Módulos", draft.modulos.map((m) => ROTULO_MODULO[m]).join(", ")],
    ["Nome / título", `${draft.aparencia.nome || "—"} / ${draft.aparencia.titulo || "—"}`],
    ["Informações extras", String(draft.campos.length)],
    [
      "Tipos de atendimento",
      draft.modulos.includes("agenda") ? String(draft.tipos_atendimento.length) : "Não se aplica",
    ],
    ["Regras", draft.regras.map((r) => textoDaRegra(r, draft)).join(" · ") || "Nenhuma"],
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
        <Button onClick={() => salvar.mutate(conteudoAtual)} disabled={salvar.isPending}>
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
        {vigente && !v && (
          <>
            <h3 id="diag" className="mb-1 text-lg font-semibold">
              Diagnóstico (versão não gravada)
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              A estrutura do rascunho tem erros; corrija os itens abaixo e valide de novo.
            </p>
            <IssueList issues={vigente.issues} onIr={irPara} />
          </>
        )}
        {vigente && v && (
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
            {vigente.issues.length > 0 ? (
              <IssueList issues={vigente.issues} onIr={irPara} />
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
                    <Power aria-hidden /> {alteracao ? "Aplicar alterações" : "Ativar sistema"}
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
              Código de conferência:{" "}
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
            <AlertDialogTitle>
              {alteracao ? "Aplicar as alterações?" : "Ativar sistema?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alteracao
                ? "As telas passam a usar esta versão na hora. Os dados que já existem (clientes, vendas, estoque, agenda) continuam."
                : "O sistema passa a funcionar com esta versão. Os dados reais (clientes, vendas, agenda) começam vazios. Depois, você pode alterar o sistema quando quiser."}
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
