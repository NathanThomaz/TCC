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
// conexão volta. O aviso só some quando o envio retomado termina.

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

const aviso = () => screen.getByRole("status");

describe("AvisoConexao", () => {
  it("com internet a região fica vazia, mas presente (aria-live, visível com diálogo aberto)", () => {
    renderizar(() => Promise.resolve("ok"));
    expect(aviso().textContent).toBe("");
    expect(aviso().getAttribute("aria-live")).toBe("polite");
  });

  it("um envio comum, com internet, não mostra aviso", async () => {
    renderizar(() => new Promise<string>(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await act(() => Promise.resolve());
    expect(aviso().textContent).toBe("");
  });

  it("sem internet avisa, guarda a alteração e envia quando a conexão volta", async () => {
    let responder: (v: string) => void = () => {};
    const enviar = vi.fn(() => new Promise<string>((ok) => (responder = ok)));
    renderizar(enviar);
    act(() => onlineManager.setOnline(false));
    expect(aviso().textContent).toContain("Sem internet");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByText(/1 alteração esperando/)).textContent).toContain(
      "Não feche esta aba",
    );
    expect(enviar).not.toHaveBeenCalled();

    // Conexão de volta, resposta ainda a caminho: o aviso continua até o envio terminar.
    act(() => onlineManager.setOnline(true));
    expect((await screen.findByText(/Conexão de volta/)).textContent).toBeTruthy();
    expect(aviso().textContent).toContain("Enviando 1 alteração");
    expect(enviar).toHaveBeenCalledTimes(1);

    act(() => responder("ok"));
    expect(await screen.findByRole("button", { name: "Salvo" })).toBeTruthy();
    expect(aviso().textContent).toBe("");
  });
});
