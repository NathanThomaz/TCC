import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const entrar = vi.fn();
const criarConta = vi.fn();
const enviarRecuperacao = vi.fn();
let aberto = false;
vi.mock("@/api/auth", () => ({
  entrar: (...args: unknown[]) => entrar(...args) as unknown,
  criarConta: (...args: unknown[]) => criarConta(...args) as unknown,
  cadastroAberto: () => Promise.resolve(aberto),
  enviarRecuperacao: (...args: unknown[]) => enviarRecuperacao(...args) as unknown,
  reenviarConfirmacao: () => Promise.resolve(),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    pronto: true,
    usuario: null,
    expirada: false,
    iniciar: vi.fn(),
    sair: vi.fn(),
  }),
}));

const { ApiError } = await import("@/api/cliente");
const { Entrar } = await import("./Entrar");

afterEach(() => {
  cleanup();
  aberto = false;
  criarConta.mockReset();
  enviarRecuperacao.mockReset();
});

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/entrar"]}>
        <Entrar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function tentar(codigo: string) {
  entrar.mockRejectedValueOnce(new ApiError(codigo, "x"));
  renderizar();
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "pessoa@exemplo.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-ficticia" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("Entrar", () => {
  it.each([
    ["credenciais_invalidas", "E-mail ou senha incorretos"],
    ["email_nao_confirmado", "E-mail ainda não confirmado"],
    ["conta_desativada", "Conta desativada"],
    ["servico_indisponivel", "Serviço indisponível"],
  ])("mostra a mensagem certa para %s", async (codigo, titulo) => {
    tentar(codigo);
    expect(await screen.findByText(titulo)).toBeTruthy();
  });

  it("com o cadastro fechado, informa que o acesso vem do administrador", () => {
    renderizar();
    expect(screen.getByText(/O acesso é criado pelo administrador/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Criar conta" })).toBeNull();
  });

  describe("recuperar senha", () => {
    function pedirLink() {
      renderizar();
      fireEvent.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
      fireEvent.change(screen.getByLabelText("E-mail"), {
        target: { value: "pessoa@exemplo.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));
    }

    it("mostra que o serviço falhou, em vez de dizer que o link saiu", async () => {
      enviarRecuperacao.mockRejectedValueOnce(new ApiError("servico_indisponivel", "x"));
      pedirLink();
      expect((await screen.findByRole("alert")).textContent).toMatch(/Serviço indisponível/);
      expect(enviarRecuperacao).toHaveBeenCalledWith("pessoa@exemplo.com");
    });

    it("com sucesso, não mostra alerta de erro", async () => {
      enviarRecuperacao.mockResolvedValueOnce(undefined);
      pedirLink();
      expect(await screen.findByText("Se o e-mail existir, enviamos um link.")).toBeTruthy();
      expect(screen.queryByText(/Serviço indisponível/)).toBeNull();
    });
  });

  describe("cadastro aberto (ADR-009)", () => {
    async function abrirCadastro() {
      aberto = true;
      renderizar();
      fireEvent.click(await screen.findByRole("button", { name: "Criar conta" }));
      expect(screen.getByRole("heading", { name: "Criar conta" })).toBeTruthy();
    }

    function preencher(senha: string, confirmacao = senha) {
      fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Maria Souza" } });
      fireEvent.change(screen.getByLabelText("E-mail"), {
        target: { value: "maria@exemplo.com" },
      });
      fireEvent.change(screen.getByLabelText("Senha"), { target: { value: senha } });
      fireEvent.change(screen.getByLabelText("Confirmar senha"), {
        target: { value: confirmacao },
      });
      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    }

    it("cria a conta e pede para confirmar o e-mail", async () => {
      criarConta.mockResolvedValueOnce(undefined);
      await abrirCadastro();
      preencher("senha-ficticia-1");
      expect(await screen.findByText("Pronto. Falta confirmar o e-mail.")).toBeTruthy();
      expect(criarConta).toHaveBeenCalledWith(
        "Maria Souza",
        "maria@exemplo.com",
        "senha-ficticia-1",
      );
    });

    it("confere a senha antes de enviar", async () => {
      await abrirCadastro();
      preencher("curta");
      expect(screen.getByRole("alert").textContent).toMatch(/pelo menos 8/);
      preencher("senha-ficticia-1", "outra-senha-123");
      expect(screen.getByRole("alert").textContent).toMatch(/não conferem/);
      expect(criarConta).not.toHaveBeenCalled();
    });

    it("falha do serviço no cadastro aparece como indisponível", async () => {
      criarConta.mockRejectedValueOnce(new ApiError("servico_indisponivel", "x"));
      await abrirCadastro();
      preencher("senha-ficticia-1");
      expect(await screen.findByText("Serviço indisponível")).toBeTruthy();
    });
  });
});
