import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { paraCampoLocal } from "../../../shared/dominio/agenda";
import { mesDoDia, mesesDoFiltro, nomeDoMes } from "../../../shared/dominio/periodo";
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
 * contas em aberto) não mudam com o filtro. `valor` null = o mês atual. O seletor não depende dos
 * dados carregados: continua disponível se a consulta de um mês falhar.
 */
export function FiltroMes({
  valor,
  onMudar,
  carregando = false,
  hoje: hojeDaApi,
}: {
  valor: string | null;
  onMudar: (mes: string | null) => void;
  /** Os números na tela ainda são do mês anterior, enquanto os do escolhido carregam. */
  carregando?: boolean;
  /** Hoje segundo a última resposta da API (acompanha a virada do mês com a tela aberta). */
  hoje?: string | undefined;
}) {
  // Sem resposta ainda (ou com erro), vale o relógio deste aparelho, lido uma vez ao montar.
  const [hojeLocal] = useState(() => paraCampoLocal(Date.now()).slice(0, 10));
  const hoje = hojeDaApi ?? hojeLocal;
  const atual = mesDoDia(hoje);
  const escolhido = valor ?? atual;
  const meses = mesesDoFiltro(hoje);
  // Na virada do mês, a escolha pode ter saído da lista: continua visível enquanto estiver ativa.
  if (!meses.includes(escolhido)) meses.push(escolhido);
  return (
    <div className="flex items-center gap-2">
      <span role="status" className="text-sm text-muted-foreground">
        {carregando ? `Carregando ${nomeDoMes(escolhido)}…` : ""}
      </span>
      <Select value={escolhido} onValueChange={(m) => onMudar(m === atual ? null : m)}>
        <SelectTrigger className="w-auto gap-2 bg-card" aria-label="Mês dos números">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {meses.map((mes) => (
            <SelectItem key={mes} value={mes}>
              {capitalizar(nomeDoMes(mes))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
