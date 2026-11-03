import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Tema = "claro" | "escuro";
const Ctx = createContext<{ tema: Tema; alternar: () => void }>({
  tema: "claro",
  alternar: () => {},
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
  }, [tema]);

  const alternar = () =>
    setTema((t) => {
      const n = t === "claro" ? "escuro" : "claro";
      window.localStorage.setItem("nexus:tema", n);
      return n;
    });

  return <Ctx.Provider value={{ tema, alternar }}>{children}</Ctx.Provider>;
}

export const useTema = () => useContext(Ctx);
