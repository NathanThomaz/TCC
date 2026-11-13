import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { enviarLogotipo, obterLogotipo, removerLogotipo } from "@/api/logotipo";
import { ErroApi } from "@/components/app/Comum";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Logotipo do sistema (seções 5 e 29): imagem quando existe; senão, as iniciais do nome.

const LIMITE = 200 * 1024;

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? [partes[0]![0], partes.at(-1)![0]] : [partes[0]?.slice(0, 2)];
  return letras.join("").toUpperCase() || "?";
}

export function useLogotipo(sistema: string) {
  return useQuery({
    queryKey: ["logotipo", sistema],
    queryFn: () => obterLogotipo(sistema),
    staleTime: 5 * 60 * 1000,
  });
}

/** Logotipo ou iniciais, num quadrado do tamanho pedido (as cores das iniciais vêm dos tokens). */
export function Logotipo({
  sistema,
  nome,
  className,
}: {
  sistema: string;
  nome: string;
  className?: string;
}) {
  const q = useLogotipo(sistema);
  // Imagem que não carrega (arquivo corrompido) volta às iniciais.
  const [quebrada, setQuebrada] = useState<string | null>(null);
  if (q.data && quebrada !== q.data) {
    return (
      <img
        src={q.data}
        onError={() => setQuebrada(q.data ?? null)}
        alt={`Logotipo de ${nome}`}
        className={cn("size-10 shrink-0 rounded-lg bg-card object-contain", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground",
        className,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}

/** Envio e remoção (só administrador): PNG ou JPEG até 200 KB; o servidor confere o conteúdo. */
export function EditorLogotipo({ sistema, nome }: { sistema: string; nome: string }) {
  const qc = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const q = useLogotipo(sistema);
  const atualizar = () => void qc.invalidateQueries({ queryKey: ["logotipo", sistema] });
  const enviar = useMutation({
    mutationFn: (arquivo: File) => {
      if (arquivo.size > LIMITE) {
        return Promise.reject(new Error("O logotipo pode ter no máximo 200 KB."));
      }
      return enviarLogotipo(sistema, arquivo);
    },
    onSuccess: atualizar,
  });
  const remover = useMutation({ mutationFn: () => removerLogotipo(sistema), onSuccess: atualizar });
  const ocupado = enviar.isPending || remover.isPending;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Logotipo sistema={sistema} nome={nome} className="size-16 text-lg" />
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          PNG ou JPEG, até 200 KB. Sem logotipo, o sistema mostra as iniciais.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={entrada}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-label="Escolher logotipo"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) enviar.mutate(arquivo);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ocupado}
            onClick={() => entrada.current?.click()}
          >
            {enviar.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <ImageUp aria-hidden />
            )}
            {q.data ? "Trocar logotipo" : "Enviar logotipo"}
          </Button>
          {q.data && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={ocupado}
              onClick={() => remover.mutate()}
            >
              <Trash2 aria-hidden /> Remover
            </Button>
          )}
        </div>
        <ErroApi erro={enviar.error ?? remover.error} />
      </div>
    </div>
  );
}
