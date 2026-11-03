import { cva } from "class-variance-authority";
import { Archive, CheckCircle2, CircleDashed, ShieldCheck, XCircle, History } from "lucide-react";
import type { Sistema, Versao } from "@/types/nexus";
import { cn } from "@/lib/utils";

const estilo = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tom: {
        sucesso: "border-success/30 bg-success-soft text-success",
        aviso: "border-warning/30 bg-warning-soft text-warning",
        perigo: "border-destructive/30 bg-danger-soft text-destructive",
        info: "border-info/30 bg-info-soft text-info",
        neutro: "border-border bg-neutral-soft text-muted-foreground",
      },
    },
  },
);

type Tom = "sucesso" | "aviso" | "perigo" | "info" | "neutro";
const MAPA: Record<
  Sistema["status"] | Versao["status"],
  { texto: string; tom: Tom; Icone: typeof CheckCircle2 }
> = {
  draft: { texto: "Rascunho", tom: "aviso", Icone: CircleDashed },
  active: { texto: "Ativo", tom: "sucesso", Icone: CheckCircle2 },
  archived: { texto: "Arquivado", tom: "neutro", Icone: Archive },
  valid: { texto: "Válida", tom: "info", Icone: CheckCircle2 },
  invalid: { texto: "Inválida", tom: "perigo", Icone: XCircle },
  approved: { texto: "Aprovada", tom: "sucesso", Icone: ShieldCheck },
  superseded: { texto: "Substituída", tom: "neutro", Icone: History },
};

export function StatusBadge({
  status,
  className,
}: {
  status: keyof typeof MAPA;
  className?: string;
}) {
  const { texto, tom, Icone } = MAPA[status];
  return (
    <span className={cn(estilo({ tom }), className)}>
      <Icone className="size-3.5" strokeWidth={2} aria-hidden />
      {texto}
    </span>
  );
}
