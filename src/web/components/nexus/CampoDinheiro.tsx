import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { completarReais, mascararReais } from "@/lib/nexus";
import { cn } from "@/lib/utils";

/**
 * Campo de valor em reais (pedido do dono, 2026-11-14): enquanto digita, põe os pontos dos
 * milhares e a vírgula; ao sair, completa as duas casas ("1500" → "1.500,00").
 */
export function CampoDinheiro({
  valor,
  onValor,
  className,
  onBlur,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  valor: string;
  onValor: (texto: string) => void;
}) {
  return (
    <Input
      {...props}
      inputMode="decimal"
      autoComplete="off"
      className={cn("tabular-nums", className)}
      value={valor}
      onChange={(e) => onValor(mascararReais(e.target.value))}
      onBlur={(e) => {
        onValor(completarReais(valor));
        onBlur?.(e);
      }}
    />
  );
}
