import type { OrcamentoCategoriaDto } from "../../../shared/api";
import { formatarCentavos } from "../../../shared/dominio/precos";
import { cn } from "@/lib/utils";

// Orçamento do mês por categoria de despesa (regra orcamento_mensal, ADR-015): barra de uso e
// aviso quando o gasto passa do limite. Usado no painel e no financeiro.

export function OrcamentoDoMes({ itens }: { itens: OrcamentoCategoriaDto[] }) {
  return (
    <ul className="space-y-3">
      {itens.map((o) => {
        const uso = o.limiteCentavos > 0 ? o.gastoCentavos / o.limiteCentavos : 0;
        const passou = o.gastoCentavos > o.limiteCentavos;
        return (
          <li key={o.categoria}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{o.categoria}</span>
              <span className={cn("tabular-nums", passou && "font-medium text-destructive")}>
                {formatarCentavos(o.gastoCentavos)} de {formatarCentavos(o.limiteCentavos)}
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label={`Orçamento de ${o.categoria}`}
              aria-valuemin={0}
              aria-valuemax={o.limiteCentavos}
              aria-valuenow={o.gastoCentavos}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  passou ? "bg-destructive" : uso >= 0.8 ? "bg-warning" : "bg-success",
                )}
                style={{ width: `${Math.min(100, Math.round(uso * 100))}%` }}
              />
            </div>
            {passou && (
              <p className="mt-1 text-xs text-destructive">
                Passou {formatarCentavos(o.gastoCentavos - o.limiteCentavos)} do limite do mês.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
