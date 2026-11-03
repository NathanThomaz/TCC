import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import type { SessionResponse } from "../../shared/api";
import { obterAuth } from "@/lib/firebase";
import { ApiError, chamar } from "./cliente";

export interface Usuario {
  email: string;
  nome: string;
  papel: "administrador" | "secundario";
}

export function paraUsuario(s: SessionResponse): Usuario {
  return {
    email: s.usuario.email,
    nome: s.usuario.email.split("@")[0] ?? s.usuario.email,
    papel: s.usuario.papel === "admin" ? "administrador" : "secundario",
  };
}

async function exigirAuth() {
  const auth = await obterAuth();
  if (!auth) throw new ApiError("servico_indisponivel", "O login não está disponível agora.");
  return auth;
}

/** Erros do Firebase traduzidos para os códigos que a tela de entrada conhece. */
function traduzir(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof FirebaseError) {
    if (error.code === "auth/user-disabled") throw new ApiError("conta_desativada", error.message);
    if (error.code === "auth/network-request-failed" || error.code === "auth/too-many-requests") {
      throw new ApiError("servico_indisponivel", error.message);
    }
    throw new ApiError("credenciais_invalidas", "E-mail ou senha incorretos.");
  }
  throw new ApiError("servico_indisponivel", "Não conseguimos falar com o servidor.");
}

/** Sessão do backend: confirma conta ativa, e-mail confirmado e o papel. */
export async function obterSessao(): Promise<Usuario> {
  return paraUsuario(await chamar<SessionResponse>("/session"));
}

export async function entrar(email: string, senha: string): Promise<Usuario> {
  const auth = await exigirAuth();
  try {
    await signInWithEmailAndPassword(auth, email.trim(), senha);
  } catch (error) {
    traduzir(error);
  }
  try {
    return await obterSessao();
  } catch (error) {
    // Conta do Firebase sem permissão no Nexus (não confirmada, desativada, não cadastrada):
    // sai do Firebase para não deixar meia sessão aberta.
    await signOut(auth);
    if (error instanceof ApiError && error.code === "conta_nao_cadastrada") {
      throw new ApiError("credenciais_invalidas", error.message);
    }
    throw error;
  }
}

/** Link de definir/redefinir senha (também confirma o e-mail; provas/firebase-convite). */
export async function enviarRecuperacao(email: string): Promise<void> {
  const auth = await exigirAuth();
  // Resposta neutra: não revela se o e-mail existe.
  await sendPasswordResetEmail(auth, email.trim()).catch(() => undefined);
}

/** No Nexus, confirmar o e-mail é concluir o link de definir senha. */
export const reenviarConfirmacao = enviarRecuperacao;

export async function sairDoFirebase(): Promise<void> {
  const auth = await obterAuth();
  if (auth) await signOut(auth);
}
