import { describe, expect, it } from "vitest";
import headers from "../../../public/_headers?raw";
import { LeitorIndisponivel, motivoCamera } from "./leitorCodigo";

// Leitor pela câmera: a CSP das telas precisa deixar compilar o WebAssembly da biblioteca (sem
// isso, a câmera abre e nunca lê) e cada falha vira uma mensagem que a pessoa entende.

describe("leitor de código pela câmera", () => {
  it("a CSP das telas permite compilar o WebAssembly, sem liberar eval de JavaScript", () => {
    const scriptSrc = /script-src ([^;]+);/.exec(headers)?.[1] ?? "";
    expect(scriptSrc.split(" ")).toEqual(["'self'", "'wasm-unsafe-eval'"]);
  });

  it("explica permissão negada, falta de câmera, câmera em uso e leitor que não carregou", () => {
    expect(motivoCamera(new DOMException("x", "NotAllowedError"))).toMatch(/bloqueada/);
    expect(motivoCamera(new DOMException("x", "NotFoundError"))).toMatch(/Nenhuma câmera/);
    expect(motivoCamera(new DOMException("x", "NotReadableError"))).toMatch(/em uso/);
    expect(motivoCamera(new LeitorIndisponivel())).toMatch(/carregar o leitor/);
    expect(motivoCamera(new Error("?"))).toMatch(/Não foi possível abrir a câmera/);
  });
});
