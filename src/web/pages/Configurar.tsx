import { Link, useNavigate, useBusca } from "@/lib/rotas";
import { useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bot, Info } from "lucide-react";
import { obterSistema } from "@/api/sistemas";
import type { ConfigDraft } from "@/types/nexus";
import { comRequisitosGerados, PASSOS, rascunhoPadrao, reconciliarModelo } from "@/lib/nexus";
import { ErrorState, PageHeader } from "@/components/nexus/Estados";
import { StepIndicator } from "@/components/nexus/StepIndicator";
import { PassoModelo } from "@/components/configurar/Passos";
import {
  PADRAO,
  PassoAjustes,
  pendenciasDosAjustes,
  type Sugerida,
  type Sugerivel,
} from "@/components/configurar/Ajustes";
import { Revisao, type Resultado } from "@/components/configurar/Revisao";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Modo avançado (ADR-004): o dono configura sozinho em 3 passos — modelo, ajustes dos módulos com
// os padrões do modelo marcados como sugestão, e revisão pelo mesmo validador da conversa.

function ler<T>(chave: string): T | null {
  try {
    const salvo = window.sessionStorage.getItem(chave);
    return salvo ? (JSON.parse(salvo) as T) : null;
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    window.sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento (aba privada): o rascunho só vive enquanto a tela estiver aberta.
  }
}

/** Com vendas, o prazo de reserva é obrigatório: começa com o valor sugerido, para confirmar. */
function comPadroes(d: ConfigDraft): { draft: ConfigDraft; sugestoes: Sugerivel[] } {
  if (!d.modulos.includes("vendas") || d.regras.some((r) => r.tipo === "prazo_reserva")) {
    return { draft: d, sugestoes: [] };
  }
  return {
    draft: { ...d, regras: [...d.regras, PADRAO.prazo_reserva] },
    sugestoes: ["prazo_reserva"],
  };
}

