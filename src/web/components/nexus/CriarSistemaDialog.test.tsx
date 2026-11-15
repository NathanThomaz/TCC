import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Sistema } from "@/types/nexus";

// Nome repetido (migration 0013): o aviso aparece enquanto a pessoa digita, com a mesma regra
// do servidor, e o botão Criar fica travado.

const sistema = (nome: string, status: Sistema["status"] = "active"): Sistema => ({
  id: nome,
  nome,
  status,
  versaoAtiva: null,
  criadoEm: 1,
  atualizadoEm: 1,
});
const criarSistema = vi.fn();
vi.mock("@/api/sistemas", () => ({
  listarSistemas: () => Promise.resolve([sistema("Teste 1"), sistema("Loja Água", "archived")]),
  criarSistema: (...x: unknown[]) => criarSistema(...x) as unknown,
}));

const { CriarSistemaDialog } = await import("./CriarSistemaDialog");

afterEach(() => {
  cleanup();
  criarSistema.mockReset();
});

function abrir() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <CriarSistemaDialog gatilho={<button>Abrir</button>} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
}

const digitar = (nome: string) =>
  fireEvent.change(screen.getByLabelText("Nome do sistema"), { target: { value: nome } });

describe("CriarSistemaDialog", () => {
  it("avisa na hora que o nome já existe, sem diferenciar maiúsculas e espaços, e trava o Criar", async () => {
    abrir();
    digitar("  teste   1 ");
    expect((await screen.findByRole("status")).textContent).toContain(
      "Você já tem um sistema chamado Teste 1.",
    );
    const botao = screen.getByRole("button", { name: "Criar" });
    expect(botao).toHaveProperty("disabled", true);
    fireEvent.click(botao);
    expect(criarSistema).not.toHaveBeenCalled();

    digitar("Teste 3");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Criar" })).toHaveProperty("disabled", false);
  });

  it("conta os arquivados e ignora acentos", async () => {
    abrir();
    digitar("LOJA AGUA");
    expect((await screen.findByRole("status")).textContent).toContain("Loja Água (arquivado)");
  });
});
