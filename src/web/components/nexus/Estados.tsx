import { AlertTriangle, RotateCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icone: Icone,
  titulo,
  descricao,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icone className="size-6" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {descricao && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  );
}

export function ErrorState({ mensagem, onTentar }: { mensagem?: string; onTentar?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-xl border border-destructive/30 bg-danger-soft px-6 py-10 text-center"
    >
      <AlertTriangle className="mb-3 size-6 text-destructive" strokeWidth={1.75} aria-hidden />
      <h2 className="text-base font-semibold">Não foi possível carregar</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {mensagem ?? "Ocorreu um erro inesperado."}
      </p>
      {onTentar && (
        <Button variant="outline" className="mt-5" onClick={onTentar}>
          <RotateCw aria-hidden /> Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descricao && <div className="mt-1 text-sm text-muted-foreground">{descricao}</div>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}
