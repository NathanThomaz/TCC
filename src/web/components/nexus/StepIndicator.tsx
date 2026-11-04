import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepIndicator({
  passos,
  atual,
  desabilitados = [],
  onIr,
}: {
  passos: readonly string[];
  atual: number;
  desabilitados?: number[];
  onIr: (n: number) => void;
}) {
  return (
    <nav aria-label="Passos da configuração" className="-mx-1 overflow-x-auto pb-1">
      <ol className="flex min-w-max gap-1 px-1">
        {passos.map((p, i) => {
          const n = i + 1;
          const ativo = n === atual;
          const feito = n < atual;
          const off = desabilitados.includes(n);
          return (
            <li key={p}>
              <button
                type="button"
                onClick={() => onIr(n)}
                disabled={off}
                aria-current={ativo ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  ativo
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    ativo
                      ? "border-primary-foreground/40"
                      : feito
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                  )}
                >
                  {feito ? <Check className="size-3.5" aria-hidden /> : n}
                </span>
                <span className="whitespace-nowrap">
                  {p}
                  {off && <span className="sr-only"> (não se aplica)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
