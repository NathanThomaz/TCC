import { describe, expect, it } from "vitest";
import { redact } from "../../src/worker/lib/log";

describe("redact", () => {
  it("omite campos sensíveis em qualquer nível", () => {
    expect(
      redact({
        email: "pessoa@example.com",
        idToken: "abc",
        nested: { Authorization: "Bearer x", apiKey: "k", ok: 1 },
        list: [{ password: "p" }],
      }),
    ).toEqual({
      email: "pessoa@example.com",
      idToken: "[omitido]",
      nested: { Authorization: "[omitido]", apiKey: "[omitido]", ok: 1 },
      list: [{ password: "[omitido]" }],
    });
  });

  it("reduz erros a nome e mensagem", () => {
    expect(redact(new TypeError("falhou"))).toEqual({ name: "TypeError", message: "falhou" });
  });
});
