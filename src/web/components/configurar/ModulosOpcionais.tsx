import { Banknote, Landmark, Truck, type LucideIcon } from "lucide-react";
import { PAYMENT_METHODS, RULE_MODULES } from "../../../shared/contract/catalog";
import type { PassoProps } from "@/components/configurar/Passos";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DESCRICAO_OPCIONAL,
  entidadesDosModulos,
  OPCIONAIS_POR_MODELO,
  ROTULO_MODULO,
  ROTULO_PAGAMENTO,
} from "@/lib/nexus";
import type { Modulo, Regra } from "@/types/nexus";

// Módulos opcionais (ADR-006): além dos módulos do modelo, o dono liga os que o negócio usa.
// Formas de pagamento entra com as formas mais comuns como sugestão a confirmar (a regra é
// obrigatória com o módulo: o sistema não decide sozinho o que o negócio aceita).

const ICONE: Partial<Record<Modulo, LucideIcon>> = {
  pagamentos: Banknote,
  fornecedores: Truck,
  financeiro: Landmark,
};

export const FORMAS_PADRAO: Extract<Regra, { tipo: "formas_pagamento" }> = {
  tipo: "formas_pagamento",
  formas: ["dinheiro", "pix", "cartao_credito", "cartao_debito"],
  requisitos: [],
};

/** Liga ou desliga um opcional e tira o que dependia dele (regras e campos). */
export function alternarOpcional(
  d: PassoProps["draft"],
  modulo: Modulo,
  ligado: boolean,
): PassoProps["draft"] {
  const modulos = ligado ? [...d.modulos, modulo] : d.modulos.filter((m) => m !== modulo);
  const regras = d.regras.filter((r) => RULE_MODULES[r.tipo].every((m) => modulos.includes(m)));
  if (ligado && modulo === "pagamentos" && !regras.some((r) => r.tipo === "formas_pagamento")) {
    regras.push(FORMAS_PADRAO);
  }
  return {
    ...d,
    modulos,
    regras,
    campos: d.campos.filter((c) => entidadesDosModulos(modulos).includes(c.entidade)),
  };
}

export function ModulosOpcionais({
  draft,
  set,
  sugerido,
  onSugerir,
  onConfirmar,
}: PassoProps & {
  sugerido: boolean;
  onSugerir: (ligado: boolean) => void;
  onConfirmar: () => void;
}) {
  const opcionais = OPCIONAIS_POR_MODELO[draft.modelo];
  const formas = draft.regras.find(
    (r): r is Extract<Regra, { tipo: "formas_pagamento" }> => r.tipo === "formas_pagamento",
  );
  const mudarFormas = (nova: Extract<Regra, { tipo: "formas_pagamento" }>) => {
    set((d) => ({
      ...d,
      regras: d.regras.map((r) => (r.tipo === "formas_pagamento" ? nova : r)),
    }));
    onConfirmar();
  };

  return (
    <div className="space-y-4">
      {opcionais.map((m) => {
        const Icone = ICONE[m] ?? Landmark;
        const ligado = draft.modulos.includes(m);
        const id = `opcional-${m}`;
        return (
          <div key={m} className="rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icone className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <Label htmlFor={id} className="font-medium">
                  {ROTULO_MODULO[m]}
                </Label>
                <p id={`${id}-desc`} className="text-sm text-muted-foreground">
                  {DESCRICAO_OPCIONAL[m]}
                </p>
              </div>
              <Switch
                id={id}
                checked={ligado}
                aria-describedby={`${id}-desc`}
                onCheckedChange={(v) => {
                  set((d) => alternarOpcional(d, m, v));
                  if (m === "pagamentos") onSugerir(v);
                }}
              />
            </div>
            {m === "pagamentos" && ligado && formas && (
              <fieldset className="mt-4 space-y-3 border-t pt-4">
                <legend className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  Formas aceitas
                  {sugerido && (
                    <button
                      type="button"
                      className="rounded-md bg-warning-soft px-2 py-1 text-xs text-warning underline-offset-2 hover:underline"
                      onClick={onConfirmar}
                    >
                      Sugestão — confirmar
                    </button>
                  )}
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PAYMENT_METHODS.map((f) => {
                    const marcado = formas.formas.includes(f);
                    return (
                      <label key={f} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={(v) => {
                            const lista = v
                              ? [...formas.formas, f]
                              : formas.formas.filter((x) => x !== f);
                            // Sem venda a prazo, o prazo de vencimento sai da regra.
                            mudarFormas({
                              tipo: "formas_pagamento",
                              requisitos: formas.requisitos,
                              formas: lista,
                              ...(lista.includes("a_prazo")
                                ? { prazo_dias: formas.prazo_dias ?? 30 }
                                : {}),
                            });
                          }}
                        />
                        {ROTULO_PAGAMENTO[f]}
                      </label>
                    );
                  })}
                </div>
                {formas.formas.includes("a_prazo") && (
                  <div className="max-w-xs space-y-1.5">
                    <Label htmlFor="prazo-dias">A venda a prazo vence em (dias)</Label>
                    <Input
                      id="prazo-dias"
                      type="number"
                      min={1}
                      max={180}
                      value={formas.prazo_dias ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        mudarFormas({ ...formas, prazo_dias: Number.isFinite(n) ? n : 0 });
                      }}
                    />
                  </div>
                )}
              </fieldset>
            )}
          </div>
        );
      })}
    </div>
  );
}
