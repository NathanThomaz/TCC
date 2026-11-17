import { ArrowRight } from "lucide-react";
import { CriarSistemaDialog } from "@/components/nexus/CriarSistemaDialog";
import { MODULOS_POR_MODELO, ROTULO_MODULO } from "@/lib/nexus";
import { MODELOS } from "@/lib/modelos";

// Os seis modelos na tela inicial (pedido do dono, 2026-11-16, ADR-015): escolher um já cria o
// sistema com o modelo, na conversa com a IA ou no modo avançado.

export function ModelosParaComecar() {
  return (
    <section aria-labelledby="titulo-modelos" className="space-y-3">
      <div>
        <h2 id="titulo-modelos" className="text-lg font-semibold">
          Comece por um modelo
        </h2>
        <p className="text-sm text-muted-foreground">
          Escolha o que mais parece com o que você precisa. Na conversa, a IA ajusta o resto.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MODELOS.map(({ id, nome, desc, exemplos, Icone }) => (
          <li key={id} className="flex">
            <CriarSistemaDialog
              modelo={id}
              gatilho={
                <button
                  type="button"
                  className="group flex w-full flex-col rounded-xl border bg-card p-5 text-left shadow-card transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icone className="size-5" aria-hidden />
                    </span>
                    <span className="font-semibold">{nome}</span>
                  </span>
                  <span className="mt-3 text-sm text-muted-foreground">{desc}</span>
                  <span className="mt-1 text-xs text-muted-foreground">Ex.: {exemplos}</span>
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
                  <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-primary">
                    Começar com este modelo
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </button>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
