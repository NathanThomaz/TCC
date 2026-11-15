import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Rascunhos automáticos: guardam o formulário novo enquanto a pessoa digita, somem quando ele
// volta a ficar vazio ou é salvo de verdade, e voltam pela aba Rascunhos (?rascunho=id).

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ usuario: { email: "ana@exemplo.test" } }) }));
const { useRascunho, useRascunhoDaBusca, useRascunhos } = await import("./rascunhos");

const CHAVE = "nexus:rascunhos:ana@exemplo.test:s1";
const guardados = () => JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as { id: string }[];
const com = (busca = "") =>
  function Envolver({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[`/x${busca}`]}>{children}</MemoryRouter>;
  };

type Dados = { nome: string };
const props = (nome: string, extra: Partial<Parameters<typeof useRascunho<Dados>>[0]> = {}) => ({
  sistema: "s1",
  tipo: "produto" as const,
  ativo: true,
  inicial: null,
  dados: { nome },
  vazio: nome === "",
  titulo: nome || "Produto sem nome",
  resumo: "Sem preço ainda",
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("rascunhos", () => {
  it("guarda depois de uma pausa na digitação e apaga quando o formulário fica vazio", () => {
    const { result, rerender } = renderHook((p: ReturnType<typeof props>) => useRascunho(p), {
      initialProps: props(""),
      wrapper: com(),
    });
    expect(guardados()).toEqual([]);
    rerender(props("Cerveja"));
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(guardados()).toMatchObject([{ titulo: "Cerveja", dados: { nome: "Cerveja" } }]);
    expect(result.current.salvoEm).not.toBeNull();
    rerender(props(""));
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(guardados()).toEqual([]);
  });

  it("fechar antes da pausa ainda guarda o que foi digitado", () => {
    const { rerender, unmount } = renderHook((p: ReturnType<typeof props>) => useRascunho(p), {
      initialProps: props(""),
      wrapper: com(),
    });
    rerender(props("Gelo"));
    unmount();
    expect(guardados()).toMatchObject([{ titulo: "Gelo" }]);
  });

  it("salvar de verdade descarta o rascunho e não o grava de novo", () => {
    const { result, rerender, unmount } = renderHook(
      (p: ReturnType<typeof props>) => useRascunho(p),
      { initialProps: props("Água"), wrapper: com() },
    );
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(guardados()).toHaveLength(1);
    act(() => result.current.descartar());
    rerender(props("Água com gás"));
    unmount();
    expect(guardados()).toEqual([]);
  });

  it("desfazer antes da pausa não ressuscita a edição desfeita ao fechar", () => {
    const { rerender, unmount } = renderHook((p: ReturnType<typeof props>) => useRascunho(p), {
      initialProps: props("Cerveja"),
      wrapper: com(),
    });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    rerender(props("Cerveja preta"));
    rerender(props("Cerveja"));
    unmount();
    expect(guardados()).toMatchObject([{ titulo: "Cerveja" }]);
  });

  it("edição de registro existente não vira rascunho", () => {
    renderHook(() => useRascunho(props("Refrigerante", { ativo: false })), { wrapper: com() });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(guardados()).toEqual([]);
  });

  it("a aba Rascunhos lista e o formulário retoma pelo id, só do mesmo tipo", () => {
    const { rerender } = renderHook((p: ReturnType<typeof props>) => useRascunho(p), {
      initialProps: props(""),
      wrapper: com(),
    });
    rerender(props("Chope"));
    act(() => {
      vi.advanceTimersByTime(700);
    });
    const id = guardados()[0]!.id;

    const lista = renderHook(() => useRascunhos("s1"), { wrapper: com() });
    expect(lista.result.current.lista.map((r) => r.titulo)).toEqual(["Chope"]);

    const produto = renderHook(() => useRascunhoDaBusca<Dados>("s1", "produto"), {
      wrapper: com(`?rascunho=${id}`),
    });
    expect(produto.result.current?.dados).toEqual({ nome: "Chope" });
    const venda = renderHook(() => useRascunhoDaBusca("s1", "venda"), {
      wrapper: com(`?rascunho=${id}`),
    });
    expect(venda.result.current).toBeNull();

    act(() => lista.result.current.remover(id));
    expect(lista.result.current.lista).toEqual([]);
  });
});
