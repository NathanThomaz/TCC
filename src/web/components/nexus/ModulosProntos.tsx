import { CircleCheck } from "lucide-react";
import { NATIVE_FIELDS, type FieldEntity } from "../../../shared/contract/catalog";
import type { Modulo } from "@/types/nexus";
import { ROTULO_MODULO } from "@/lib/nexus";

// O que cada módulo já traz pronto (funções e campos), para o dono não pedir o que já existe nem
// criar campo duplicado. Os campos vêm do catálogo (NATIVE_FIELDS), a mesma lista do validador.

const FUNCOES: Record<Modulo, string[]> = {
  clientes: ["Cadastro de clientes, com inativação sem apagar o histórico"],
  produtos: ["Preço de varejo e de atacado por produto", "Venda avulsa ou por caixa"],
  vendas: [
    "Pedido em rascunho que reserva o estoque",
    "Atacado automático pelo valor dos produtos",
    "Concluir e cancelar com motivo",
  ],
  estoque: ["Entradas e ajustes com motivo", "Estoque físico, reservado e disponível"],
  profissionais: ["Cadastro de profissionais, com inativação"],
  agenda: [
    "Atendimentos com duração por tipo",
    "Sem horário em conflito para o mesmo profissional",
    "Atendimentos em par (ex.: instalação e retirada)",
  ],
};

const ENTIDADE: Partial<Record<Modulo, FieldEntity>> = {
  clientes: "clientes",
  produtos: "produtos",
  profissionais: "profissionais",
  vendas: "vendas",
  agenda: "agendamentos",
};

export function ModulosProntos({ modulos, titulo }: { modulos: Modulo[]; titulo: string }) {
  return (
    <section aria-label={titulo} className="rounded-lg border bg-card p-4 shadow-card">
      <h3 className="mb-3 font-semibold">{titulo}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m) => {
          const entidade = ENTIDADE[m];
          return (
            <div key={m} className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <CircleCheck className="size-4 text-success" aria-hidden /> {ROTULO_MODULO[m]}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-6 text-sm text-muted-foreground">
                {FUNCOES[m].map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {entidade && (
                <p className="mt-1 pl-6 text-xs text-muted-foreground">
                  Campos: {NATIVE_FIELDS[entidade].map((n) => n.label).join(" · ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
