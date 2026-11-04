import type { CriacaoApiBody } from "../../shared/api";
import { chamar, novaChave } from "./cliente";

// Criação por conversa (/api/v1/systems/:id/criacao). Toda rota devolve o estado completo da
// conversa: mensagens, requisitos vivos, disponibilidade da IA e a última versão com diagnóstico.

export type EstadoCriacao = Required<Omit<CriacaoApiBody, "error">>;

function base(sistema: string) {
  return `/systems/${encodeURIComponent(sistema)}/criacao`;
}

function estado(r: CriacaoApiBody): EstadoCriacao {
  return {
    revisao: r.revisao ?? 0,
    mensagens: r.mensagens ?? [],
    requisitos: r.requisitos ?? [],
    iaDisponivel: r.iaDisponivel ?? false,
    versao: r.versao ?? null,
    issues: r.issues ?? [],
  };
}

export async function obterCriacao(sistema: string) {
  return estado(await chamar<CriacaoApiBody>(base(sistema)));
}

export async function enviarMensagem(
  sistema: string,
  revisao: number,
  texto: string,
  chave: string,
) {
  return estado(
    await chamar<CriacaoApiBody>(`${base(sistema)}/mensagens`, {
      method: "POST",
      body: { texto, revisao },
      chave,
    }),
  );
}

export async function acaoRequisito(
  sistema: string,
  codigo: string,
  acao: "confirmar" | "editar" | "descartar",
  revisao: number,
  texto?: string,
) {
  return estado(
    await chamar<CriacaoApiBody>(
      `${base(sistema)}/requisitos/${encodeURIComponent(codigo)}/${acao}`,
      {
        method: "POST",
        body: texto === undefined ? { revisao } : { texto, revisao },
        chave: novaChave(),
      },
    ),
  );
}

export async function adicionarRequisito(
  sistema: string,
  revisao: number,
  texto: string,
  chave: string,
) {
  return estado(
    await chamar<CriacaoApiBody>(`${base(sistema)}/requisitos`, {
      method: "POST",
      body: { texto, revisao },
      chave,
    }),
  );
}

/** Gerar e corrigir: estrutura fora do contrato volta com 422 e o diagnóstico, sem versão. */
export async function gerarConfiguracao(sistema: string, revisao: number, chave: string) {
  return chamar<CriacaoApiBody>(`${base(sistema)}/gerar`, {
    method: "POST",
    body: { revisao },
    chave,
  });
}

export async function corrigirConfiguracao(
  sistema: string,
  revisao: number,
  versao: string,
  chave: string,
) {
  return chamar<CriacaoApiBody>(`${base(sistema)}/corrigir`, {
    method: "POST",
    body: { versao, revisao },
    chave,
  });
}
