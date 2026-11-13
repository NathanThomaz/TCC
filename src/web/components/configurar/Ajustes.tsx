import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, CircleCheck, Lightbulb, Loader2, Wrench } from "lucide-react";
import { campoNativoDuplicado, normalizarRotulo } from "../../../shared/contract/catalog";
import { criarPedido, listarPedidos } from "@/api/pedidos";
import { ErroApi, useChavePorConteudo } from "@/components/app/Comum";
import { EstadoPedido } from "@/components/criacao/Pedido";
import {
  LimiteAtacado,
  PassoAparencia,
  PassoAtendimentos,
  PassoCampos,
  type PassoProps,
} from "@/components/configurar/Passos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Regra } from "@/types/nexus";
import { RegrasCatalogo } from "@/components/configurar/RegrasCatalogo";
import { ModulosOpcionais } from "@/components/configurar/ModulosOpcionais";
import { OPCIONAIS_POR_MODELO, ROTULO_MODULO } from "@/lib/nexus";
import { cn } from "@/lib/utils";

// Modo avançado, passo 2 (ADR-004): um bloco por módulo, com os padrões do modelo já preenchidos
// e marcados "Sugestão — confirme" até o dono confirmar ou mudar. Não há requisitos na tela: cada
// ajuste vira, por trás, o requisito e a regra que o validador exige.

/** Regras de valor único que entram com valor sugerido; o dono confirma ou muda. */
export type Sugerivel = "limite_atacado" | "unidades_por_caixa" | "prazo_reserva";
/** Qualquer regra pode estar marcada como sugestão (as do catálogo entram assim). */
export type Sugerida = Regra["tipo"];

/** Valores sugeridos pelo modelo: só valem depois que o dono confirma ou muda. */
export const PADRAO: Record<Sugerivel, Regra> = {
  limite_atacado: { tipo: "limite_atacado", valor_centavos: 100000, requisitos: [] },
  unidades_por_caixa: { tipo: "unidades_por_caixa", unidades: 12, requisitos: [] },
  prazo_reserva: { tipo: "prazo_reserva", minutos: 120, requisitos: [] },
};

/** O que ainda impede avançar do passo de ajustes (mensagens em linguagem de negócio). */
export function pendenciasDosAjustes(d: PassoProps["draft"], sugestoes: Sugerida[]): string[] {
  const faltas: string[] = [];
  const regra = <T extends Regra["tipo"]>(t: T) =>
    d.regras.find((r): r is Extract<Regra, { tipo: T }> => r.tipo === t);
  if (d.modulos.includes("vendas") && !((regra("prazo_reserva")?.minutos ?? 0) >= 1)) {
    faltas.push("Diga por quanto tempo um pedido aberto segura o estoque.");
  }
  const atacado = regra("limite_atacado");
  if (atacado && !(atacado.valor_centavos > 0)) faltas.push("Informe o valor do atacado.");
  const duplicados = d.campos.filter(
    (c) =>
      campoNativoDuplicado(c.entidade, c.rotulo, d.modulos) ||
      d.campos.some(
        (x) =>
          x.id !== c.id &&
          x.entidade === c.entidade &&
          normalizarRotulo(x.rotulo) === normalizarRotulo(c.rotulo),
      ),
  );
  if (duplicados.length) {
    faltas.push("Há campo extra que repete um campo que já existe; renomeie ou remova.");
  }
  const formas = regra("formas_pagamento");
  if (d.modulos.includes("pagamentos")) {
    if (!formas?.formas.length) faltas.push("Escolha ao menos uma forma de pagamento.");
    else if (formas.formas.includes("a_prazo") && !((formas.prazo_dias ?? 0) >= 1)) {
      faltas.push("Diga em quantos dias vence a venda a prazo.");
    }
  }
  if (d.modulos.includes("agenda") && d.tipos_atendimento.length === 0) {
    faltas.push("Cadastre ao menos um tipo de atendimento.");
  }
  if (sugestoes.length) {
    faltas.push(
      `Confirme ${sugestoes.length === 1 ? "1 sugestão" : `${sugestoes.length} sugestões`} ou mude o valor.`,
    );
  }
  return faltas;
}

