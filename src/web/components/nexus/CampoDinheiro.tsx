import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { completarReais, mascararReais } from "@/lib/nexus";
import { cn } from "@/lib/utils";

/** Quantos dígitos e vírgulas há antes da posição: o que a máscara não muda de lugar. */
function significativos(texto: string, ate: number): number {
  return texto.slice(0, ate).replace(/[^\d,]/g, "").length;
}

/** Posição logo depois do n-ésimo dígito ou vírgula do texto mascarado. */
function posicaoDepois(texto: string, n: number): number {
  if (n <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/[\d,]/.test(texto[i]!)) vistos++;
    if (vistos === n) return i + 1;
  }
  return texto.length;
}

/**
 * Campo de valor em reais (pedido do dono, 2026-11-14): enquanto digita, põe os pontos dos
 * milhares e a vírgula sem tirar o cursor do lugar; ao sair, completa as duas casas
 * ("1500" → "1.500,00"). O texto mascarado já converte certo (reaisParaCentavos), com ou sem foco.
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
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && cursor.current !== null && document.activeElement === el) {
      const pos = posicaoDepois(valor, cursor.current);
      el.setSelectionRange(pos, pos);
    }
    cursor.current = null;
  }, [valor]);

  return (
    <Input
      {...props}
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      className={cn("tabular-nums", className)}
      value={valor}
      onChange={(e) => {
        const bruto = e.target.value;
        cursor.current = significativos(bruto, e.target.selectionStart ?? bruto.length);
        onValor(mascararReais(bruto, bruto.length < valor.length));
      }}
      onBlur={(e) => {
        onValor(completarReais(valor));
        onBlur?.(e);
      }}
    />
  );
}
