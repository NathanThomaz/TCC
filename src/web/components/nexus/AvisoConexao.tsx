import { onlineManager, useMutationState } from "@tanstack/react-query";
import { CloudUpload, WifiOff } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

// Sem internet: o TanStack Query já pausa as consultas (a tela continua com os últimos dados) e
// as alterações (cada uma com a sua Idempotency-Key), e retoma tudo sozinho quando a conexão
// volta. Este aviso explica isso à pessoa, conta o que está esperando e pede para não fechar a
// aba enquanto houver alteração guardada só na memória.

const assinar = (avisar: () => void) => onlineManager.subscribe(avisar);
const online = () => onlineManager.isOnline();

export function useOnline(): boolean {
  return useSyncExternalStore(assinar, online, () => true);
}

export function AvisoConexao() {
  const conectado = useOnline();
  const esperando = useMutationState({
    filters: { predicate: (m) => m.state.isPaused },
    select: (m) => m.mutationId,
  }).length;

  useEffect(() => {
    if (!esperando) return;
    const segurar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [esperando]);

  if (conectado && !esperando) return null;
  const alteracoes = `${esperando} ${esperando === 1 ? "alteração" : "alterações"}`;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl gap-3 rounded-xl border border-warning/40 bg-card p-4 text-sm shadow-lg"
    >
      {conectado ? (
        <>
          <CloudUpload className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p>
            <strong className="block">Conexão de volta</strong>
            Enviando {alteracoes} que ficaram esperando.
          </p>
        </>
      ) : (
        <>
          <WifiOff className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>
            <strong className="block">Sem internet</strong>
            Você continua vendo os últimos dados carregados. O que salvar agora fica guardado nesta
            aba e é enviado sozinho quando a conexão voltar.
            {esperando > 0 && (
              <span className="mt-1 block font-medium">
                {alteracoes} esperando. Não feche esta aba até a conexão voltar.
              </span>
            )}
          </p>
        </>
      )}
    </div>
  );
}
