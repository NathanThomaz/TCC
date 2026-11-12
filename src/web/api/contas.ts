import type { ContaDto, ContasApiBody } from "../../shared/api";
import { ApiError, chamar, novaChave } from "./cliente";

// Contas secundárias (/api/v1/contas), só do administrador (seção 7).

function exigirConta(r: ContasApiBody): ContaDto {
  if (!r.conta) throw new ApiError("resposta_inesperada", "Resposta sem conta.");
  return r.conta;
}

export async function listarContas(): Promise<ContaDto[]> {
  return (await chamar<ContasApiBody>("/contas")).contas ?? [];
}

export async function convidarConta(
  dados: { email: string; nome?: string | undefined; sistemas: string[] },
  chave: string,
): Promise<{ conta: ContaDto; conviteEnviado: boolean }> {
  const r = await chamar<ContasApiBody>("/contas", { method: "POST", body: dados, chave });
  return { conta: exigirConta(r), conviteEnviado: r.conviteEnviado === true };
}

export async function reenviarConvite(id: string) {
  return exigirConta(
    await chamar<ContasApiBody>(`/contas/${encodeURIComponent(id)}/convite`, {
      method: "POST",
      body: {},
      chave: novaChave(),
    }),
  );
}

export async function definirAcesso(id: string, sistema: string, ativo: boolean) {
  return exigirConta(
    await chamar<ContasApiBody>(`/contas/${encodeURIComponent(id)}/acessos`, {
      method: "POST",
      body: { sistema, ativo },
      chave: novaChave(),
    }),
  );
}

export async function definirStatusConta(id: string, status: "active" | "disabled") {
  return exigirConta(
    await chamar<ContasApiBody>(`/contas/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: { status },
      chave: novaChave(),
    }),
  );
}
