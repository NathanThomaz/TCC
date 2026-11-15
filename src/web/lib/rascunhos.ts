import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { useBusca } from "@/lib/rotas";

// Rascunhos automáticos (pedido do dono, 2026-11-15): o formulário começado e não salvo (venda,
// produto, cadastro de pessoa, compra, conta, agendamento) fica guardado NESTE aparelho, por conta
// e por sistema, enquanto a pessoa digita; a aba Rascunhos lista e retoma. Salvou de verdade, o
// rascunho some. Nada vai ao servidor: sem armazenamento (janela privada), só não fica guardado.

export type TipoRascunho =
  | "venda"
  | "produto"
  | "clientes"
  | "profissionais"
  | "fornecedores"
  | "compra"
  | "conta"
  | "agendamento";

export interface Rascunho<T = unknown> {
  id: string;
  tipo: TipoRascunho;
  /** O que identifica o rascunho na lista (ex.: o nome do produto). */
  titulo: string;
  resumo: string;
  dados: T;
  atualizadoEm: number;
}

/** Limite por sistema: o mais antigo sai quando passa disso. */
const LIMITE = 30;
const ESPERA_MS = 600;
const EVENTO = "nexus:rascunhos";
const VAZIA: Rascunho[] = [];

const chaveDe = (conta: string, sistema: string) => `nexus:rascunhos:${conta}:${sistema}`;

function bruto(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function ler(chave: string): Rascunho[] {
  try {
    const lista: unknown = JSON.parse(bruto(chave) ?? "[]");
    return Array.isArray(lista) ? (lista as Rascunho[]) : [];
  } catch {
    return [];
  }
}

/** Grava a lista; falso quando o navegador não guardou (sem armazenamento ou cheio). */
function gravar(chave: string, lista: Rascunho[]): boolean {
  let ok = true;
  try {
    if (lista.length) localStorage.setItem(chave, JSON.stringify(lista.slice(-LIMITE)));
    else localStorage.removeItem(chave);
  } catch {
    // O formulário segue funcionando, só sem rascunho; o aviso de "guardado" não aparece.
    ok = false;
  }
  window.dispatchEvent(new Event(EVENTO));
  return ok;
}

// O useSyncExternalStore exige o mesmo objeto enquanto nada mudou.
const cache = new Map<string, { bruto: string | null; lista: Rascunho[] }>();
function foto(chave: string): Rascunho[] {
  const atual = bruto(chave);
  const visto = cache.get(chave);
  if (visto && visto.bruto === atual) return visto.lista;
  const lista = ler(chave).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  cache.set(chave, { bruto: atual, lista });
  return lista;
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  // Outra aba do mesmo navegador mexeu nos rascunhos.
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

function useChave(sistema: string) {
  const conta = useAuth().usuario?.email ?? "anonimo";
  return chaveDe(conta, sistema);
}

/** Rascunhos do sistema, do mais recente ao mais antigo. */
export function useRascunhos(sistema: string) {
  const chave = useChave(sistema);
  const lista = useSyncExternalStore(
    assinar,
    () => foto(chave),
    () => VAZIA,
  );
  return {
    lista,
    remover: (id: string) =>
      gravar(
        chave,
        ler(chave).filter((r) => r.id !== id),
      ),
  };
}

/** Rascunho aberto pela aba Rascunhos (?rascunho=id), se for deste tipo de formulário. */
export function useRascunhoDaBusca<T>(sistema: string, tipo: TipoRascunho): Rascunho<T> | null {
  const id = useBusca().rascunho;
  const chave = useChave(sistema);
  if (!id) return null;
  const achado = ler(chave).find((r) => r.id === id && r.tipo === tipo);
  return (achado as Rascunho<T> | undefined) ?? null;
}

/**
 * Guarda o formulário enquanto a pessoa digita (com uma pequena espera e ao fechar). `vazio`
 * apaga o rascunho; `descartar` é chamado quando o formulário foi salvo de verdade.
 */
export function useRascunho<T>(o: {
  sistema: string;
  tipo: TipoRascunho;
  /** Falso na edição de um registro que já existe: só formulário novo vira rascunho. */
  ativo: boolean;
  inicial: Rascunho<T> | null;
  dados: T;
  vazio: boolean;
  titulo: string;
  resumo: string;
}): { salvoEm: number | null; descartar: () => void } {
  const chave = useChave(o.sistema);
  const id = useRef(o.inicial?.id ?? crypto.randomUUID());
  const [salvoEm, setSalvoEm] = useState<number | null>(o.inicial?.atualizadoEm ?? null);
  const encerrado = useRef(false);
  const pendente = useRef<(() => void) | null>(null);
  // Abrir um rascunho sem mexer não muda a data dele.
  const ultimo = useRef(o.inicial ? JSON.stringify(o.inicial.dados) : null);
  const texto = JSON.stringify(o.dados);
  const { ativo, vazio, tipo, titulo, resumo } = o;

  useEffect(() => {
    if (!ativo || encerrado.current) return;
    // Voltou ao que já está guardado: a gravação pendente (de uma edição desfeita) não vale mais.
    if (texto === ultimo.current) {
      pendente.current = null;
      return;
    }
    const escrever = () => {
      pendente.current = null;
      if (encerrado.current) return;
      const outros = ler(chave).filter((r) => r.id !== id.current);
      const agora = Date.now();
      const ok = vazio
        ? gravar(chave, outros)
        : gravar(chave, [
            ...outros,
            {
              id: id.current,
              tipo,
              titulo,
              resumo,
              dados: JSON.parse(texto) as T,
              atualizadoEm: agora,
            },
          ]);
      // Só marca como guardado o que o navegador guardou; se falhou, tenta de novo na próxima
      // alteração (o texto não vira o "último guardado").
      if (ok) ultimo.current = texto;
      setSalvoEm(ok && !vazio ? agora : null);
    };
    pendente.current = escrever;
    const t = setTimeout(escrever, ESPERA_MS);
    return () => clearTimeout(t);
  }, [ativo, chave, texto, vazio, tipo, titulo, resumo]);

  // Fechou o formulário, a aba ou recarregou antes da espera: grava o que faltava.
  useEffect(() => {
    const gravarPendente = () => pendente.current?.();
    const aoEsconder = () => document.visibilityState === "hidden" && gravarPendente();
    window.addEventListener("pagehide", gravarPendente);
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      window.removeEventListener("pagehide", gravarPendente);
      document.removeEventListener("visibilitychange", aoEsconder);
      gravarPendente();
    };
  }, []);

  return {
    salvoEm,
    descartar: () => {
      encerrado.current = true;
      pendente.current = null;
      gravar(
        chave,
        ler(chave).filter((r) => r.id !== id.current),
      );
    },
  };
}
