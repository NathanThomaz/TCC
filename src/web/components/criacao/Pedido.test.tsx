import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PedidoDto } from "../../../shared/api";

// Ficha do pedido: quem pediu vê a resposta do desenvolvedor marcada e pode cancelar; o
// desenvolvedor (dono do Nexus) dá o andamento e responde, sem o botão de cancelar.

const mudarEstadoPedido = vi.fn<(...x: unknown[]) => Promise<object>>(() => Promise.resolve({}));
const responderPedido = vi.fn<(...x: unknown[]) => Promise<object>>(() => Promise.resolve({}));
vi.mock("@/api/pedidos", () => ({
  cancelarPedido: vi.fn(),
  comentarPedido: vi.fn(),
  mudarEstadoPedido: (...x: unknown[]) => mudarEstadoPedido(...x),
  responderPedido: (...x: unknown[]) => responderPedido(...x),
}));

const { FichaPedido } = await import("./Pedido");

const pedido: PedidoDto = {
  id: "p1",
  titulo: "Emitir nota fiscal",
  assunto: null,
  origem: "formulario",
  pedidoOriginal: "Quero emitir nota fiscal.",
  contexto: null,
  regraProposta: null,
  exemplos: [],
  criteriosAceite: [],
  estado: "aberto",
  historico: [{ estado: "aberto", em: 1, nota: null }],
  comentarios: [{ texto: "Anotado.", em: 2, doDesenvolvedor: true }],
  criadoEm: 1,
};

afterEach(() => {
  cleanup();
  mudarEstadoPedido.mockClear();
  responderPedido.mockClear();
});

function abrir(props: { desenvolvedor?: boolean; sistema?: string }) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FichaPedido pedido={pedido} onFechar={() => undefined} {...props} />
    </QueryClientProvider>,
  );
}

describe("ficha do pedido", () => {
  it("quem pediu vê a resposta do desenvolvedor e pode cancelar", () => {
    abrir({ sistema: "s1" });
    expect(screen.getByText("Resposta do desenvolvedor")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeTruthy();
    expect(screen.queryByText("Andamento")).toBeNull();
  });

  it("o desenvolvedor dá o andamento com nota e responde, sem cancelar", async () => {
    abrir({ desenvolvedor: true });
    expect(screen.getByText("O que pediram")).toBeTruthy();
    expect(screen.getByText("Sua resposta")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancelar pedido" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Nota para quem pediu (opcional)"), {
      target: { value: "Entra na próxima versão." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar estado" }));
    await waitFor(() => expect(mudarEstadoPedido).toHaveBeenCalledTimes(1));
    expect(mudarEstadoPedido.mock.calls[0]!.slice(0, 3)).toEqual([
      "p1",
      "em_analise",
      "Entra na próxima versão.",
    ]);

    fireEvent.change(screen.getByLabelText("Responder a quem pediu"), {
      target: { value: "Começo semana que vem." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    await waitFor(() => expect(responderPedido).toHaveBeenCalledTimes(1));
    expect(responderPedido.mock.calls[0]!.slice(0, 2)).toEqual(["p1", "Começo semana que vem."]);
  });
});
