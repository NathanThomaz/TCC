import { Compass } from "lucide-react";
import { Link } from "@/lib/rotas";

export function NaoEncontrada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Compass className="size-10 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="max-w-sm text-muted-foreground">O endereço não existe ou foi movido.</p>
      <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
        Voltar ao início
      </Link>
    </main>
  );
}
