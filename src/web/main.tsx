import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import { AppShell } from "@/components/nexus/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { TemaProvider } from "@/lib/tema";
import { Agenda } from "@/pages/app/Agenda";
import { Aplicacao } from "@/pages/app/Aplicacao";
import { Consulta } from "@/pages/app/Consulta";
import { Estoque } from "@/pages/app/Estoque";
import { Painel } from "@/pages/app/Painel";
import { Pessoas } from "@/pages/app/Pessoas";
import { Produtos } from "@/pages/app/Produtos";
import { VendaEditor } from "@/pages/app/VendaEditor";
import { Vendas } from "@/pages/app/Vendas";
import { Configuracoes } from "@/pages/Configuracoes";
import { Configurar } from "@/pages/Configurar";
import { Criar } from "@/pages/Criar";
import { CriarRevisao } from "@/pages/CriarRevisao";
import { DetalheSistema } from "@/pages/DetalheSistema";
import { Entrar } from "@/pages/Entrar";
import { Inicio } from "@/pages/Inicio";
import { NaoEncontrada } from "@/pages/NaoEncontrada";
import { Pedidos } from "@/pages/Pedidos";
import { Perfil } from "@/pages/Perfil";
import { Sistemas } from "@/pages/Sistemas";
// Inter hospedada no próprio app (a CSP só permite fontes do mesmo domínio).
import "@fontsource-variable/inter";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Autenticado() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TemaProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/entrar" element={<Entrar />} />
              <Route element={<Autenticado />}>
                <Route index element={<Inicio />} />
                <Route path="/sistemas" element={<Sistemas />} />
                <Route path="/sistemas/:id" element={<DetalheSistema />} />
                <Route path="/sistemas/:id/configurar" element={<Configurar />} />
                <Route path="/sistemas/:id/criar" element={<Criar />} />
                <Route path="/sistemas/:id/criar/revisao" element={<CriarRevisao />} />
                <Route path="/sistemas/:id/pedidos" element={<Pedidos />} />
                <Route path="/sistemas/:id/app" element={<Aplicacao />}>
                  <Route index element={<Painel />} />
                  <Route path="clientes" element={<Pessoas tipo="clientes" />} />
                  <Route path="profissionais" element={<Pessoas tipo="profissionais" />} />
                  <Route path="produtos" element={<Produtos />} />
                  <Route path="estoque" element={<Estoque />} />
                  <Route path="vendas" element={<Vendas />} />
                  <Route path="vendas/:venda" element={<VendaEditor />} />
                  <Route path="agenda" element={<Agenda />} />
                  <Route path="perguntar" element={<Consulta />} />
                </Route>
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
              <Route path="*" element={<NaoEncontrada />} />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </TemaProvider>
    </QueryClientProvider>
  </StrictMode>,
);
