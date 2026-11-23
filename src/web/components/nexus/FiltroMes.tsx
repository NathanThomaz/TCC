import { CalendarDays } from "lucide-react";
import { mesesDoFiltro, nomeDoMes } from "../../../shared/dominio/periodo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * Mês dos números "do mês" (tela inicial e painel). Os números de hoje e o estado atual (estoque,
 * contas em aberto) não mudam com o filtro.
 */
export function FiltroMes({
  hoje,
  valor,
  onMudar,
}: {
  hoje: string;
  valor: string;
  onMudar: (mes: string) => void;
}) {
  return (
    <Select value={valor} onValueChange={onMudar}>
      <SelectTrigger className="w-auto gap-2 bg-card" aria-label="Mês dos números">
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {mesesDoFiltro(hoje).map((mes) => (
          <SelectItem key={mes} value={mes}>
            {capitalizar(nomeDoMes(mes))}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
