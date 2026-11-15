import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  useMutation,
} from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvisoConexao } from "./AvisoConexao";

// Sem internet: aviso na tela, a alteração fica esperando (não falha) e sai sozinha quando a
// conexão volta.

afterEach(() => {
  cleanup();
  act(() => onlineManager.setOnline(true));
});

function Salvar({ enviar }: { enviar: () => Promise<string> }) {
  const m = useMutation({ mutationFn: enviar });
  return <button onClick={() => m.mutate()}>{m.isSuccess ? "Salvo" : "Salvar"}</button>;
}

function renderizar(enviar: () => Promise<string>) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Salvar enviar={enviar} />
      <AvisoConexao />
    </QueryClientProvider>,
  );
}

describe("AvisoConexao", () => {
  it("com internet não mostra nada", () => {
    renderizar(() => Promise.resolve("ok"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sem internet avisa, guarda a alteração e envia quando a conexão volta", async () => {
    const enviar = vi.fn(() => Promise.resolve("ok"));
    renderizar(enviar);
    act(() => onlineManager.setOnline(false));
    expect(screen.getByRole("status").textContent).toContain("Sem internet");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByText(/1 alteração esperando/)).textContent).toContain(
      "Não feche esta aba",
    );
    expect(enviar).not.toHaveBeenCalled();

    act(() => onlineManager.setOnline(true));
    expect(await screen.findByRole("button", { name: "Salvo" })).toBeTruthy();
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
