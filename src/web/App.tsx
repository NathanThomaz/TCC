import { useEffect, useState } from "react";
import type { HealthResponse } from "../shared/api";

type State =
  | { kind: "loading" }
  | { kind: "ready"; health: HealthResponse }
  | { kind: "error"; message: string };

/** Página inicial provisória: mostra que front, API e banco conversam. */
export function App({ fetcher = fetch }: { fetcher?: typeof fetch }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    fetcher("/api/v1/health")
      .then(async (response) => {
        const health = (await response.json()) as HealthResponse;
        if (active) setState({ kind: "ready", health });
      })
      .catch(() => {
        if (active) setState({ kind: "error", message: "API indisponível no momento." });
      });
    return () => {
      active = false;
    };
  }, [fetcher]);

  return (
    <main className="page">
      <h1>Nexus</h1>
      <p>Sistemas de gestão para pequenos negócios, configurados por conversa.</p>
      <section aria-live="polite" className="status">
        {state.kind === "loading" && <p>Verificando o serviço…</p>}
        {state.kind === "error" && <p role="alert">{state.message}</p>}
        {state.kind === "ready" && (
          <p>
            Serviço {state.health.status === "ok" ? "disponível" : "com falha"} · banco{" "}
            {state.health.checks.database === "ok" ? "ok" : "indisponível"} · ambiente{" "}
            {state.health.environment}
          </p>
        )}
      </section>
    </main>
  );
}
