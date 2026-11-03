import { AlertTriangle, ArrowRight, OctagonAlert } from "lucide-react";
import type { Issue } from "@/types/nexus";
import { PASSOS, passoDoPath } from "@/lib/nexus";
import { cn } from "@/lib/utils";

export function IssueList({ issues, onIr }: { issues: Issue[]; onIr: (passo: number) => void }) {
  const ordenadas = [...issues].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "bloqueante" ? -1 : 1,
  );
  return (
    <ul className="space-y-2">
      {ordenadas.map((i, idx) => {
        const bloq = i.severity === "bloqueante";
        const passo = passoDoPath(i.path);
        const Icone = bloq ? OctagonAlert : AlertTriangle;
        return (
          <li
            key={idx}
            className={cn(
              "flex gap-3 rounded-lg border p-3",
              bloq ? "border-destructive/30 bg-danger-soft" : "border-warning/30 bg-warning-soft",
            )}
          >
            <Icone
              className={cn("mt-0.5 size-5 shrink-0", bloq ? "text-destructive" : "text-warning")}
              strokeWidth={2}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span
                  className={cn(
                    "mr-2 text-xs font-semibold uppercase tracking-wide",
                    bloq ? "text-destructive" : "text-warning",
                  )}
                >
                  {bloq ? "Bloqueante" : "Aviso"}
                </span>
                {i.message}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {i.code} · {i.path}
              </p>
            </div>
            {passo !== 8 && (
              <button
                type="button"
                onClick={() => onIr(passo)}
                className="inline-flex shrink-0 items-center gap-1 self-start rounded-md px-2 py-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ir para o campo <ArrowRight className="size-4" aria-hidden />
                <span className="sr-only">
                  : passo {passo}, {PASSOS[passo - 1]}
                </span>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
