import { ApiError, sessaoRecusada, tokenAtual } from "./cliente";

// Logotipo do sistema (/api/v1/systems/:id/logotipo). Vem com o token de login e vira uma URL
// data: (a CSP só aceita imagens do próprio site e data:), sem afrouxar a política de segurança.

function caminho(sistema: string) {
  return `/api/v1/systems/${encodeURIComponent(sistema)}/logotipo`;
}

async function cabecalhos(extra: Record<string, string> = {}) {
  const token = await tokenAtual();
  return { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra };
}

async function erroDe(r: Response): Promise<ApiError> {
  sessaoRecusada(r.status, !!(await tokenAtual()));
  const corpo = (await r.json().catch(() => null)) as {
    error?: { code: string; message: string };
  } | null;
  return new ApiError(
    corpo?.error?.code ?? "erro_desconhecido",
    corpo?.error?.message ?? "Não foi possível concluir a operação.",
    r.status,
  );
}

/** URL data: do logotipo, ou null quando o sistema não tem logotipo (mostra as iniciais). */
export async function obterLogotipo(sistema: string): Promise<string | null> {
  const r = await fetch(caminho(sistema), { headers: await cabecalhos() });
  if (r.status === 404) return null;
  if (!r.ok) throw await erroDe(r);
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    // readAsDataURL sempre produz texto.
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(new ApiError("leitura", "Não foi possível ler o logotipo."));
    leitor.readAsDataURL(blob);
  });
}

export async function enviarLogotipo(sistema: string, arquivo: File): Promise<void> {
  const r = await fetch(caminho(sistema), {
    method: "PUT",
    headers: await cabecalhos({ "content-type": arquivo.type || "application/octet-stream" }),
    body: arquivo,
  });
  if (!r.ok) throw await erroDe(r);
}

export async function removerLogotipo(sistema: string): Promise<void> {
  const r = await fetch(caminho(sistema), { method: "DELETE", headers: await cabecalhos() });
  if (!r.ok) throw await erroDe(r);
}
