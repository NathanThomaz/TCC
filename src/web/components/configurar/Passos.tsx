import type { ReactNode } from "react";
import { AlertTriangle, Ban, Briefcase, Check, Plus, Scissors, Store, Trash2 } from "lucide-react";
import type { Campo, ConfigDraft, Modelo, Regra } from "@/types/nexus";
import { hexValido, textoSobre } from "@/lib/cores";
import {
  centavosParaReais,
  entidadesDosModulos,
  MODULOS_POR_MODELO,
  novoId,
  proximoIdRequisito,
  reaisParaCentavos,
  ROTULO_ENTIDADE,
  ROTULO_MODULO,
  type Entidade,
} from "@/lib/nexus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PassoProps {
  draft: ConfigDraft;
  set: (fn: (d: ConfigDraft) => ConfigDraft) => void;
}

export function Explicacao({ children }: { children: ReactNode }) {
  return <p className="mb-5 max-w-2xl text-sm text-muted-foreground">{children}</p>;
}

function Erro({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {children}
    </p>
  );
}

function Bloco({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-card", className)}>{children}</div>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/* 1. Modelo */
const MODELOS: { id: Modelo; nome: string; desc: string; Icone: typeof Store }[] = [
  {
    id: "comercio",
    nome: "Comércio",
    desc: "Para quem vende produtos e controla estoque.",
    Icone: Store,
  },
  {
    id: "servicos",
    nome: "Serviços agendados",
    desc: "Para quem atende com hora marcada.",
    Icone: Scissors,
  },
  {
    id: "comercio_com_servicos",
    nome: "Comércio com serviços",
    desc: "Venda de produtos e atendimentos agendados.",
    Icone: Briefcase,
  },
];

export function PassoModelo({ draft, set }: PassoProps) {
  return (
    <>
      <Explicacao>
        O modelo define quais módulos o sistema terá. Os módulos não podem ser editados
        individualmente nesta versão.
      </Explicacao>
      <div role="radiogroup" aria-label="Modelo" className="grid gap-4 md:grid-cols-3">
        {MODELOS.map(({ id, nome, desc, Icone }) => {
          const sel = draft.modelo === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() =>
                set((d) => ({ ...d, modelo: id, modulos: [...MODULOS_POR_MODELO[id]] }))
              }
              className={cn(
                "relative flex flex-col rounded-xl border bg-card p-5 text-left shadow-card transition-all hover:border-primary/50",
                sel && "border-primary ring-2 ring-primary/30",
              )}
            >
              {sel && <Check className="absolute right-4 top-4 size-5 text-primary" aria-hidden />}
              <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icone className="size-5" aria-hidden />
              </span>
              <span className="font-semibold">{nome}</span>
              <span className="mt-1 text-sm text-muted-foreground">{desc}</span>
              <span className="mt-4 flex flex-wrap gap-1.5">
                {MODULOS_POR_MODELO[id].map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                  >
                    {ROTULO_MODULO[m]}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* 2. Requisitos */
export function PassoRequisitos({ draft, set }: PassoProps) {
  const add = () =>
    set((d) => ({
      ...d,
      requisitos: [
        ...d.requisitos,
        { id: proximoIdRequisito(d.requisitos.map((r) => r.id)), texto: "", status: "pendente" },
      ],
    }));
  return (
    <>
      <Explicacao>
        Registre o que o negócio precisa, em frases curtas. As regras do passo 6 só podem apontar
        para requisitos <strong className="text-foreground">confirmados</strong> — assim cada
        comportamento do sistema tem uma justificativa rastreável.
      </Explicacao>
      <div className="space-y-3">
        {draft.requisitos.length === 0 && <Vazio>Nenhum requisito ainda.</Vazio>}
        {draft.requisitos.map((r, i) => (
          <Bloco key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <span className="mt-2 w-16 shrink-0 font-mono text-sm font-semibold tabular-nums">
              {r.id}
            </span>
            <div className="flex-1">
              <Label htmlFor={`req-${r.id}`} className="sr-only">
                Texto do {r.id}
              </Label>
              <Textarea
                id={`req-${r.id}`}
                rows={2}
                value={r.texto}
                placeholder="Ex.: vendas acima de R$ 1.500 contam como atacado"
                onChange={(e) =>
                  set((d) => ({
                    ...d,
                    requisitos: d.requisitos.map((x, j) =>
                      j === i ? { ...x, texto: e.target.value } : x,
                    ),
                  }))
                }
              />
              {!r.texto.trim() && <Erro>Descreva o requisito.</Erro>}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={r.status}
                onValueChange={(v) =>
                  set((d) => ({
                    ...d,
                    requisitos: d.requisitos.map((x, j) =>
                      j === i ? { ...x, status: v as typeof r.status } : x,
                    ),
                  }))
                }
              >
                <SelectTrigger className="w-36" aria-label={`Status do ${r.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover ${r.id}`}
                onClick={() =>
                  set((d) => ({ ...d, requisitos: d.requisitos.filter((_, j) => j !== i) }))
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          </Bloco>
        ))}
        <Button variant="outline" onClick={add}>
          <Plus aria-hidden /> Adicionar requisito
        </Button>
      </div>
    </>
  );
}

/* 3. Aparência */
function CampoCor({
  id,
  rotulo,
  valor,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  const ok = hexValido(valor);
  return (
    <div>
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="mt-2 flex gap-2">
        <input
          type="color"
          aria-label={`Seletor da ${rotulo.toLowerCase()}`}
          value={ok ? valor : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded-md border bg-card p-1"
        />
        <Input
          id={id}
          value={valor}
          maxLength={7}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono uppercase"
          aria-invalid={!ok}
          aria-describedby={`${id}-erro`}
        />
      </div>
      {!ok && <Erro id={`${id}-erro`}>Use o formato #RRGGBB.</Erro>}
    </div>
  );
}

export function PassoAparencia({ draft, set }: PassoProps) {
  const a = draft.aparencia;
  const up = (p: Partial<typeof a>) => set((d) => ({ ...d, aparencia: { ...d.aparencia, ...p } }));
  const okP = hexValido(a.cor_primaria);
  const okD = hexValido(a.cor_destaque);
  const tp = okP ? textoSobre(a.cor_primaria) : null;
  const td = okD ? textoSobre(a.cor_destaque) : null;
  const baixo = (tp && tp.razao < 4.5) || (td && td.razao < 4.5);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <Label htmlFor="ap-nome">Nome do sistema</Label>
          <Input
            id="ap-nome"
            className="mt-2"
            value={a.nome}
            maxLength={80}
            onChange={(e) => up({ nome: e.target.value })}
            aria-invalid={!a.nome.trim()}
          />
          {!a.nome.trim() && <Erro>O nome é obrigatório.</Erro>}
        </div>
        <div>
          <Label htmlFor="ap-titulo">Título</Label>
          <Input
            id="ap-titulo"
            className="mt-2"
            value={a.titulo}
            maxLength={80}
            onChange={(e) => up({ titulo: e.target.value })}
            aria-invalid={!a.titulo.trim()}
          />
          {!a.titulo.trim() && <Erro>O título é obrigatório.</Erro>}
        </div>
        <div>
          <Label htmlFor="ap-boas">
            Texto de boas-vindas{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="ap-boas"
            className="mt-2"
            rows={3}
            maxLength={280}
            value={a.texto_boas_vindas ?? ""}
            onChange={(e) => up({ texto_boas_vindas: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoCor
            id="ap-primaria"
            rotulo="Cor primária"
            valor={a.cor_primaria}
            onChange={(v) => up({ cor_primaria: v })}
          />
          <CampoCor
            id="ap-destaque"
            rotulo="Cor de destaque"
            valor={a.cor_destaque}
            onChange={(v) => up({ cor_destaque: v })}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Prévia</p>
        <div
          className="overflow-hidden rounded-xl border shadow-card"
          aria-label="Prévia do cabeçalho"
        >
          {/* Cores vindas do usuário: aplicadas via style por serem dados, não tema. */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={okP && tp ? { background: a.cor_primaria, color: tp.cor } : undefined}
          >
            <span className="font-semibold">{a.titulo || "Título"}</span>
            <span
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={okD && td ? { background: a.cor_destaque, color: td.cor } : undefined}
            >
              Nova venda
            </span>
          </div>
          <div className="bg-card p-5 text-sm text-muted-foreground">
            {a.texto_boas_vindas || "Bem-vindo ao seu sistema."}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          Contraste do texto: primária {tp ? tp.razao.toFixed(1) : "—"}:1 · destaque{" "}
          {td ? td.razao.toFixed(1) : "—"}:1
        </p>
        {baixo && (
          <div
            role="status"
            className="mt-3 flex gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm"
          >
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
            <p>
              O contraste do texto fica abaixo do nível AA (4,5:1). Escolha uma cor mais escura ou
              mais clara.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* 4. Campos informativos */
const TIPOS_CAMPO: Record<Campo["tipo"], string> = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
  lista: "Lista",
};

export function PassoCampos({ draft, set }: PassoProps) {
  const ents = entidadesDosModulos(draft.modulos);
  const upd = (id: string, p: Partial<Campo>) =>
    set((d) => ({ ...d, campos: d.campos.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const add = (e: Entidade) =>
    set((d) => ({
      ...d,
      campos: [
        ...d.campos,
        { id: novoId("cmp"), entidade: e, rotulo: "", tipo: "texto", obrigatorio: false },
      ],
    }));

  return (
    <>
      <Explicacao>
        Campos extras que aparecem nos cadastros. Apenas as entidades dos módulos do modelo estão
        disponíveis. Máximo de 10 campos por entidade.
      </Explicacao>
      <div className="space-y-6">
        {ents.map((e) => {
          const lista = draft.campos.filter((c) => c.entidade === e);
          return (
            <section key={e} aria-labelledby={`ent-${e}`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 id={`ent-${e}`} className="font-semibold">
                  {ROTULO_ENTIDADE[e]}{" "}
                  <span className="text-sm font-normal text-muted-foreground tabular-nums">
                    ({lista.length}/10)
                  </span>
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={lista.length >= 10}
                  onClick={() => add(e)}
                >
                  <Plus aria-hidden /> Adicionar campo
                </Button>
              </div>
              <div className="space-y-2">
                {lista.length === 0 && <Vazio>Sem campos extras.</Vazio>}
                {lista.map((c) => {
                  const ops = (c.opcoes ?? []).map((o) => o.trim()).filter(Boolean);
                  const dup = new Set(ops.map((o) => o.toLowerCase())).size !== ops.length;
                  return (
                    <Bloco
                      key={c.id}
                      className="grid gap-3 sm:grid-cols-[1fr_9rem_auto_auto] sm:items-start"
                    >
                      <div>
                        <Label htmlFor={`${c.id}-r`} className="sr-only">
                          Rótulo
                        </Label>
                        <Input
                          id={`${c.id}-r`}
                          placeholder="Rótulo"
                          value={c.rotulo}
                          maxLength={60}
                          onChange={(ev) => upd(c.id, { rotulo: ev.target.value })}
                        />
                        {!c.rotulo.trim() && <Erro>Informe o rótulo.</Erro>}
                        {c.tipo === "lista" && (
                          <div className="mt-2">
                            <Label htmlFor={`${c.id}-o`} className="text-xs text-muted-foreground">
                              Opções, separadas por vírgula (2 a 20)
                            </Label>
                            <Input
                              id={`${c.id}-o`}
                              className="mt-1"
                              value={(c.opcoes ?? []).join(",")}
                              onChange={(ev) => upd(c.id, { opcoes: ev.target.value.split(",") })}
                            />
                            {(ops.length < 2 || ops.length > 20) && (
                              <Erro>Informe de 2 a 20 opções.</Erro>
                            )}
                            {dup && <Erro>Há opções repetidas.</Erro>}
                          </div>
                        )}
                      </div>
                      <Select
                        value={c.tipo}
                        onValueChange={(v) =>
                          set((d) => ({
                            ...d,
                            campos: d.campos.map((x) => {
                              if (x.id !== c.id) return x;
                              const { opcoes, ...resto } = x;
                              return v === "lista"
                                ? { ...resto, tipo: "lista", opcoes: opcoes ?? [] }
                                : { ...resto, tipo: v as Campo["tipo"] };
                            }),
                          }))
                        }
                      >
                        <SelectTrigger aria-label="Tipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIPOS_CAMPO).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex h-9 items-center gap-2">
                        <Switch
                          id={`${c.id}-ob`}
                          checked={c.obrigatorio}
                          onCheckedChange={(v) => upd(c.id, { obrigatorio: v })}
                        />
                        <Label htmlFor={`${c.id}-ob`}>Obrigatório</Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover campo ${c.rotulo}`}
                        onClick={() =>
                          set((d) => ({ ...d, campos: d.campos.filter((x) => x.id !== c.id) }))
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </Bloco>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

/* 5. Atendimentos */
export function PassoAtendimentos({ draft, set }: PassoProps) {
  if (!draft.modulos.includes("agenda"))
    return <Vazio>O modelo escolhido não tem agenda. Este passo não se aplica.</Vazio>;
  return (
    <>
      <Explicacao>
        Tipos de atendimento que podem ser agendados, com a duração em minutos (15 a 480).
      </Explicacao>
      <div className="space-y-2">
        {draft.tipos_atendimento.length === 0 && (
          <Vazio>Nenhum tipo cadastrado. Modelos com agenda precisam de ao menos um.</Vazio>
        )}
        {draft.tipos_atendimento.map((t, i) => {
          const durOk = t.duracao_minutos >= 15 && t.duracao_minutos <= 480;
          const up = (p: Partial<typeof t>) =>
            set((d) => ({
              ...d,
              tipos_atendimento: d.tipos_atendimento.map((x, j) => (j === i ? { ...x, ...p } : x)),
            }));
          return (
            <Bloco key={t.id} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start">
              <div>
                <Label htmlFor={`${t.id}-n`}>Nome</Label>
                <Input
                  id={`${t.id}-n`}
                  className="mt-1"
                  value={t.rotulo}
                  maxLength={60}
                  onChange={(e) => up({ rotulo: e.target.value })}
                />
                {!t.rotulo.trim() && <Erro>Informe o nome.</Erro>}
              </div>
              <div>
                <Label htmlFor={`${t.id}-d`}>Duração (min)</Label>
                <Input
                  id={`${t.id}-d`}
                  className="mt-1 tabular-nums"
                  type="number"
                  min={15}
                  max={480}
                  value={Number.isFinite(t.duracao_minutos) ? t.duracao_minutos : ""}
                  onChange={(e) => up({ duracao_minutos: e.target.valueAsNumber })}
                />
                {!durOk && <Erro>Entre 15 e 480.</Erro>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="sm:mt-6"
                aria-label={`Remover ${t.rotulo}`}
                onClick={() =>
                  set((d) => ({
                    ...d,
                    tipos_atendimento: d.tipos_atendimento.filter((_, j) => j !== i),
                  }))
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </Bloco>
          );
        })}
        <Button
          variant="outline"
          onClick={() =>
            set((d) => ({
              ...d,
              tipos_atendimento: [
                ...d.tipos_atendimento,
                { id: novoId("atd"), rotulo: "", duracao_minutos: 30 },
              ],
            }))
          }
        >
          <Plus aria-hidden /> Adicionar tipo
        </Button>
      </div>
    </>
  );
}

/* 6. Regras */
const ROTULO_REGRA: Record<Regra["tipo"], string> = {
  limite_atacado: "Limite de atacado",
  unidades_por_caixa: "Unidades por caixa",
  prazo_reserva: "Prazo de reserva",
  par_atendimento: "Par de atendimentos",
};

function novaRegra(tipo: Regra["tipo"]): Regra {
  switch (tipo) {
    case "limite_atacado":
      return { tipo, valor_centavos: 0, requisitos: [] };
    case "unidades_por_caixa":
      return { tipo, unidades: 12, requisitos: [] };
    case "prazo_reserva":
      return { tipo, minutos: 0, requisitos: [] };
    case "par_atendimento":
      return { tipo, primeiro: "", segundo: "", requisitos: [] };
  }
}

export function PassoRegras({ draft, set, irPara }: PassoProps & { irPara: (n: number) => void }) {
  const confirmados = draft.requisitos.filter((r) => r.status === "confirmado");
  const temVendas = draft.modulos.includes("vendas");
  const temAgenda = draft.modulos.includes("agenda");
  const disponiveis = (Object.keys(ROTULO_REGRA) as Regra["tipo"][]).filter((t) =>
    t === "par_atendimento" ? temAgenda : temVendas && !draft.regras.some((r) => r.tipo === t),
  );
  const up = (i: number, r: Regra) =>
    set((d) => ({ ...d, regras: d.regras.map((x, j) => (j === i ? r : x)) }));

  return (
    <>
      <Explicacao>
        Regras ajustam o comportamento dos módulos. Cada regra precisa apontar para pelo menos um
        requisito confirmado.
        {temVendas && " Com vendas, o prazo de reserva é obrigatório e não tem valor padrão."}
      </Explicacao>
      {confirmados.length === 0 && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm"
        >
          <AlertTriangle className="size-4 text-warning" aria-hidden />
          <span className="flex-1">Nenhum requisito confirmado ainda.</span>
          <Button variant="outline" size="sm" onClick={() => irPara(2)}>
            Ir para Requisitos
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {draft.regras.length === 0 && <Vazio>Nenhuma regra adicionada.</Vazio>}
        {draft.regras.map((r, i) => {
          const pid = `regra-${i}`;
          return (
            <Bloco key={i}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{ROTULO_REGRA[r.tipo]}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${ROTULO_REGRA[r.tipo]}`}
                  onClick={() => set((d) => ({ ...d, regras: d.regras.filter((_, j) => j !== i) }))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  {r.tipo === "limite_atacado" && (
                    <LimiteAtacado
                      id={pid}
                      valor={r.valor_centavos}
                      onChange={(v) => up(i, { ...r, valor_centavos: v })}
                    />
                  )}
                  {r.tipo === "unidades_por_caixa" && (
                    <>
                      <Label htmlFor={pid}>Unidades por caixa (2–1000)</Label>
                      <Input
                        id={pid}
                        className="mt-1 tabular-nums"
                        type="number"
                        min={2}
                        max={1000}
                        value={Number.isFinite(r.unidades) ? r.unidades : ""}
                        onChange={(e) => up(i, { ...r, unidades: e.target.valueAsNumber })}
                      />
                      {!(r.unidades >= 2 && r.unidades <= 1000) && <Erro>Entre 2 e 1000.</Erro>}
                    </>
                  )}
                  {r.tipo === "prazo_reserva" && (
                    <>
                      <Label htmlFor={pid}>Prazo de reserva (minutos)</Label>
                      <Input
                        id={pid}
                        className="mt-1 tabular-nums"
                        type="number"
                        min={1}
                        placeholder="Ex.: 120"
                        value={r.minutos > 0 ? r.minutos : ""}
                        onChange={(e) => up(i, { ...r, minutos: e.target.valueAsNumber || 0 })}
                      />
                      {!(r.minutos >= 1) && <Erro>Informe o prazo.</Erro>}
                    </>
                  )}
                  {r.tipo === "par_atendimento" &&
                    (draft.tipos_atendimento.length < 2 ? (
                      <div className="text-sm text-muted-foreground">
                        Cadastre ao menos dois tipos de atendimento.{" "}
                        <button
                          type="button"
                          className="rounded font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() => irPara(5)}
                        >
                          Ir para Atendimentos
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          O segundo é agendado logo após o primeiro, com o mesmo profissional.
                        </p>
                        {(["primeiro", "segundo"] as const).map((k) => (
                          <div key={k}>
                            <Label>
                              {k === "primeiro" ? "Primeiro atendimento" : "Segundo atendimento"}
                            </Label>
                            <Select value={r[k]} onValueChange={(v) => up(i, { ...r, [k]: v })}>
                              <SelectTrigger
                                className="mt-1"
                                aria-label={
                                  k === "primeiro" ? "Primeiro atendimento" : "Segundo atendimento"
                                }
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
                        {r.primeiro && r.primeiro === r.segundo && (
                          <Erro>Escolha atendimentos diferentes.</Erro>
                        )}
                      </div>
                    ))}
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">Requisitos que justificam</legend>
                  {confirmados.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Nenhum requisito confirmado.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {confirmados.map((q) => {
                        const cid = `${pid}-${q.id}`;
                        return (
                          <div key={q.id} className="flex items-start gap-2">
                            <Checkbox
                              id={cid}
                              checked={r.requisitos.includes(q.id)}
                              onCheckedChange={(v) =>
                                up(i, {
                                  ...r,
                                  requisitos: v
                                    ? [...r.requisitos, q.id]
                                    : r.requisitos.filter((x) => x !== q.id),
                                })
                              }
                            />
                            <Label htmlFor={cid} className="font-normal leading-snug">
                              <span className="font-mono font-semibold">{q.id}</span> {q.texto}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {r.requisitos.length === 0 && <Erro>Selecione ao menos um requisito.</Erro>}
                </fieldset>
              </div>
            </Bloco>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={disponiveis.length === 0}>
              <Plus aria-hidden /> Adicionar regra
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {disponiveis.map((t) => (
              <DropdownMenuItem
                key={t}
                onSelect={() => set((d) => ({ ...d, regras: [...d.regras, novaRegra(t)] }))}
              >
                {ROTULO_REGRA[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

function LimiteAtacado({
  id,
  valor,
  onChange,
}: {
  id: string;
  valor: number;
  onChange: (c: number) => void;
}) {
  return (
    <>
      <Label htmlFor={id}>Valor mínimo para atacado (R$)</Label>
      <Input
        id={id}
        className="mt-1 tabular-nums"
        inputMode="decimal"
        placeholder="1.500,00"
        defaultValue={valor > 0 ? centavosParaReais(valor) : ""}
        onChange={(e) => onChange(reaisParaCentavos(e.target.value) ?? 0)}
      />
      {!(valor > 0) && <Erro>Informe um valor maior que zero, ex.: 1.500,00.</Erro>}
    </>
  );
}

/* 7. Fora do catálogo */
export function PassoForaCatalogo({ draft, set }: PassoProps) {
  return (
    <>
      <div
        role="note"
        className="mb-5 flex max-w-2xl gap-3 rounded-lg border border-info/30 bg-info-soft p-4 text-sm"
      >
        <Ban className="size-5 shrink-0 text-info" aria-hidden />
        <p>
          O Nexus monta sistemas a partir de um catálogo fechado de módulos. Pedidos que não cabem
          nele ficam registrados aqui, para que todos saibam com clareza o que <strong>não</strong>{" "}
          será feito nesta versão.
        </p>
      </div>
      <div className="space-y-2">
        {draft.fora_do_catalogo.length === 0 && <Vazio>Nenhum pedido fora do catálogo.</Vazio>}
        {draft.fora_do_catalogo.map((f, i) => {
          const up = (p: Partial<typeof f>) =>
            set((d) => ({
              ...d,
              fora_do_catalogo: d.fora_do_catalogo.map((x, j) => (j === i ? { ...x, ...p } : x)),
            }));
          return (
            <Bloco key={i} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-start">
              <div>
                <Label htmlFor={`fc-${i}`}>Pedido</Label>
                <Input
                  id={`fc-${i}`}
                  className="mt-1"
                  placeholder="Ex.: emitir nota fiscal"
                  value={f.texto}
                  onChange={(e) => up({ texto: e.target.value })}
                />
                {!f.texto.trim() && <Erro>Descreva o pedido.</Erro>}
              </div>
              <div>
                <Label>Requisito (opcional)</Label>
                <Select
                  value={f.requisito ?? "nenhum"}
                  onValueChange={(v) =>
                    set((d) => ({
                      ...d,
                      fora_do_catalogo: d.fora_do_catalogo.map((x, j) =>
                        j === i
                          ? v === "nenhum"
                            ? { texto: x.texto }
                            : { ...x, requisito: v }
                          : x,
                      ),
                    }))
                  }
                >
                  <SelectTrigger className="mt-1" aria-label="Requisito relacionado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {draft.requisitos.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="sm:mt-6"
                aria-label="Remover pedido"
                onClick={() =>
                  set((d) => ({
                    ...d,
                    fora_do_catalogo: d.fora_do_catalogo.filter((_, j) => j !== i),
                  }))
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </Bloco>
          );
        })}
        <Button
          variant="outline"
          onClick={() =>
            set((d) => ({ ...d, fora_do_catalogo: [...d.fora_do_catalogo, { texto: "" }] }))
          }
        >
          <Plus aria-hidden /> Adicionar pedido
        </Button>
      </div>
    </>
  );
}
