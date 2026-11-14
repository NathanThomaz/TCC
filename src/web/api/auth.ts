import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { SessionResponse } from "../../shared/api";
import { obterAuth, obterConfig } from "@/lib/firebase";
import { ApiError, chamar } from "./cliente";

export interface Usuario {
  email: string;
  /** Nome cadastrado ou, sem ele, o início do e-mail com letra maiúscula. */
  nome: string;
  /** A pessoa já cadastrou o nome (senão, o perfil sugere cadastrar). */
  temNome: boolean;
  papel: "administrador" | "secundario";
  /** Dono do Nexus: cria administradores independentes. */
  dono: boolean;
}

/** "maria.souza@x.com" → "Maria Souza" (só enquanto a pessoa não cadastra o nome). */
export function nomeDoEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function paraUsuario(s: SessionResponse): Usuario {
  const nome = s.usuario.nome?.trim();
  return {
    email: s.usuario.email,
    nome: nome || nomeDoEmail(s.usuario.email),
    temNome: !!nome,
    papel: s.usuario.papel === "admin" ? "administrador" : "secundario",
    dono: s.usuario.dono,
  };
}

/** A pessoa ajusta o próprio nome. */
export async function salvarNome(nome: string): Promise<Usuario> {
  return paraUsuario(
    await chamar<SessionResponse>("/session", { method: "PATCH", body: { nome } }),
  );
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
    if (error.code === "auth/email-already-in-use") {
      throw new ApiError("email_em_uso", "Já existe uma conta com este e-mail.");
    }
    if (error.code === "auth/weak-password") {
      throw new ApiError("senha_fraca", "Escolha uma senha mais forte.");
    }
    throw new ApiError("credenciais_invalidas", "E-mail ou senha incorretos.");
  }
  throw new ApiError("servico_indisponivel", "Não conseguimos falar com o servidor.");
}

/** Sessão do backend: confirma conta ativa, e-mail confirmado e o papel. */
export async function obterSessao(): Promise<Usuario> {
  return aplicarNomePendente(paraUsuario(await chamar<SessionResponse>("/session")));
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

/**
 * Reenvia a confirmação do e-mail. Com a senha (conta criada pela tela de entrada), manda o link
 * de confirmação do Firebase; sem ela, ou se falhar, o link de definir senha, que também confirma.
 */
export async function reenviarConfirmacao(email: string, senha?: string): Promise<void> {
  const auth = await exigirAuth();
  if (senha) {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), senha);
      await sendEmailVerification(user);
      await signOut(auth);
      return;
    } catch {
      await signOut(auth).catch(() => undefined);
    }
  }
  await enviarRecuperacao(email);
}

/** A tela de entrada mostra "Criar conta" quando o cadastro está aberto (ADR-009). */
export async function cadastroAberto(): Promise<boolean> {
  return (await obterConfig())?.cadastroAberto === true;
}

const NOME_PENDENTE = "nexus:nome-pendente:";

function guardar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // Sem armazenamento (janela privada): o perfil sugere cadastrar o nome depois.
  }
}

function lerGuardado(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/**
 * Cria a conta no Firebase e manda o link de confirmação. A conta do Nexus nasce no primeiro
 * acesso com o e-mail confirmado; o nome fica guardado até lá.
 */
export async function criarConta(nome: string, email: string, senha: string): Promise<void> {
  const auth = await exigirAuth();
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    await sendEmailVerification(user);
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    traduzir(error);
  }
  await signOut(auth);
  const limpo = nome.trim();
  if (limpo) guardar(NOME_PENDENTE + email.trim().toLowerCase(), limpo);
}

/** No primeiro acesso de quem criou a conta, grava o nome informado no cadastro. */
async function aplicarNomePendente(usuario: Usuario): Promise<Usuario> {
  const chave = NOME_PENDENTE + usuario.email.toLowerCase();
  const nome = lerGuardado(chave);
  if (!nome) return usuario;
  if (usuario.temNome) {
    guardar(chave, null);
    return usuario;
  }
  // Resposta atrasada de uma sessão anterior: o PATCH iria com o login atual, de outra pessoa.
  const atual = (await obterAuth())?.currentUser?.email?.toLowerCase();
  if (atual !== usuario.email.toLowerCase()) return usuario;
  try {
    const atualizado = await salvarNome(nome);
    guardar(chave, null);
    return atualizado;
  } catch {
    return usuario; // tenta de novo no próximo acesso
  }
}

export async function sairDoFirebase(): Promise<void> {
  const auth = await obterAuth();
  if (auth) await signOut(auth);
}
