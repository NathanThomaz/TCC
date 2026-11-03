import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function HashCurto({ hash }: { hash: string }) {
  const curto = hash.slice(0, 8);
  return (
    <span className="inline-flex items-center gap-1">
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{curto}</code>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`Copiar hash ${curto}`}
        onClick={() =>
          void navigator.clipboard?.writeText(hash).then(
            () => toast.success("Hash copiado."),
            () => toast.error("Não foi possível copiar."),
          )
        }
      >
        <Copy className="size-3.5" aria-hidden />
      </Button>
    </span>
  );
}
