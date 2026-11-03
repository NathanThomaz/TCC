import { Link, useNavigate, useBusca } from "@/lib/rotas";
import { useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { obterSistema } from "@/api/sistemas";
import type { ConfigDraft } from "@/types/nexus";
import { PASSOS, rascunhoPadrao } from "@/lib/nexus";
import { ErrorState, PageHeader } from "@/components/nexus/Estados";
import { StepIndicator } from "@/components/nexus/StepIndicator";
import {
  PassoAparencia,
  PassoAtendimentos,
  PassoCampos,
  PassoForaCatalogo,
  PassoModelo,
  PassoRegras,
  PassoRequisitos,
} from "@/components/configurar/Passos";
import { Revisao, type Resultado } from "@/components/configurar/Revisao";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function lerRascunho(chave: string): ConfigDraft | null {
  try {
    const salvo = window.sessionStorage.getItem(chave);
    return salvo ? (JSON.parse(salvo) as ConfigDraft) : null;
  } catch {
    return null;
  }
}

export function Configurar() {
  const { id = "" } = useParams();
  const passo = Math.min(8, Math.max(1, Number(useBusca().passo ?? 1) || 1));
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["sistema", id], queryFn: () => obterSistema(id) });
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const chave = `nexus:rascunho:${id}`;

  // Carrega o rascunho guardado (ou a última versão, ou o padrão) uma única vez, durante a
  // renderização (estado derivado com guarda, sem efeito em cascata).
  if (!draft && q.data) {
    setDraft(lerRascunho(chave) ?? q.data.ultimaConfig ?? rascunhoPadrao(q.data.sistema.nome));
  }

  const set = (fn: (d: ConfigDraft) => ConfigDraft) =>
    setDraft((d) => {
      if (!d) return d;
      const n = fn(d);
      window.sessionStorage.setItem(chave, JSON.stringify(n));
      setResultado(null); // conteúdo mudou: diagnóstico anterior deixa de valer
      return n;
    });

  const semAgenda = !!draft && !draft.modulos.includes("agenda");
  const irPara = (n: number) => navigate({ search: { passo: n } });
  const proximo = (dir: 1 | -1) => {
    let n = passo + dir;
    if (n === 5 && semAgenda) n += dir;
    irPara(Math.min(8, Math.max(1, n)));
  };

  const primeiro = useRef(true);
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    tituloRef.current?.focus();
  }, [passo]);

  if (q.isPending || (q.data && !draft && q.data.sistema.status === "draft"))
    return (
      <div aria-busy="true" aria-label="Carregando">
        <Skeleton className="mb-6 h-10 w-72" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  if (q.isError) return <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />;
  if (q.data.sistema.status !== "draft" || !draft)
    return (
      <div
        role="note"
        className="flex gap-3 rounded-lg border border-info/30 bg-info-soft p-4 text-sm"
      >
        <Info className="size-5 shrink-0 text-info" aria-hidden />
        <p>
          Alterar a configuração de um sistema ativo ainda não está disponível nesta versão.{" "}
          <Link to="/sistemas/$id" params={{ id }} className="font-medium text-primary underline">
            Voltar ao sistema
          </Link>
        </p>
      </div>
    );

  return (
    <>
      <Link
        to="/sistemas/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {q.data.sistema.nome}
      </Link>
      <PageHeader
        titulo="Configurar sistema"
        descricao="O rascunho é guardado automaticamente entre os passos."
      />
      <StepIndicator
        passos={PASSOS}
        atual={passo}
        desabilitados={semAgenda ? [5] : []}
        onIr={irPara}
      />

      <section className="mt-6" aria-labelledby="titulo-passo">
        <h2
          id="titulo-passo"
          ref={tituloRef}
          tabIndex={-1}
          className="mb-1 text-xl font-semibold outline-none"
        >
          <span className="text-muted-foreground tabular-nums">{passo}/8 · </span>
          {PASSOS[passo - 1]}
        </h2>
        <div className="mt-3">
          {passo === 1 && <PassoModelo draft={draft} set={set} />}
          {passo === 2 && <PassoRequisitos draft={draft} set={set} />}
          {passo === 3 && <PassoAparencia draft={draft} set={set} />}
          {passo === 4 && <PassoCampos draft={draft} set={set} />}
          {passo === 5 && <PassoAtendimentos draft={draft} set={set} />}
          {passo === 6 && <PassoRegras draft={draft} set={set} irPara={irPara} />}
          {passo === 7 && <PassoForaCatalogo draft={draft} set={set} />}
          {passo === 8 && (
            <Revisao
              sistemaId={id}
              draft={draft}
              resultado={resultado}
              setResultado={setResultado}
              irPara={irPara}
            />
          )}
        </div>
      </section>

      <div className="mt-8 flex justify-between border-t pt-4">
        <Button variant="outline" onClick={() => proximo(-1)} disabled={passo === 1}>
          <ArrowLeft aria-hidden /> Voltar
        </Button>
        {passo < 8 && (
          <Button onClick={() => proximo(1)}>
            Avançar <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </>
  );
}
