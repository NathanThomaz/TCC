import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@/lib/rotas";
import {
  Boxes,
  ChevronDown,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTema } from "@/lib/tema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", rotulo: "Início", Icone: Home },
  { to: "/sistemas", rotulo: "Sistemas", Icone: LayoutGrid },
  { to: "/perfil", rotulo: "Perfil", Icone: UserRound },
  { to: "/configuracoes", rotulo: "Configurações", Icone: Settings },
] as const;

export const ROTULO_PAPEL = { administrador: "Administrador", secundario: "Secundário" } as const;

function Navegacao({ onNavegar }: { onNavegar?: () => void }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV.map(({ to, rotulo, Icone }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavegar}
          activeOptions={{ exact: to === "/" }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
        >
          <Icone className="size-4" strokeWidth={2} aria-hidden />
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}

function Marca() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-md font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Boxes className="size-4.5" strokeWidth={2} aria-hidden />
      </span>
      Nexus
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pronto, usuario, expirada, sair } = useAuth();
  const { tema, alternar } = useTema();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!pronto || usuario) return;
    if (expirada) sair();
    navigate({ to: "/entrar", search: expirada ? { motivo: "sessao_expirada" } : {} });
  }, [pronto, usuario, expirada, sair, navigate]);

  if (!pronto || !usuario) {
    return (
      <div className="p-8" aria-busy="true" aria-label="Carregando">
        <Skeleton className="mb-6 h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur">
        <Sheet open={menu} onOpenChange={setMenu}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-sidebar">
            <SheetHeader>
              <SheetTitle>Navegação</SheetTitle>
            </SheetHeader>
            <div className="px-3">
              <Navegacao onNavegar={() => setMenu(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <Marca />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={alternar}
            aria-label={tema === "claro" ? "Usar tema escuro" : "Usar tema claro"}
          >
            {tema === "claro" ? <Moon aria-hidden /> : <Sun aria-hidden />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto gap-2 px-2 py-1.5"
                aria-label={`Conta: ${usuario.email}`}
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {usuario.email.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium">{usuario.email}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ROTULO_PAPEL[usuario.papel]}
                  </span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-medium">{usuario.email}</span>
                <span className="block text-xs text-muted-foreground">
                  {ROTULO_PAPEL[usuario.papel]}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/perfil">
                  <UserRound aria-hidden /> Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  sair();
                  navigate({ to: "/entrar", search: {} });
                }}
              >
                <LogOut aria-hidden /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-sidebar p-3 md:block">
          <Navegacao />
        </aside>
        <main id="conteudo" className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
