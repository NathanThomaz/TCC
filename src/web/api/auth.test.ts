import { beforeEach, describe, expect, it, vi } from "vitest";

// Erro no formato do Firebase (só o `code` importa para a tradução).
function erroFirebase(code: string) {
  return Object.assign(new Error(`Firebase: Error (${code}).`), { code });
}

const firebase = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn<(...a: unknown[]) => Promise<void>>(),
  signInWithEmailAndPassword: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
  signOut: vi.fn(() => Promise.resolve()),
  createUserWithEmailAndPassword: vi.fn<(...a: unknown[]) => Promise<unknown>>(),
}));
const obterAuth = vi.hoisted(() => vi.fn(() => Promise.resolve({ currentUser: null })));

vi.mock("firebase/auth", () => ({
  ...firebase,
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn(),
  sendEmailVerification: vi.fn(),
  updatePassword: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({
  obterAuth,
  obterConfig: () => Promise.resolve(null),
}));

const { enviarRecuperacao, entrar, criarConta } = await import("./auth");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enviarRecuperacao", () => {
  it("envia o link para o e-mail sem espaços", async () => {
    firebase.sendPasswordResetEmail.mockResolvedValue();
    await expect(enviarRecuperacao("  dono@exemplo.com ")).resolves.toBeUndefined();
    expect(firebase.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      "dono@exemplo.com",
    );
  });

  it.each([
    "auth/user-not-found",
    "auth/invalid-email",
    "auth/missing-email",
    "auth/invalid-recipient-email",
  ])("responde de forma neutra quando o problema é o e-mail (%s)", async (code) => {
    firebase.sendPasswordResetEmail.mockRejectedValue(erroFirebase(code));
    await expect(enviarRecuperacao("x@exemplo.com")).resolves.toBeUndefined();
  });

  it.each([
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.",
    "auth/internal-error",
    "auth/network-request-failed",
    "auth/too-many-requests",
  ])("mostra falha do serviço em vez de fingir que enviou (%s)", async (code) => {
    firebase.sendPasswordResetEmail.mockRejectedValue(erroFirebase(code));
    await expect(enviarRecuperacao("dono@exemplo.com")).rejects.toMatchObject({
      code: "servico_indisponivel",
    });
  });
});

describe("entrar", () => {
  it.each(["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"])(
    "senha ou e-mail errados viram credenciais_invalidas (%s)",
    async (code) => {
      firebase.signInWithEmailAndPassword.mockRejectedValue(erroFirebase(code));
      await expect(entrar("dono@exemplo.com", "senha-errada")).rejects.toMatchObject({
        code: "credenciais_invalidas",
      });
    },
  );

  it.each(["auth/api-key-not-valid.-please-pass-a-valid-api-key.", "auth/internal-error"])(
    "falha de configuração do Firebase não aparece como senha incorreta (%s)",
    async (code) => {
      firebase.signInWithEmailAndPassword.mockRejectedValue(erroFirebase(code));
      await expect(entrar("dono@exemplo.com", "qualquer")).rejects.toMatchObject({
        code: "servico_indisponivel",
      });
    },
  );

  it("conta desativada continua com a mensagem própria", async () => {
    firebase.signInWithEmailAndPassword.mockRejectedValue(erroFirebase("auth/user-disabled"));
    await expect(entrar("dono@exemplo.com", "x")).rejects.toMatchObject({
      code: "conta_desativada",
    });
  });
});

describe("criarConta", () => {
  it("e-mail que já tem conta responde igual a uma conta nova e manda o link de redefinir", async () => {
    firebase.createUserWithEmailAndPassword.mockRejectedValue(
      erroFirebase("auth/email-already-in-use"),
    );
    firebase.sendPasswordResetEmail.mockResolvedValue();
    await expect(
      criarConta("Maria", " maria@exemplo.com ", "senha-ficticia"),
    ).resolves.toBeUndefined();
    expect(firebase.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      "maria@exemplo.com",
    );
  });

  it("e-mail que já tem conta: falha no envio do link não muda a resposta", async () => {
    firebase.createUserWithEmailAndPassword.mockRejectedValue(
      erroFirebase("auth/email-already-in-use"),
    );
    firebase.sendPasswordResetEmail.mockRejectedValue(erroFirebase("auth/too-many-requests"));
    await expect(
      criarConta("Maria", "maria@exemplo.com", "senha-ficticia"),
    ).resolves.toBeUndefined();
  });

  it("só o cadastro novo guarda o nome pendente", async () => {
    localStorage.clear();
    firebase.createUserWithEmailAndPassword.mockRejectedValueOnce(
      erroFirebase("auth/email-already-in-use"),
    );
    firebase.sendPasswordResetEmail.mockResolvedValue();
    await criarConta("Intruso", "existente@exemplo.com", "senha-ficticia");
    expect(localStorage.getItem("nexus:nome-pendente:existente@exemplo.com")).toBeNull();

    firebase.createUserWithEmailAndPassword.mockResolvedValueOnce({ user: {} });
    await criarConta("Maria Souza", "Nova@Exemplo.com", "senha-ficticia");
    expect(localStorage.getItem("nexus:nome-pendente:nova@exemplo.com")).toBe("Maria Souza");
  });
});

describe("configuração e política de senha", () => {
  it("chave recusada já na inicialização vira servico_indisponivel", async () => {
    obterAuth.mockRejectedValueOnce(erroFirebase("auth/invalid-api-key"));
    await expect(enviarRecuperacao("dono@exemplo.com")).rejects.toMatchObject({
      code: "servico_indisponivel",
    });
  });

  it("senha fora da política do Firebase vira senha_fraca no cadastro", async () => {
    firebase.createUserWithEmailAndPassword.mockRejectedValue(
      erroFirebase("auth/password-does-not-meet-requirements"),
    );
    await expect(criarConta("Maria", "maria@exemplo.com", "senha-ficticia")).rejects.toMatchObject({
      code: "senha_fraca",
    });
  });
});
