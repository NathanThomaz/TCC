import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { completarReais, mascararReais } from "@/lib/nexus";
import { cn } from "@/lib/utils";

/**
 * Quantos dígitos e vírgulas do valor mascarado ficam antes do cursor. Conta também o ponto que a
 * máscara transforma em vírgula (digitado no fim ou colado como decimal) e desconta os zeros à
 * esquerda que ela remove.
 */
export function posicaoSignificativa(bruto: string, cursor: number, mascarado: string): number {
  const antes = bruto.slice(0, cursor);
  let n = antes.replace(/[^\d,]/g, "").length;
  const pontoVirouVirgula = !bruto.includes(",") && mascarado.includes(",");
  if (pontoVirouVirgula) {
    const ponto = bruto.lastIndexOf(".");
    if (ponto >= 0 && ponto < cursor) n++;
  }
  const zeros = /^0+(?=\d)/.exec(bruto.replace(/[^\d,]/g, ""))?.[0].length ?? 0;
  return n - Math.min(zeros, n);
}

/** Posição logo depois do n-ésimo dígito ou vírgula do texto mascarado. */
export function posicaoDepois(texto: string, n: number): number {
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
  // Muda a cada digitação: reposiciona o cursor mesmo quando o valor mascarado não muda
  // (ex.: zero à esquerda), já que o React devolve o texto anterior ao campo.
  const [digitacao, setDigitacao] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && cursor.current !== null && document.activeElement === el) {
      const pos = posicaoDepois(valor, cursor.current);
      el.setSelectionRange(pos, pos);
    }
    cursor.current = null;
  }, [valor, digitacao]);

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
        // Ponto decimal só quando ele é novo: colado, ou digitado agora (mais pontos que antes).
        // Os pontos que já estavam são os milhares da máscara: apagar ou trocar dígitos
        // ("1.500" → "1.50" ou "1.2") continua um número inteiro.
        const tipo = (e.nativeEvent as InputEvent).inputType ?? "";
        const pontos = (t: string) => t.split(".").length - 1;
        const colado = tipo === "insertFromPaste" || tipo === "insertFromDrop";
        const pontoNovo = !tipo.startsWith("delete") && (colado || pontos(bruto) > pontos(valor));
        const mascarado = mascararReais(bruto, pontoNovo);
        cursor.current = posicaoSignificativa(
          bruto,
          e.target.selectionStart ?? bruto.length,
          mascarado,
        );
        setDigitacao((n) => n + 1);
        onValor(mascarado);
      }}
      onBlur={(e) => {
        onValor(completarReais(valor));
        onBlur?.(e);
      }}
    />
  );
}
