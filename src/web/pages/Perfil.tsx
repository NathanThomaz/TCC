import { useAuth } from "@/lib/auth";
import { ROTULO_PAPEL } from "@/components/nexus/AppShell";
import { PageHeader } from "@/components/nexus/Estados";

export function Perfil() {
  const { usuario } = useAuth();
  if (!usuario) return null;
  return (
    <>
      <PageHeader
        titulo="Perfil"
        descricao="Dados da conta. A edição chegará em uma próxima versão."
      />
      <dl className="divide-y rounded-xl border bg-card shadow-card">
        {[
          ["Nome", usuario.nome],
          ["E-mail", usuario.email],
          ["Papel", ROTULO_PAPEL[usuario.papel]],
        ].map(([k, v]) => (
          <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-3">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium sm:col-span-2">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
