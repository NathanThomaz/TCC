import type { InicioDto, SystemsApiBody } from "../../shared/api";
import type { ConfigDraft, Issue, Sistema, Versao } from "@/types/nexus";
import { ApiError, chamar, novaChave } from "./cliente";

// Mesma interface das telas do laboratório, agora sobre a API real (/api/v1/systems).

function exigir<T>(valor: T | undefined | null, campo: string): T {
  if (valor === undefined || valor === null) {
    throw new ApiError("resposta_inesperada", `Resposta sem ${campo}.`);
  }
  return valor;
}

export async function listarSistemas(): Promise<Sistema[]> {
  return exigir((await chamar<SystemsApiBody>("/systems")).sistemas, "sistemas");
}

/** Resumo da tela inicial: sistemas com os números do painel, pedidos e uso da IA. */
export async function obterInicio(): Promise<InicioDto> {
  return exigir((await chamar<SystemsApiBody>("/inicio")).inicio, "resumo");
}

export async function criarSistema(nome: string, chave = novaChave()): Promise<Sistema> {
  const r = await chamar<SystemsApiBody>("/systems", { method: "POST", body: { nome }, chave });
  return exigir(r.sistema, "sistema");
}

export interface DetalheSistema {
  sistema: Sistema;
  versoes: Versao[];
  /** Configuração da versão mais recente, ponto de partida do assistente. */
  ultimaConfig: ConfigDraft | null;
}

export async function obterSistema(id: string): Promise<DetalheSistema> {
  const r = await chamar<SystemsApiBody>(`/systems/${encodeURIComponent(id)}`);
  return {
    sistema: exigir(r.sistema, "sistema"),
    versoes: r.versoes ?? [],
    ultimaConfig: r.ultimaConfig ?? null,
  };
}

/** Grava a versão e devolve o diagnóstico; estrutura inválida vem sem versão (422). */
export async function salvarVersao(
  id: string,
  rascunho: ConfigDraft,
  chave = novaChave(),
  /** "chat": a versão da conversa com um ajuste do dono na revisão (ex.: nomes das telas). */
  origem: "formulario" | "chat" = "formulario",
): Promise<{ versao: Versao | null; issues: Issue[] }> {
  const r = await chamar<SystemsApiBody>(`/systems/${encodeURIComponent(id)}/versions`, {
    method: "POST",
    body: { origem, rascunho },
    chave,
  });
  return { versao: r.versao ?? null, issues: r.issues ?? [] };
}

export async function aprovarVersao(id: string, versaoId: string, hash: string): Promise<Versao> {
  const r = await chamar<SystemsApiBody>(
    `/systems/${encodeURIComponent(id)}/versions/${encodeURIComponent(versaoId)}/approve`,
    { method: "POST", body: { hash } },
  );
  return exigir(r.versao, "versão");
}

export async function ativarSistema(id: string, versaoId: string): Promise<Sistema> {
  const r = await chamar<SystemsApiBody>(`/systems/${encodeURIComponent(id)}/activate`, {
    method: "POST",
    body: { versao: versaoId },
  });
  return exigir(r.sistema, "sistema");
}
