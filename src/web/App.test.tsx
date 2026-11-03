import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

function fakeFetch(response: Promise<Response>): typeof fetch {
  return () => response;
}

describe("App", () => {
  it("mostra o estado do serviço vindo da API", async () => {
    const body = {
      status: "ok",
      environment: "development",
      time: "2026-11-04T12:00:00.000Z",
      checks: { database: "ok" },
    };
    render(<App fetcher={fakeFetch(Promise.resolve(Response.json(body)))} />);

    expect(await screen.findByText(/Serviço disponível/)).toBeTruthy();
  });

  it("avisa quando a API não responde", async () => {
    render(<App fetcher={fakeFetch(Promise.reject(new Error("rede")))} />);

    expect((await screen.findByRole("alert")).textContent).toContain("API indisponível");
  });
});
