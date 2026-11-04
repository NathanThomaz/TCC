import { useQueryClient } from "@tanstack/react-query";
import { onIdTokenChanged } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

/** Rascunhos do assistente ficam no sessionStorage; saem junto com a conta. */
function apagarRascunhos() {
  try {
    for (const k of Object.keys(window.sessionStorage)) {
      if (k.startsWith("nexus:rascunho:")) window.sessionStorage.removeItem(k);
    }
  } catch {
    // armazenamento indisponível: nada a apagar
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [pronto, setPronto] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [expirada, setExpirada] = useState(false);
  // Geração da sessão: respostas atrasadas de uma sessão anterior são ignoradas.
  const geracao = useRef(0);
  const uidAtual = useRef<string | null>(null);

  /** Troca de identidade (logout, outra conta): nenhum dado da anterior pode aparecer. */
  const limparDados = useCallback(() => {
    qc.clear();
    apagarRascunhos();
  }, [qc]);

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
        const minha = ++geracao.current;
        const uid = fb?.uid ?? null;
        if (uid !== uidAtual.current) {
          if (uidAtual.current !== null) limparDados();
          uidAtual.current = uid;
        }
        if (!fb) {
          setUsuario(null);
          setPronto(true);
          return;
        }
        obterSessao()
          .then((u) => {
            if (minha !== geracao.current || auth.currentUser?.uid !== fb.uid) return;
            setUsuario(u);
            setExpirada(false);
          })
          .catch((error: unknown) => {
            if (minha !== geracao.current) return;
            setUsuario(null);
            // Só encerra o login se o backend recusou a conta (403); queda de rede não desloga.
            if (error instanceof ApiError && error.status === 403) void sairDoFirebase();
          })
          .finally(() => {
            if (minha === geracao.current) setPronto(true);
          });
      });
    });
    return () => {
      cancelado = true;
      desligar?.();
    };
  }, [limparDados]);

  useEffect(() => {
    quandoSessaoExpirar(() => {
      geracao.current++;
      setExpirada(true);
      setUsuario(null);
      limparDados();
    });
    return () => quandoSessaoExpirar(undefined);
  }, [limparDados]);

  const iniciar = useCallback((u: Usuario) => {
    setUsuario(u);
    setExpirada(false);
  }, []);

  const sair = useCallback(() => {
    geracao.current++;
    setUsuario(null);
    limparDados();
    void sairDoFirebase();
  }, [limparDados]);

  return (
    <Ctx.Provider value={{ pronto, usuario, expirada, iniciar, sair }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora do AuthProvider");
  return v;
}
