import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Tema = "claro" | "escuro";
const Ctx = createContext<{
  tema: Tema;
  alternar: () => void;
  /** Tema imposto por uma tela (ex.: o sistema do cliente); null volta à preferência. */
  forcar: (t: Tema | null) => void;
}>({
  tema: "claro",
  alternar: () => {},
  forcar: () => {},
});

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    try {
      const salvo = window.localStorage.getItem("nexus:tema");
      if (salvo === "claro" || salvo === "escuro") return salvo;
    } catch {
      // armazenamento bloqueado: segue a preferência do sistema
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  });

  const [forcado, setForcado] = useState<Tema | null>(null);
  const efetivo = forcado ?? tema;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", efetivo === "escuro");
  }, [efetivo]);

  const alternar = () => {
    // Dentro de um sistema com tema próprio, a troca vale só enquanto a pessoa está nele.
    if (forcado) return setForcado(forcado === "claro" ? "escuro" : "claro");
    setTema((t) => {
      const n = t === "claro" ? "escuro" : "claro";
      try {
        window.localStorage.setItem("nexus:tema", n);
      } catch {
        // armazenamento bloqueado: vale só nesta visita
      }
      return n;
    });
  };
  const forcar = useCallback((t: Tema | null) => setForcado(t), []);

  return <Ctx.Provider value={{ tema: efetivo, alternar, forcar }}>{children}</Ctx.Provider>;
}

export const useTema = () => useContext(Ctx);
