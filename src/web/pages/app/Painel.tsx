import { CalendarDays, Package, ShoppingCart, Users, Wrench, type LucideIcon } from "lucide-react";
import type { ModuleId } from "../../../shared/contract/catalog";
import { Link } from "@/lib/rotas";
import { rotuloModulo, useApp } from "./Aplicacao";

// Painel da aplicação (seção 6): atalhos para os módulos ativos, regras em vigor e a versão.
// Sem dashboard financeiro ou analítico (fora do escopo).

const ATALHOS: { modulo: ModuleId; caminho: string; icone: LucideIcon; texto: string }[] = [
  { modulo: "vendas", caminho: "vendas/nova", icone: ShoppingCart, texto: "Abrir uma venda" },
  { modulo: "produtos", caminho: "produtos", icone: Package, texto: "Produtos, preços e saldos" },
  { modulo: "agenda", caminho: "agenda", icone: CalendarDays, texto: "Agenda por profissional" },
  { modulo: "clientes", caminho: "clientes", icone: Users, texto: "Cadastro de clientes" },
  {
    modulo: "profissionais",
    caminho: "profissionais",
    icone: Wrench,
    texto: "Equipe de atendimento",
  },
];

export function Painel() {
  const app = useApp();
  const { config } = app;
  const regras = config.regras.map((r) => {
    switch (r.tipo) {
      case "limite_atacado":
        return `Atacado quando o subtotal a varejo chega a ${(r.valor_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`;
      case "unidades_por_caixa":
        return `Caixa padrão com ${r.unidades} unidades (cada produto pode ter a sua).`;
      case "prazo_reserva":
        return `O rascunho de venda segura o estoque por ${r.minutos} minutos sem alteração.`;
      case "par_atendimento": {
        const nome = (id: string) =>
          config.tipos_atendimento.find((t) => t.id === id)?.rotulo ?? id;
        return `${nome(r.primeiro)} e ${nome(r.segundo)} com o mesmo profissional, nessa ordem.`;
      }
    }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section aria-labelledby="titulo-atalhos" className="lg:col-span-2">
        <h2 id="titulo-atalhos" className="mb-3 text-lg font-semibold">
          Atalhos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ATALHOS.filter((a) => config.modulos.includes(a.modulo)).map((a) => (
            <Link
              key={a.modulo}
              to={`/sistemas/$id/app/${a.caminho}`}
              params={{ id: app.id }}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card hover:bg-muted/40"
            >
              <a.icone
                className="size-6 shrink-0"
                style={{ color: config.aparencia.cor_primaria }}
                aria-hidden
              />
              <span>
                <span className="block font-medium">{rotuloModulo(app, a.modulo)}</span>
                <span className="text-sm text-muted-foreground">{a.texto}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section
        aria-labelledby="titulo-regras"
        className="rounded-xl border bg-card p-4 shadow-card"
      >
        <h2 id="titulo-regras" className="mb-2 text-lg font-semibold">
          Regras em vigor
        </h2>
        {regras.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma regra parametrizada.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {regras.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Você entrou como {app.papel === "admin" ? "administrador" : "conta secundária"}.
        </p>
      </section>
    </div>
  );
}
