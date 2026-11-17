import { useLayoutEffect, useState, type CSSProperties } from "react";

// Altura que sobra do topo do elemento até o fim da janela, no computador (a partir de 1024 px).
// As conversas com a IA usam para ocupar a tela inteira: a lista de mensagens rola por dentro e a
// caixa de resposta fica sempre visível, sem sobrar espaço vazio embaixo nem rolar a página. No
// celular não mexe (a página rola normalmente).

const COMPUTADOR = "(min-width: 1024px)";

export function useAlturaRestante<T extends HTMLElement>(
  /** Espaço que fica abaixo do elemento (margem da página e o que vier depois dele). */
  folga = 32,
  /** Abaixo disso a página rola, em vez de espremer a conversa. */
  minimo = 320,
): { medir: (el: T | null) => void; estilo: CSSProperties | undefined } {
  // Ref por função: a conversa só aparece depois de carregar, e a medida começa quando ela surge.
  const [el, setEl] = useState<T | null>(null);
  const [altura, setAltura] = useState<number | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia?.(COMPUTADOR);
    const medir = () => {
      if (!el || !mq?.matches) return setAltura(null);
      const topo = el.getBoundingClientRect().top + window.scrollY;
      setAltura(Math.max(minimo, Math.floor(window.innerHeight - topo - folga)));
    };
    medir();
    window.addEventListener("resize", medir);
    mq?.addEventListener?.("change", medir);
    // O que fica acima pode mudar de tamanho (avisos, etapas que quebram linha).
    const observador =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => medir());
    if (el?.parentElement) observador?.observe(el.parentElement);
    return () => {
      window.removeEventListener("resize", medir);
      mq?.removeEventListener?.("change", medir);
      observador?.disconnect();
    };
  }, [el, folga, minimo]);

  return { medir: setEl, estilo: altura === null ? undefined : { height: altura } };
}
