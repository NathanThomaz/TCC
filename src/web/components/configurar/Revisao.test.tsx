import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import c1 from "../../../../experiments/cenarios/c1-gabarito.json";
import type { ConfigDraft } from "@/types/nexus";
import type { Resultado } from "./Revisao";

const salvarVersao = vi.fn();
vi.mock("@/api/sistemas", () => ({
  salvarVersao: (...args: unknown[]) => salvarVersao(...args) as unknown,
  aprovarVersao: vi.fn(),
  ativarSistema: vi.fn(),
}));

const { Revisao } = await import("./Revisao");

afterEach(() => {
  cleanup();
  salvarVersao.mockReset();
});

function Tela() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  return (
    <Revisao
      sistemaId="s1"
      draft={c1 as ConfigDraft}
      resultado={resultado}
      setResultado={setResultado}
      irPara={() => undefined}
    />
  );
}

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Tela />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const validar = () => fireEvent.click(screen.getByRole("button", { name: /Validar e salvar/ }));

describe("Revisao", () => {
  it("mostra o diagnóstico de estrutura inválida (422) mesmo sem versão gravada", async () => {
    salvarVersao.mockResolvedValue({
      versao: null,
      issues: [
        {
          code: "estrutura_invalida",
          severity: "bloqueante",
          path: "modelo",
          message: "Modelo inválido.",
        },
      ],
    });
    renderizar();
    validar();

    expect(await screen.findByText("Diagnóstico (versão não gravada)")).toBeTruthy();
    expect(screen.getByText(/Modelo inválido/)).toBeTruthy();
  });

  it("repetir com o mesmo conteúdo reutiliza a Idempotency-Key", async () => {
    salvarVersao
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValueOnce({ versao: null, issues: [] });
    renderizar();
    validar();
    await waitFor(() => expect(salvarVersao).toHaveBeenCalledTimes(1));
    await screen.findByRole("alert");
    validar();
    await waitFor(() => expect(salvarVersao).toHaveBeenCalledTimes(2));

    const [primeira, segunda] = salvarVersao.mock.calls.map((c) => c[2] as string);
    expect(primeira).toMatch(/^[0-9a-f-]{36}$/);
    expect(segunda).toBe(primeira);
  });
});