export function Configurar() {
  const { id = "" } = useParams();
  const passo = Math.min(PASSOS.length, Math.max(1, Number(useBusca().passo ?? 1) || 1));
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["sistema", id], queryFn: () => obterSistema(id) });
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const [sugestoes, setSugestoesEstado] = useState<Sugerida[]>([]);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // Versão ativa no início da alteração (ADR-008): fixada uma vez, para outra troca no meio ser
  // detectada ao aplicar, mesmo que a tela recarregue os dados do sistema.
  const [versaoBase, setVersaoBase] = useState<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const ativo = q.data?.sistema.status === "active";
  // Alteração de sistema ativo (ADR-008) guarda o rascunho à parte da criação.
  const chave = `nexus:${ativo ? "alteracao" : "rascunho"}:${id}`;
  const chaveSugestoes = `nexus:${ativo ? "alteracao-sugestoes" : "sugestoes"}:${id}`;
  // Módulos já em uso no sistema ativo: não podem ser desligados (há dados ligados a eles).
  const travados = ativo ? (q.data?.ultimaConfig?.modulos ?? []) : [];

  // Carrega o rascunho guardado (ou a última versão, ou o padrão) uma única vez, durante a
  // renderização (estado derivado com guarda, sem efeito em cascata).
  if (!draft && q.data) {
    setVersaoBase(q.data.sistema.versaoAtiva);
    const salvo = ler<ConfigDraft>(chave);
    if (salvo) {
      setDraft(salvo);
      setSugestoesEstado(ler<Sugerida[]>(chaveSugestoes) ?? []);
    } else {
      const inicial = comPadroes(q.data.ultimaConfig ?? rascunhoPadrao(q.data.sistema.nome));
      setDraft(inicial.draft);
      setSugestoesEstado(inicial.sugestoes);
      // Grava rascunho e sugestões juntos: recarregar depois de mexer em outro ajuste não pode
      // transformar a sugestão inicial em valor "definido" pelo dono.
      gravar(chave, inicial.draft);
      gravar(chaveSugestoes, inicial.sugestoes);
    }
  }

  const set = (fn: (d: ConfigDraft) => ConfigDraft) =>
    setDraft((d) => {
      if (!d) return d;
      const n = fn(d);
      gravar(chave, n);
      setResultado(null); // conteúdo mudou: diagnóstico anterior deixa de valer
      return n;
    });
  const setSugestoes = (s: Sugerida[]) => {
    setSugestoesEstado(s);
    gravar(chaveSugestoes, s);
  };

  const irPara = (n: number) => navigate({ search: { passo: n } });
  const primeiro = useRef(true);
  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    tituloRef.current?.focus();
  }, [passo]);

  if (q.isPending || (q.data && !draft && q.data.sistema.status !== "archived"))
    return (
      <div aria-busy="true" aria-label="Carregando">
        <Skeleton className="mb-6 h-10 w-72" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  if (q.isError) return <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />;
  if (q.data.sistema.status === "archived" || !draft)
    return (
      <div
        role="note"
        className="flex gap-3 rounded-lg border border-info/30 bg-info-soft p-4 text-sm"
      >
        <Info className="size-5 shrink-0 text-info" aria-hidden />
        <p>
          Este sistema está arquivado e não pode ser configurado.{" "}
          <Link to="/sistemas/$id" params={{ id }} className="font-medium text-primary underline">
            Voltar ao sistema
          </Link>
        </p>
      </div>
    );

  const pendentes = pendenciasDosAjustes(draft, sugestoes);
  const faltas = passo === 2 ? pendentes : [];
  // Trocar o modelo tira regras de módulos que saíram (com as sugestões delas) e, se entrar
  // vendas, traz o prazo de reserva como sugestão.
  const trocarModelo = (fn: (d: ConfigDraft) => ConfigDraft) => {
    const r = comPadroes(reconciliarModelo(fn(draft)));
    const ficam = sugestoes.filter((s) => r.draft.regras.some((x) => x.tipo === s));
    set(() => r.draft);
    setSugestoes([...new Set([...ficam, ...r.sugestoes])]);
  };

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
        titulo={ativo ? "Alterar sistema" : "Configurar sozinho"}
        descricao={
          ativo
            ? "Inclua módulos, mude regras, campos e nomes. Os dados continuam; as telas usam a versão nova assim que você aplicar."
            : "Modo avançado: escolha o modelo, ajuste os módulos e revise. O rascunho é guardado entre os passos."
        }
        acoes={
          ativo ? undefined : (
            <Button asChild variant="outline">
              <Link to="/sistemas/$id/criar" params={{ id }}>
                <Bot aria-hidden /> Conversar com o assistente
              </Link>
            </Button>
          )
        }
      />
      <StepIndicator
        passos={PASSOS}
        atual={passo}
        desabilitados={pendentes.length ? [3] : []}
        onIr={irPara}
      />

      <section className="mt-6" aria-labelledby="titulo-passo">
        <h2
          id="titulo-passo"
          ref={tituloRef}
          tabIndex={-1}
          className="mb-1 text-xl font-semibold outline-none"
        >
          <span className="text-muted-foreground tabular-nums">
            {passo}/{PASSOS.length} ·{" "}
          </span>
          {PASSOS[passo - 1]}
        </h2>
        <div className="mt-3">
          {passo === 1 && <PassoModelo draft={draft} set={trocarModelo} travado={ativo} />}
          {passo === 2 && (
            <PassoAjustes
              draft={draft}
              set={set}
              sistemaId={id}
              sugestoes={sugestoes}
              setSugestoes={setSugestoes}
              travados={travados}
            />
          )}
          {passo === 3 && (
            <Revisao
              sistemaId={id}
              draft={comRequisitosGerados(draft)}
              resultado={resultado}
              setResultado={setResultado}
              irPara={irPara}
              alteracao={ativo}
              chavesLocais={[chave, chaveSugestoes]}
              versaoBase={versaoBase}
            />
          )}
        </div>
      </section>

      {faltas.length > 0 && (
        <ul
          role="status"
          className="mt-6 space-y-1 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm"
        >
          {faltas.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex justify-between border-t pt-4">
        <Button variant="outline" onClick={() => irPara(passo - 1)} disabled={passo === 1}>
          <ArrowLeft aria-hidden /> Voltar
        </Button>
        {passo < PASSOS.length && (
          <Button onClick={() => irPara(passo + 1)} disabled={faltas.length > 0}>
            Avançar <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </>
  );
}
