import type { ReactNode } from "react";
import {
  AlertTriangle,
  Briefcase,
  Check,
  CircleCheck,
  Plus,
  Scissors,
  Store,
  Trash2,
} from "lucide-react";
import {
  campoNativoDuplicado,
  NATIVE_FIELDS,
  normalizarRotulo,
} from "../../../shared/contract/catalog";
import type { Campo, ConfigDraft, Modelo } from "@/types/nexus";
import { hexValido, textoSobre } from "@/lib/cores";
import {
  centavosParaReais,
  entidadesDosModulos,
  MODULOS_POR_MODELO,
  novoId,
  reaisParaCentavos,
  ROTULO_ENTIDADE,
  ROTULO_MODULO,
  type Entidade,
} from "@/lib/nexus";
import { cn } from "@/lib/utils";
import { ModulosProntos } from "@/components/nexus/ModulosProntos";
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
        O modelo define quais módulos o sistema terá. Abaixo, o que cada módulo já traz pronto: no
        próximo passo você só ajusta valores e acrescenta o que faltar.
      </Explicacao>
      <div
        role="radiogroup"
        aria-label="Modelo"
        className="grid gap-4 md:grid-cols-3"
        onKeyDown={(e) => {
          // Setas movem a seleção e o foco, como num grupo de rádios (uma só parada de Tab).
          const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (!passo) return;
          e.preventDefault();
          const i = MODELOS.findIndex((m) => m.id === draft.modelo);
          const prox = MODELOS[(i + passo + MODELOS.length) % MODELOS.length];
          if (!prox) return;
          set((d) => ({ ...d, modelo: prox.id, modulos: [...MODULOS_POR_MODELO[prox.id]] }));
          e.currentTarget.querySelector<HTMLButtonElement>(`[data-modelo="${prox.id}"]`)?.focus();
        }}
      >
        {MODELOS.map(({ id, nome, desc, Icone }) => {
          const sel = draft.modelo === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={sel}
              data-modelo={id}
              tabIndex={sel ? 0 : -1}
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
      <div className="mt-6">
        <ModulosProntos
          modulos={draft.modulos}
          titulo={`O que já vem pronto em ${MODELOS.find((m) => m.id === draft.modelo)?.nome ?? "este modelo"}`}
        />
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
type SugestaoCampo = Pick<Campo, "rotulo" | "tipo"> & { opcoes?: string[] };

/** Extras comuns por cadastro: atalhos de um clique (nenhum repete campo nativo). */
const SUGESTOES_CAMPOS: Record<Entidade, SugestaoCampo[]> = {
  clientes: [
    { rotulo: "Telefone", tipo: "texto" },
    { rotulo: "Endereço de entrega", tipo: "texto" },
    { rotulo: "E-mail", tipo: "texto" },
    { rotulo: "CPF ou CNPJ", tipo: "texto" },
  ],
  produtos: [
    { rotulo: "Marca", tipo: "texto" },
    { rotulo: "Volume (ml)", tipo: "numero" },
    { rotulo: "Validade", tipo: "data" },
  ],
  profissionais: [
    { rotulo: "Telefone", tipo: "texto" },
    { rotulo: "Especialidade", tipo: "texto" },
  ],
  vendas: [
    { rotulo: "Forma de pagamento", tipo: "lista", opcoes: ["Dinheiro", "Pix", "Cartão"] },
    { rotulo: "Observação", tipo: "texto" },
  ],
  agendamentos: [
    { rotulo: "Endereço do atendimento", tipo: "texto" },
    { rotulo: "Observação", tipo: "texto" },
  ],
  fornecedores: [
    { rotulo: "CNPJ", tipo: "texto" },
    { rotulo: "Telefone", tipo: "texto" },
    { rotulo: "E-mail", tipo: "texto" },
    { rotulo: "Contato", tipo: "texto" },
  ],
};

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
  const add = (e: Entidade, modelo?: SugestaoCampo) =>
    set((d) => ({
      ...d,
      campos: [
        ...d.campos,
        modelo
          ? { id: novoId("cmp"), entidade: e, obrigatorio: false, ...modelo }
          : { id: novoId("cmp"), entidade: e, rotulo: "", tipo: "texto", obrigatorio: false },
      ],
    }));

  return (
    <>
      <Explicacao>
        Cada cadastro já vem com os campos essenciais. Acrescente só o que faltar para o seu negócio
        (até 10 por cadastro); o Nexus avisa se um campo repetir algo que já existe.
      </Explicacao>
      <div className="space-y-6">
        {ents.map((e) => {
          const lista = draft.campos.filter((c) => c.entidade === e);
          const existentes = new Set(lista.map((c) => normalizarRotulo(c.rotulo)));
          const atalhos = SUGESTOES_CAMPOS[e].filter(
            (s) =>
              !existentes.has(normalizarRotulo(s.rotulo)) &&
              !campoNativoDuplicado(e, s.rotulo, draft.modulos),
          );
          return (
            <section key={e} aria-labelledby={`ent-${e}`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 id={`ent-${e}`} className="font-semibold">
                  {ROTULO_ENTIDADE[e]}{" "}
                  <span className="text-sm font-normal text-muted-foreground tabular-nums">
                    ({lista.length}/10 extras)
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
              <div className="mb-3 rounded-lg bg-muted p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CircleCheck className="size-4 text-success" aria-hidden /> Já vem pronto no
                  cadastro
                </p>
                <ul
                  className="flex flex-wrap gap-1.5"
                  aria-label={`Campos de ${ROTULO_ENTIDADE[e]}`}
                >
                  {NATIVE_FIELDS[e].map((n) => (
                    <li
                      key={n.label}
                      className="rounded-full border bg-card px-2.5 py-0.5 text-xs text-foreground"
                    >
                      {n.label}
                    </li>
                  ))}
                </ul>
                {atalhos.length > 0 && lista.length < 10 && (
                  <>
                    <p className="mb-2 mt-3 text-xs font-medium text-muted-foreground">
                      Extras comuns (um clique para adicionar)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {atalhos.map((s) => (
                        <Button
                          key={s.rotulo}
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full px-2.5 text-xs"
                          onClick={() => add(e, s)}
                        >
                          <Plus className="size-3.5" aria-hidden /> {s.rotulo}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                {lista.length === 0 && <Vazio>Sem campos extras.</Vazio>}
                {lista.map((c) => {
                  const ops = (c.opcoes ?? []).map((o) => o.trim()).filter(Boolean);
                  const dup = new Set(ops.map((o) => o.toLowerCase())).size !== ops.length;
                  const nativo = campoNativoDuplicado(e, c.rotulo, draft.modulos);
                  const repetido =
                    !!c.rotulo.trim() &&
                    lista.some(
                      (x) =>
                        x.id !== c.id && normalizarRotulo(x.rotulo) === normalizarRotulo(c.rotulo),
                    );
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
                          aria-invalid={!!nativo || repetido || !c.rotulo.trim()}
                          aria-describedby={`${c.id}-r-erro`}
                        />
                        <div id={`${c.id}-r-erro`} role="status">
                          {!c.rotulo.trim() && <Erro>Informe o rótulo.</Erro>}
                          {nativo && (
                            <Erro>
                              Já vem pronto no cadastro ({nativo}); não precisa deste campo.
                            </Erro>
                          )}
                          {repetido && <Erro>Já existe outro campo com este nome aqui.</Erro>}
                        </div>
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

/* Valor do atacado (usado nos ajustes do modo avançado) */
export function LimiteAtacado({
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