function Selo({ sugestao, onConfirmar }: { sugestao: boolean; onConfirmar: () => void }) {
  return sugestao ? (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
        <Lightbulb className="size-4" aria-hidden /> Sugestão — confirme
      </span>
      <Button variant="outline" size="sm" onClick={onConfirmar}>
        Confirmar
      </Button>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2 py-1 text-xs text-success">
      <CircleCheck className="size-4" aria-hidden /> Você definiu
    </span>
  );
}

function Secao({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  resumo: string;
  children: ReactNode;
}) {
  return (
    <details open className="group rounded-lg border bg-card shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{titulo}</span>
          <span className="block text-sm text-muted-foreground">{resumo}</span>
        </span>
        <ChevronDown
          className="size-5 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-5 border-t p-4">{children}</div>
    </details>
  );
}

export function PassoAjustes({
  draft,
  set,
  sistemaId,
  sugestoes,
  setSugestoes,
}: PassoProps & {
  sistemaId: string;
  sugestoes: Sugerida[];
  setSugestoes: (s: Sugerida[]) => void;
}) {
  const regra = <T extends Regra["tipo"]>(t: T) =>
    draft.regras.find((r): r is Extract<Regra, { tipo: T }> => r.tipo === t);
  const definir = (tipo: Regra["tipo"], nova: Regra | null) =>
    set((d) => ({
      ...d,
      regras: [...d.regras.filter((r) => r.tipo !== tipo), ...(nova ? [nova] : [])],
    }));
  const confirmar = (t: Sugerivel) => setSugestoes(sugestoes.filter((s) => s !== t));
  /** Mudar o valor é decidir: deixa de ser sugestão. */
  const mudar = (t: Sugerivel, nova: Regra) => {
    definir(t, nova);
    confirmar(t);
  };
  const ligar = (t: Sugerivel, ligado: boolean) => {
    definir(t, ligado ? PADRAO[t] : null);
    setSugestoes(
      ligado ? [...sugestoes.filter((s) => s !== t), t] : sugestoes.filter((s) => s !== t),
    );
  };

  const temVendas = draft.modulos.includes("vendas");
  const temAgenda = draft.modulos.includes("agenda");
  const atacado = regra("limite_atacado");
  const caixa = regra("unidades_por_caixa");
  const reserva = regra("prazo_reserva");
  const par = regra("par_atendimento");
  const sugerido = (t: Sugerivel) => sugestoes.includes(t);

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Os valores comuns já vêm preenchidos como sugestão. Confirme ou mude cada um; o que você
        precisar e não estiver aqui vira um pedido ao desenvolvedor.
      </p>

      {OPCIONAIS_POR_MODELO[draft.modelo].length > 0 && (
        <Secao
          titulo="Módulos opcionais"
          resumo={(() => {
            const ligados = OPCIONAIS_POR_MODELO[draft.modelo].filter((m) =>
              draft.modulos.includes(m),
            );
            return ligados.length
              ? `Ligados: ${ligados.map((m) => ROTULO_MODULO[m]).join(", ")}`
              : "Nenhum ligado — ligue o que o negócio usa";
          })()}
        >
          <ModulosOpcionais
            draft={draft}
            set={set}
            sugerido={sugestoes.includes("formas_pagamento")}
            onSugerir={(ligado) =>
              setSugestoes(
                ligado
                  ? [...sugestoes.filter((s) => s !== "formas_pagamento"), "formas_pagamento"]
                  : sugestoes.filter((s) => s !== "formas_pagamento"),
              )
            }
            onConfirmar={() => setSugestoes(sugestoes.filter((s) => s !== "formas_pagamento"))}
          />
        </Secao>
      )}

      {temVendas && (
        <Secao
          titulo="Vendas e estoque"
          resumo={
            sugestoes.length
              ? `${sugestoes.length} ${sugestoes.length === 1 ? "sugestão" : "sugestões"} para confirmar`
              : "Tudo confirmado"
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                id="aj-atacado"
                checked={!!atacado}
                onCheckedChange={(v) => ligar("limite_atacado", v)}
              />
              <Label htmlFor="aj-atacado">Vender no atacado</Label>
            </div>
            {atacado && (
              <div className="max-w-xs space-y-2 pl-1">
                <LimiteAtacado
                  id="aj-atacado-valor"
                  valor={atacado.valor_centavos}
                  onChange={(c) => mudar("limite_atacado", { ...atacado, valor_centavos: c })}
                />
                <Selo
                  sugestao={sugerido("limite_atacado")}
                  onConfirmar={() => confirmar("limite_atacado")}
                />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                id="aj-caixa"
                checked={!!caixa}
                onCheckedChange={(v) => ligar("unidades_por_caixa", v)}
              />
              <Label htmlFor="aj-caixa">Vende por caixa</Label>
            </div>
            {caixa && (
              <div className="max-w-xs space-y-2 pl-1">
                <Label htmlFor="aj-caixa-un">Unidades por caixa (2 a 1000)</Label>
                <Input
                  id="aj-caixa-un"
                  type="number"
                  min={2}
                  max={1000}
                  className="tabular-nums"
                  value={Number.isFinite(caixa.unidades) ? caixa.unidades : ""}
                  onChange={(e) =>
                    mudar("unidades_por_caixa", { ...caixa, unidades: e.target.valueAsNumber })
                  }
                />
                <Selo
                  sugestao={sugerido("unidades_por_caixa")}
                  onConfirmar={() => confirmar("unidades_por_caixa")}
                />
              </div>
            )}
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="aj-reserva">Pedido aberto segura o estoque por (minutos)</Label>
            <Input
              id="aj-reserva"
              type="number"
              min={1}
              className="tabular-nums"
              placeholder="Ex.: 120"
              value={reserva && reserva.minutos > 0 ? reserva.minutos : ""}
              onChange={(e) =>
                mudar("prazo_reserva", {
                  tipo: "prazo_reserva",
                  minutos: e.target.valueAsNumber || 0,
                  requisitos: [],
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Enquanto o pedido está aberto, o estoque fica reservado para ele. Obrigatório com
              vendas.
            </p>
            {reserva && (
              <Selo
                sugestao={sugerido("prazo_reserva")}
                onConfirmar={() => confirmar("prazo_reserva")}
              />
            )}
          </div>
        </Secao>
      )}

      <Secao titulo="Informações extras" resumo={`${draft.campos.length} campo(s) a mais`}>
        <PassoCampos draft={draft} set={set} />
      </Secao>

      {temAgenda && (
        <Secao
          titulo="Agenda"
          resumo={`${draft.tipos_atendimento.length} tipo(s) de atendimento${par ? " · em par" : ""}`}
        >
          <PassoAtendimentos
            draft={draft}
            set={(fn) =>
              // Apagar um tipo usado no par tira o par junto (senão sobra referência inexistente).
              set((d) => {
                const n = fn(d);
                const ids = new Set(n.tipos_atendimento.map((t) => t.id));
                return {
                  ...n,
                  regras: n.regras.filter(
                    (r) =>
                      r.tipo !== "par_atendimento" || (ids.has(r.primeiro) && ids.has(r.segundo)),
                  ),
                };
              })
            }
          />
          {draft.tipos_atendimento.length >= 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="aj-par"
                  checked={!!par}
                  onCheckedChange={(v) =>
                    definir(
                      "par_atendimento",
                      v
                        ? {
                            tipo: "par_atendimento",
                            primeiro: draft.tipos_atendimento[0]!.id,
                            segundo: draft.tipos_atendimento[1]!.id,
                            requisitos: [],
                          }
                        : null,
                    )
                  }
                />
                <Label htmlFor="aj-par">
                  Atendimentos em par (o segundo logo depois, mesmo profissional)
                </Label>
              </div>
              {par && (
                <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                  {(["primeiro", "segundo"] as const).map((k) => (
                    <div key={k}>
                      <Label>{k === "primeiro" ? "Primeiro" : "Segundo"}</Label>
                      <Select
                        value={par[k]}
                        onValueChange={(v) => definir("par_atendimento", { ...par, [k]: v })}
                      >
                        <SelectTrigger
                          className="mt-1"
                          aria-label={k === "primeiro" ? "Primeiro" : "Segundo"}
                        >
                          <SelectValue placeholder="Escolha" />
                        </SelectTrigger>
                        <SelectContent>
                          {draft.tipos_atendimento.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.rotulo || "Sem nome"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {par.primeiro === par.segundo && (
                    <p className="text-xs text-destructive sm:col-span-2">
                      Escolha atendimentos diferentes.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Secao>
      )}

      <Secao
        titulo="Mais regras do negócio"
        resumo={(() => {
          const n = draft.regras.filter(
            (r) =>
              ![
                "limite_atacado",
                "unidades_por_caixa",
                "prazo_reserva",
                "par_atendimento",
                "formas_pagamento",
              ].includes(r.tipo),
          ).length;
          return n
            ? `${n} ${n === 1 ? "regra escolhida" : "regras escolhidas"}`
            : "Escolha regras prontas no menu";
        })()}
      >
        <RegrasCatalogo draft={draft} set={set} sugestoes={sugestoes} setSugestoes={setSugestoes} />
      </Secao>

      <Secao titulo="Aparência" resumo={draft.aparencia.titulo || "Sem título"}>
        <PassoAparencia draft={draft} set={set} />
      </Secao>

      <PedidoAoDesenvolvedor sistemaId={sistemaId} />
    </div>
  );
}

/** "Precisa de algo que não está aqui?": vira pedido ao desenvolvedor, com as palavras do dono. */
function PedidoAoDesenvolvedor({ sistemaId }: { sistemaId: string }) {
  const qc = useQueryClient();
  const pedidos = useQuery({
    queryKey: ["pedidos", sistemaId],
    queryFn: () => listarPedidos(sistemaId),
  });
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  // Mesma chave enquanto o pedido não mudar: repetir depois de uma falha não o duplica; depois de
  // um sucesso, registrar de novo (mesmo igual) é outra intenção.
  const chave = useChavePorConteudo();
  const [enviados, setEnviados] = useState(0);
  const m = useMutation({
    mutationFn: () => {
      const corpo = { titulo: titulo.trim(), pedido: texto.trim() };
      return criarPedido(sistemaId, corpo.titulo, corpo.pedido, chave({ ...corpo, enviados }));
    },
    onSuccess: () => {
      setTitulo("");
      setTexto("");
      setEnviados((n) => n + 1);
      void qc.invalidateQueries({ queryKey: ["pedidos", sistemaId] });
    },
  });
  const valido = titulo.trim().length >= 3 && texto.trim().length >= 3;
  return (
    <section
      aria-labelledby="titulo-pedido-dev"
      className="rounded-lg border border-info/30 bg-info-soft p-4"
    >
      <h3 id="titulo-pedido-dev" className="flex items-center gap-2 font-semibold">
        <Wrench className="size-5 text-info" aria-hidden /> Precisa de algo que não está aqui?
      </h3>
      <p className="mt-1 text-sm">
        Descreva com as suas palavras. Vira um pedido ao desenvolvedor, sem prazo definido; você
        acompanha em Pedidos ao desenvolvedor.
      </p>
      <form
        className="mt-3 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) m.mutate();
        }}
      >
        <div>
          <Label htmlFor="pedido-titulo">Título</Label>
          <Input
            id="pedido-titulo"
            className="mt-1 bg-card"
            maxLength={120}
            placeholder="Ex.: Desconto para cliente fiel"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pedido-texto">O que você precisa</Label>
          <Textarea
            id="pedido-texto"
            className="mt-1 bg-card"
            maxLength={2000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          className="justify-self-start"
          disabled={!valido || m.isPending}
        >
          {m.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Registrar pedido
        </Button>
        <ErroApi erro={m.error} />
      </form>
      {(pedidos.data?.length ?? 0) > 0 && (
        <ul className={cn("mt-4 space-y-2 border-t border-info/30 pt-3")}>
          {pedidos.data!.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
              {p.titulo} <EstadoPedido estado={p.estado} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
