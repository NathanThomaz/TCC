export const HEX = /^#[0-9A-Fa-f]{6}$/;

export function hexValido(hex: string) {
  return HEX.test(hex);
}

function canal(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminancia(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function razaoContraste(a: string, b: string) {
  const la = luminancia(a),
    lb = luminancia(b);
  const l1 = Math.max(la, lb),
    l2 = Math.min(la, lb);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Melhor cor de texto (preto ou branco) sobre um fundo e o contraste resultante. */
export function textoSobre(fundo: string): { cor: string; razao: number } {
  const b = razaoContraste(fundo, "#FFFFFF");
  const p = razaoContraste(fundo, "#000000");
  return b >= p ? { cor: "#FFFFFF", razao: b } : { cor: "#000000", razao: p };
}
