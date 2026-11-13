import { CircleCheck } from "lucide-react";
import { NATIVE_FIELDS, type FieldEntity } from "../../../shared/contract/catalog";
import type { Modulo, Regra } from "@/types/nexus";
import { ROTULO_MODULO } from "@/lib/nexus";

// O que cada módulo já traz (funções e campos), para o dono não pedir o que já existe nem criar
// campo duplicado. Os campos vêm do catálogo (NATIVE_FIELDS), a mesma lista do validador. Função
// que depende de uma regra só aparece como ativa quando a regra está na configuração.

const FUNCOES: Record<Modulo, { texto: string; regra?: Regra["tipo"] }[]> = {
  clientes: [{ texto: "Cadastro de clientes, com inativação sem apagar o histórico" }],
  produtos: [
    { texto: "Preço de varejo e de atacado por produto" },
    { texto: "Venda por caixa", regra: "unidades_por_caixa" },
  ],
  vendas: [
    { texto: "Pedido em rascunho que reserva o estoque" },
    { texto: "Atacado automático pelo valor dos produtos", regra: "limite_atacado" },
    { texto: "Concluir e cancelar com motivo" },
  ],
  estoque: [
    { texto: "Entradas e ajustes com motivo" },
    { texto: "Estoque físico, reservado e disponível" },
  ],
  profissionais: [{ texto: "Cadastro de profissionais, com inativação" }],
  agenda: [
    { texto: "Atendimentos com duração por tipo" },
    { texto: "Sem horário em conflito para o mesmo profissional" },
    { texto: "Atendimentos em par (ex.: instalação e retirada)", regra: "par_atendimento" },
  ],
};

const ENTIDADE: Partial<Record<Modulo, FieldEntity>> = {
  clientes: "clientes",
  produtos: "produtos",
  profissionais: "profissionais",
  vendas: "vendas",
  agenda: "agendamentos",
};

/**
 * Sem `regras` (escolha do modelo), mostra o que o módulo oferece, com "(opcional)" no que depende
 * de ajuste. Com `regras` (sistema montado), mostra só o que está ativo.
 */
export function ModulosProntos({
  modulos,
  titulo,
  regras,
}: {
  modulos: Modulo[];
  titulo: string;
  regras?: Regra[];
}) {
  const ativa = (t: Regra["tipo"]) => regras?.some((r) => r.tipo === t) ?? false;
  return (
    <section aria-label={titulo} className="rounded-lg border bg-card p-4 shadow-card">
      <h3 className="mb-3 font-semibold">{titulo}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m) => {
          const entidade = ENTIDADE[m];
          const funcoes = FUNCOES[m].filter((f) => !regras || !f.regra || ativa(f.regra));
          return (
            <div key={m} className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <CircleCheck className="size-4 text-success" aria-hidden /> {ROTULO_MODULO[m]}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-6 text-sm text-muted-foreground">
                {funcoes.map((f) => (
                  <li key={f.texto}>
                    {f.texto}
                    {!regras && f.regra && " (opcional)"}
                  </li>
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
