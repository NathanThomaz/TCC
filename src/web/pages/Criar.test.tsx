import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EstadoCriacao } from "@/api/criacao";
import { ApiError } from "@/api/cliente";

// Tela da criação por conversa: o texto não se perde quando a IA falha, e gerar fica bloqueado
// enquanto houver requisito pendente (T05).

const vazio: EstadoCriacao = {
  revisao: 0,
  mensagens: [],
  requisitos: [],
  iaDisponivel: true,
  versao: null,
  issues: [],
  config: null,
};
const obterCriacao = vi.fn<() => Promise<EstadoCriacao>>();
const enviarMensagem =
  vi.fn<(s: string, r: number, t: string, k: string) => Promise<EstadoCriacao>>();
vi.mock("@/api/criacao", () => ({
  obterCriacao: () => obterCriacao(),
  enviarMensagem: (s: string, r: number, t: string, k: string) => enviarMensagem(s, r, t, k),
  acaoRequisito: vi.fn(),
  adicionarRequisito: vi.fn(),
  gerarConfiguracao: vi.fn(),
  corrigirConfiguracao: vi.fn(),
}));
vi.mock("@/api/sistemas", () => ({
  obterSistema: () =>
    Promise.resolve({
      sistema: {
        id: "s1",
        nome: "Loja",
        status: "draft",
        versaoAtiva: null,
        criadoEm: 1,
        atualizadoEm: 1,
      },
      versoes: [],
      ultimaConfig: null,
    }),
  aprovarVersao: vi.fn(),
  ativarSistema: vi.fn(),
}));

const { Criar } = await import("./Criar");

afterEach(() => {
  cleanup();
  obterCriacao.mockReset();
  enviarMensagem.mockReset();
});

function renderizar() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={["/sistemas/s1/criar"]}>
        <Routes>
          <Route path="/sistemas/:id/criar" element={<Criar />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Criar por conversa", () => {
  it("falha da IA mantém o texto para reenviar, com a mesma chave", async () => {
    obterCriacao.mockResolvedValue(vazio);
    enviarMensagem.mockRejectedValueOnce(
      new ApiError("ia_indisponivel", "A IA não respondeu agora.", 503),
    );
    renderizar();
    const caixa = await screen.findByLabelText("Mensagem");
    fireEvent.change(caixa, { target: { value: "Tenho uma loja" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("A IA não respondeu agora.");
    expect((caixa as HTMLTextAreaElement).value).toBe("Tenho uma loja");

    enviarMensagem.mockResolvedValueOnce(vazio);
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    await waitFor(() => expect((caixa as HTMLTextAreaElement).value).toBe(""));
    expect(enviarMensagem.mock.calls[0]![3]).toBe(enviarMensagem.mock.calls[1]![3]);
  });

  it("T05: com requisito pendente, gerar a configuração fica bloqueado", async () => {
    obterCriacao.mockResolvedValue({
      ...vazio,
      requisitos: [{ codigo: "REQ-01", texto: "Vender peças", status: "pendente", origem: "ia" }],
    });
    renderizar();
    const gerar = await screen.findByRole<HTMLButtonElement>("button", {
      name: /Gerar configuração/,
    });
    expect(gerar.disabled).toBe(true);
    expect(screen.getByText("Confirme os requisitos pendentes antes.")).toBeTruthy();
  });
});
