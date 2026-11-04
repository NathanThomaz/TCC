import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/nexus/Estados";

export function Configuracoes() {
  return (
    <>
      <PageHeader titulo="Configurações" />
      <EmptyState
        icone={Users}
        titulo="Gestão de contas em breve"
        descricao="Convidar e gerenciar contas secundárias estará disponível em uma próxima versão."
      />
    </>
  );
}
