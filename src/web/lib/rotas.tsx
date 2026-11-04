import type { ComponentProps, Ref } from "react";
import {
  Link as RRLink,
  useLocation,
  useNavigate as useRRNavigate,
  useSearchParams,
} from "react-router";

// Adaptador com a mesma forma do roteador usado nas telas do laboratório (Telas-Lovable/tcc):
// `to` com segmentos `$param`, `params` e `search`. Por baixo é o react-router; assim os
// componentes portados mudam só o import.

type Busca = Record<string, string | number | boolean | undefined>;

export interface Destino {
  to?: string | undefined;
  params?: Record<string, string> | undefined;
  search?: Busca | undefined;
  replace?: boolean | undefined;
}

/** Monta o caminho final; sem `to`, mantém o caminho atual (ex.: só troca a busca). */
export function caminho({ to, params, search }: Destino, atual: string): string {
  let p = to ?? atual;
  for (const [k, v] of Object.entries(params ?? {})) p = p.replace(`$${k}`, encodeURIComponent(v));
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(search ?? {})) if (v !== undefined) q.set(k, String(v));
  const s = q.toString();
  return s ? `${p}?${s}` : p;
}

type LinkProps = Omit<ComponentProps<typeof RRLink>, "to"> &
  Destino & { activeOptions?: { exact?: boolean }; ref?: Ref<HTMLAnchorElement> };

/** Link com `data-status="active"` na rota atual, como o das telas originais. */
export function Link({ to, params, search, activeOptions, ...rest }: LinkProps) {
  const { pathname } = useLocation();
  const destino = caminho({ to, params, search }, pathname);
  const alvo = destino.split("?")[0] ?? destino;
  const ativo =
    activeOptions?.exact || alvo === "/" ? pathname === alvo : pathname.startsWith(alvo);
  return <RRLink to={destino} data-status={ativo ? "active" : undefined} {...rest} />;
}

export function useNavigate() {
  const navigate = useRRNavigate();
  const { pathname } = useLocation();
  return (d: Destino) => {
    void navigate(caminho(d, pathname), d.replace ? { replace: true } : undefined);
  };
}

/** Parâmetros da busca (?chave=valor) como objeto simples. */
export function useBusca(): Record<string, string> {
  const [params] = useSearchParams();
  return Object.fromEntries(params.entries());
}
