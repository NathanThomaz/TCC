import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MensagemDto, RequisitoDto } from "../../shared/api";
import type { EstadoCriacao } from "@/api/criacao";
import { ApiError } from "@/api/cliente";

// Entrevista guiada (ADR-004): o texto não se perde quando a IA falha, resposta rápida envia o
// texto do botão, e "Revisar e criar" só libera sem sugestão pendente e com a IA dizendo que
// está pronto.

const vazio: EstadoCriacao = {
  revisao: 0,
  mensagens: [],
  requisitos: [],
  assuntoAtual: null,
  prontoParaRevisar: false,
  pedidos: [],
  iaDisponivel: true,
  versao: null,
  issues: [],
  config: null,
};
const req = (r: Partial<RequisitoDto>): RequisitoDto => ({
  codigo: "REQ-01",
  texto: "Atacado e varejo",
  status: "pendente",
  origem: "ia",
  assunto: "negocio",
  titulo: "O que vende",
  sugestao: false,
  ...r,
});
const daIa = (m: Partial<MensagemDto>): MensagemDto => ({
  id: "m1",
  papel: "assistente",
  texto: "Você vende no atacado ou no varejo?",
  perguntas: [],
  foraDoCatalogo: [],
  respostasRapidas: [],
  assunto: "negocio",
  sugestoes: [],
  pedidos: [],
  criadoEm: 1,
  ...m,
});

const obterCriacao = vi.fn<() => Promise<EstadoCriacao>>();
const enviarMensagem =
  vi.fn<(s: string, r: number, t: string, k: string) => Promise<EstadoCriacao>>();
vi.mock("@/api/criacao", () => ({
  obterCriacao: () => obterCriacao(),
  enviarMensagem: (s: string, r: number, t: string, k: string) => enviarMensagem(s, r, t, k),
  acaoRequisito: vi.fn(),
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

describe("Entrevista guiada", () => {
  it("falha da IA mantém o texto para reenviar, com a mesma chave", async () => {
    obterCriacao.mockResolvedValue(vazio);
    enviarMensagem.mockRejectedValueOnce(
      new ApiError("ia_indisponivel", "A IA não respondeu agora.", 503),
    );
    renderizar();
    const caixa = await screen.findByLabelText<HTMLTextAreaElement>("Sua resposta");
    fireEvent.change(caixa, { target: { value: "Tenho uma loja" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("A IA não respondeu agora.");
    expect(caixa.value).toBe("Tenho uma loja");

    enviarMensagem.mockResolvedValueOnce(vazio);
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    await waitFor(() => expect(caixa.value).toBe(""));
    expect(enviarMensagem.mock.calls[0]![3]).toBe(enviarMensagem.mock.calls[1]![3]);
  });

  it("resposta rápida envia o texto do botão", async () => {
    obterCriacao.mockResolvedValue({
      ...vazio,
      mensagens: [daIa({ respostasRapidas: ["Atacado e varejo", "Só varejo"] })],
    });
    enviarMensagem.mockResolvedValueOnce(vazio);
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Só varejo" }));
    await waitFor(() => expect(enviarMensagem).toHaveBeenCalled());
    expect(enviarMensagem.mock.calls[0]![2]).toBe("Só varejo");
  });

  it("sugestão pendente bloqueia a revisão e aparece para confirmar", async () => {
    obterCriacao.mockResolvedValue({
      ...vazio,
      prontoParaRevisar: true,
      mensagens: [daIa({ sugestoes: ["REQ-02"] })],
      requisitos: [
        req({}),
        req({
          codigo: "REQ-02",
          texto: "Pedido aberto segura o estoque por 2 horas",
          assunto: "pedidos_estoque",
          titulo: "Reserva de estoque",
          sugestao: true,
        }),
      ],
    });
    renderizar();
    const resumo = await screen.findByRole("complementary", { name: "Resumo do seu sistema" });
    expect(within(resumo).getByText("Sugestão — confirme")).toBeTruthy();
    const revisar = within(resumo).getByRole<HTMLButtonElement>("button", {
      name: /Revisar e criar meu sistema/,
    });
    expect(revisar.disabled).toBe(true);
    expect(within(resumo).getByText(/Confirme 1 sugestão/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Usar sugestão" })).toBeTruthy();
  });

  it("com tudo respondido e a IA pronta, a revisão fica liberada", async () => {
    obterCriacao.mockResolvedValue({ ...vazio, prontoParaRevisar: true, requisitos: [req({})] });
    renderizar();
    const resumo = await screen.findByRole("complementary", { name: "Resumo do seu sistema" });
    const link = within(resumo).getByRole("link", { name: /Revisar e criar meu sistema/ });
    expect(link.getAttribute("href")).toBe("/sistemas/s1/criar/revisao");
    // Nenhum código técnico na tela da entrevista.
    expect(screen.queryByText(/REQ-0/)).toBeNull();
  });
});
