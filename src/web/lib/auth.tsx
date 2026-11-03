import { onIdTokenChanged } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { obterSessao, sairDoFirebase, type Usuario } from "@/api/auth";
import { ApiError, quandoSessaoExpirar } from "@/api/cliente";
import { obterAuth } from "@/lib/firebase";

// Sessão real: o Firebase guarda o login e renova o token; o papel e a validade da conta vêm
// sempre do backend (/api/v1/session), nunca do navegador. Mesma interface das telas originais.

interface AuthValor {
  pronto: boolean;
  usuario: Usuario | null;
  expirada: boolean;
  iniciar: (u: Usuario) => void;
  sair: () => void;
}

const Ctx = createContext<AuthValor | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [expirada, setExpirada] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let desligar: (() => void) | undefined;
    void obterAuth().then((auth) => {
      if (cancelado) return;
      if (!auth) {
        setPronto(true);
        return;
      }
      desligar = onIdTokenChanged(auth, (fb) => {
        if (!fb) {
          setUsuario(null);
          setPronto(true);
          return;
        }
        obterSessao()
          .then((u) => {
            setUsuario(u);
            setExpirada(false);
          })
          .catch((error: unknown) => {
            setUsuario(null);
            // Só encerra o login se o backend recusou a conta (403); queda de rede não desloga.
            if (error instanceof ApiError && error.status === 403) void sairDoFirebase();
          })
          .finally(() => setPronto(true));
      });
    });
    return () => {
      cancelado = true;
      desligar?.();
    };
  }, []);

  useEffect(() => {
    quandoSessaoExpirar(() => {
      setExpirada(true);
      setUsuario(null);
    });
    return () => quandoSessaoExpirar(undefined);
  }, []);

  const iniciar = useCallback((u: Usuario) => {
    setUsuario(u);
    setExpirada(false);
  }, []);

  const sair = useCallback(() => {
    setUsuario(null);
    void sairDoFirebase();
  }, []);

  return (
    <Ctx.Provider value={{ pronto, usuario, expirada, iniciar, sair }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora do AuthProvider");
  return v;
}
