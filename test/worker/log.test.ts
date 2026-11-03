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

  it("remove segredos dentro de mensagens e textos livres", () => {
    const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJh";
    const error = new Error(
      `falha em https://api.test/v1?key=AIzaFICTICIAFICTICIAFICTICIA12&x=1 com Bearer abc.def ${jwt}`,
    );
    const out = JSON.stringify(redact({ error, detalhe: `token=segredo123 ${jwt}` }));

    expect(out).not.toMatch(/AIzaFICTICIA|abc\.def|segredo123|eyJhbGci/);
    expect(out).toContain("[omitido]");
    expect(out).toContain("x=1");
  });
});
