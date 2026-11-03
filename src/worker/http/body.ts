import { AppError, validationFailed } from "./errors";

const MAX_BODY_BYTES = 64 * 1024;

/** Lê o corpo JSON com limite de tamanho; formato e campos são validados por quem chama. */
export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new AppError(415, "tipo_nao_suportado", "Envie o corpo como application/json.");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw tooLarge();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw validationFailed("O corpo não é um JSON válido.");
  }
}

const tooLarge = () =>
  new AppError(413, "corpo_grande_demais", "O corpo da requisição passa do limite de 64 KB.");
