import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const entrar = vi.fn();
vi.mock("@/api/auth", () => ({
  entrar: (...args: unknown[]) => entrar(...args) as unknown,
  enviarRecuperacao: () => Promise.resolve(),
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

afterEach(cleanup);

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

  it("informa que não há cadastro público", () => {
    renderizar();
    expect(screen.getByText(/O acesso é criado pelo administrador/)).toBeTruthy();
  });
});
