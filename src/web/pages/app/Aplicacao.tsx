import { createContext, useContext, useEffect } from "react";
import { Outlet, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTema } from "@/lib/tema";
import { ArrowLeft } from "lucide-react";
import type { ModuleId } from "../../../shared/contract/catalog";
import { obterApp, type App } from "@/api/operacao";
import { ErrorState } from "@/components/nexus/Estados";
import { Skeleton } from "@/components/ui/skeleton";
import { textoSobre } from "@/lib/cores";
import { ROTULO_MODULO } from "@/lib/nexus";
import { Link } from "@/lib/rotas";
import { cn } from "@/lib/utils";
import { Logotipo } from "@/components/nexus/Logotipo";

// Aplicação de um sistema ativo (seção 6, área "Aplicação"): as telas se montam a partir da
// configuração APROVADA — módulos, rótulos do menu, campos e aparência. Dados reais começam
// vazios; nada da prévia é copiado (seção 8, passo 11).

const AppContext = createContext<(App & { id: string }) | null>(null);

export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw new Error("useApp fora da aplicação");
  return app;
}

/** Ordem do menu; estoque fica junto de produtos (mesma tela, com saldos e movimentos). */
const MENU: { modulo: ModuleId; caminho: string; rotulo?: string }[] = [
  { modulo: "vendas", caminho: "vendas" },
  { modulo: "produtos", caminho: "produtos" },
  { modulo: "estoque", caminho: "estoque" },
  { modulo: "agenda", caminho: "agenda" },
  { modulo: "clientes", caminho: "clientes" },
  { modulo: "profissionais", caminho: "profissionais" },
  // Opcionais (ADR-006); formas de pagamento ficam dentro de vendas.
  { modulo: "fornecedores", caminho: "fornecedores" },
  { modulo: "fornecedores", caminho: "compras", rotulo: "Compras" },
  { modulo: "financeiro", caminho: "financeiro" },
];

export function rotuloModulo(app: App, modulo: ModuleId): string {
  return app.config.aparencia.rotulos_menu?.[modulo] ?? ROTULO_MODULO[modulo];
}

export function Aplicacao() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["app", id], queryFn: () => obterApp(id) });
  // Tema escolhido na criação do sistema; ao sair dele, volta a preferência da pessoa.
  const { forcar } = useTema();
  const temaDoSistema = q.data?.config.aparencia.tema ?? null;
  useEffect(() => {
    forcar(temaDoSistema);
    return () => forcar(null);
  }, [temaDoSistema, forcar]);

  if (q.isPending) {
    return (
      <div aria-busy="true" aria-label="Carregando aplicação">
        <Skeleton className="mb-6 h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <>
        <Link
          to="/sistemas/$id"
          params={{ id }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Sistema
        </Link>
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      </>
    );
  }

  const app = { ...q.data, id };
  const { aparencia, modulos } = app.config;
  const texto = textoSobre(aparencia.cor_primaria).cor;

  return (
    <AppContext.Provider value={app}>
      <div
        className="mb-6 overflow-hidden rounded-xl border shadow-card"
        style={{ borderColor: aparencia.cor_primaria }}
      >
        <div className="px-5 py-4" style={{ background: aparencia.cor_primaria, color: texto }}>
          <Link
            to="/sistemas/$id"
            params={{ id }}
            className="mb-1 inline-flex items-center gap-1 text-xs opacity-80 hover:opacity-100"
          >
            <ArrowLeft className="size-3" aria-hidden /> {app.sistema.nome}
          </Link>
          <div className="flex items-center gap-3">
            <Logotipo sistema={id} nome={aparencia.nome} className="bg-card" />
            <h1 className="text-xl font-semibold tracking-tight">{aparencia.titulo}</h1>
          </div>
          {aparencia.texto_boas_vindas && (
            <p className="mt-1 text-sm opacity-90">{aparencia.texto_boas_vindas}</p>
          )}
        </div>
        <nav
          aria-label="Módulos do sistema"
          className="flex gap-1 overflow-x-auto bg-card px-2 py-2"
        >
          <MenuLink id={id} caminho="" rotulo="Painel" exato destaque={aparencia.cor_destaque} />
          {MENU.filter((m) => modulos.includes(m.modulo)).map((m) => (
            <MenuLink
              key={m.caminho}
              id={id}
              caminho={m.caminho}
              rotulo={m.rotulo ?? rotuloModulo(app, m.modulo)}
              destaque={aparencia.cor_destaque}
            />
          ))}
          <MenuLink
            id={id}
            caminho="perguntar"
            rotulo="Perguntar"
            destaque={aparencia.cor_destaque}
          />
        </nav>
      </div>
      <Outlet />
    </AppContext.Provider>
  );
}

function MenuLink({
  id,
  caminho,
  rotulo,
  exato,
  destaque,
}: {
  id: string;
  caminho: string;
  rotulo: string;
  exato?: boolean;
  destaque: string;
}) {
  return (
    <Link
      to={caminho ? `/sistemas/$id/app/${caminho}` : "/sistemas/$id/app"}
      params={{ id }}
      activeOptions={{ exact: exato ?? false }}
      className={cn(
        "shrink-0 rounded-t-md border-b-2 border-transparent px-3 py-1.5 text-sm text-muted-foreground",
        "hover:bg-muted hover:text-foreground data-[status=active]:border-[var(--destaque)] data-[status=active]:font-medium data-[status=active]:text-foreground",
      )}
      style={{ ["--destaque" as string]: destaque }}
    >
      {rotulo}
    </Link>
  );
}
