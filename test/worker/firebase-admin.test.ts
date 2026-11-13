import { decodeJwt, exportPKCS8, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  AccountLookupError,
  createAccountAdmin,
  createAccountLookup,
  parseServiceAccount,
  type ServiceAccount,
} from "../../src/worker/auth/firebase-admin";

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
let serviceAccount: ServiceAccount;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  serviceAccount = {
    client_email: "nexus@projeto-ficticio.iam.gserviceaccount.com",
    private_key: await exportPKCS8(privateKey),
  };
});

interface Call {
  url: string;
  body: string;
  authorization: string | null;
}

function fakeGoogle(lookupBody: unknown, lookupStatus = 200) {
  const calls: Call[] = [];
  const fetcher: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      body:
        init?.body instanceof URLSearchParams
          ? init.body.toString()
          : typeof init?.body === "string"
            ? init.body
            : "",
      authorization: headers.get("authorization"),
    });
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return Promise.resolve(Response.json({ access_token: "acesso-ficticio", expires_in: 3600 }));
    }
    return Promise.resolve(Response.json(lookupBody, { status: lookupStatus }));
  };
  return { calls, fetcher };
}

describe("createAccountLookup", () => {
  it("assina a asserção da conta de serviço, reaproveita o token e converte validSince", async () => {
    const google = fakeGoogle({ users: [{ localId: "uid-1", validSince: "1762344000" }] });
    const lookup = createAccountLookup({
      projectId: "projeto-ficticio",
      serviceAccount,
      fetch: google.fetcher,
      now: () => NOW,
    });

    await expect(lookup("uid-1")).resolves.toEqual({ validSince: 1762344000_000, disabled: false });
    await lookup("uid-1");

    const tokenCalls = google.calls.filter((c) => c.url.includes("oauth2"));
    expect(tokenCalls).toHaveLength(1);
    const assertion = new URLSearchParams(tokenCalls[0]!.body).get("assertion")!;
    expect(decodeJwt(assertion)).toMatchObject({
      iss: serviceAccount.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/identitytoolkit",
    });
    const lookupCall = google.calls.find((c) => c.url.includes("accounts:lookup"))!;
    expect(lookupCall.url).toContain("/projects/projeto-ficticio/accounts:lookup");
    expect(lookupCall.authorization).toBe("Bearer acesso-ficticio");
    expect(JSON.parse(lookupCall.body)).toEqual({ localId: ["uid-1"] });
  });

  it("conta ausente no Firebase vale como desativada; disabled é respeitado", async () => {
    const missing = createAccountLookup({
      projectId: "p",
      serviceAccount,
      fetch: fakeGoogle({}).fetcher,
      now: () => NOW,
    });
    const off = createAccountLookup({
      projectId: "p",
      serviceAccount,
      fetch: fakeGoogle({ users: [{ localId: "u", disabled: true }] }).fetcher,
      now: () => NOW,
    });

    await expect(missing("u")).resolves.toEqual({ validSince: null, disabled: true });
    await expect(off("u")).resolves.toEqual({ validSince: null, disabled: true });
  });

  it("erro do Firebase vira AccountLookupError (a sessão decide pela tolerância)", async () => {
    const lookup = createAccountLookup({
      projectId: "p",
      serviceAccount,
      fetch: fakeGoogle({ error: {} }, 503).fetcher,
      now: () => NOW,
    });

    await expect(lookup("u")).rejects.toBeInstanceOf(AccountLookupError);
  });
});

describe("falhas de rede e de formato", () => {
  it("rejeição do fetch e JSON inválido viram AccountLookupError", async () => {
    const offline = createAccountLookup({
      projectId: "p",
      serviceAccount,
      fetch: () => Promise.reject(new TypeError("rede indisponível")),
      now: () => NOW,
    });
    const garbage = createAccountLookup({
      projectId: "p",
      serviceAccount,
      fetch: (input) =>
        Promise.resolve(
          String(input instanceof Request ? input.url : input).includes("oauth2")
            ? Response.json({ access_token: "a", expires_in: 3600 })
            : new Response("<html>não é json</html>", { status: 200 }),
        ),
      now: () => NOW,
    });

    await expect(offline("u")).rejects.toBeInstanceOf(AccountLookupError);
    await expect(garbage("u")).rejects.toBeInstanceOf(AccountLookupError);
  });
});

describe("parseServiceAccount", () => {
  it("aceita só JSON com client_email e private_key", () => {
    expect(parseServiceAccount(undefined)).toBeUndefined();
    expect(parseServiceAccount("não é json")).toBeUndefined();
    expect(parseServiceAccount('{"client_email":"x"}')).toBeUndefined();
    expect(parseServiceAccount('{"client_email":"x","private_key":"k","extra":1}')).toEqual({
      client_email: "x",
      private_key: "k",
    });
  });
});

describe("createAccountAdmin", () => {
  const admin = (fetcher: typeof fetch) =>
    createAccountAdmin({
      projectId: "projeto-ficticio",
      serviceAccount,
      webApiKey: "chave-web-ficticia",
      fetch: fetcher,
      now: () => NOW,
    });

  it("convite: cria a conta sem senha se não existir e pede o link de definir senha", async () => {
    // Mesmo corpo para todas as chamadas: o lookup vê users vazio e a criação devolve o localId.
    const google = fakeGoogle({ users: [], localId: "uid-novo" });
    await expect(admin(google.fetcher).invite("novo@example.com")).resolves.toBe("uid-novo");
    const urls = google.calls.map((c) => c.url.replace(/\?.*$/, ""));
    expect(urls).toEqual([
      "https://oauth2.googleapis.com/token",
      "https://identitytoolkit.googleapis.com/v1/projects/projeto-ficticio/accounts:lookup",
      "https://identitytoolkit.googleapis.com/v1/projects/projeto-ficticio/accounts",
      "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode",
    ]);
    expect(JSON.parse(google.calls[2]!.body)).toEqual({
      email: "novo@example.com",
      emailVerified: false,
    });
    expect(JSON.parse(google.calls[3]!.body)).toEqual({
      requestType: "PASSWORD_RESET",
      email: "novo@example.com",
    });
  });

  it("conta com senha: cria com e-mail confirmado; com uid órfão, atualiza; trocar senha confirma o e-mail", async () => {
    const nova = fakeGoogle({ localId: "uid-novo" });
    await expect(
      admin(nova.fetcher).createWithPassword("novo@example.com", "Senha-123456", "Bruno"),
    ).resolves.toBe("uid-novo");
    expect(JSON.parse(nova.calls.at(-1)!.body)).toEqual({
      email: "novo@example.com",
      password: "Senha-123456",
      emailVerified: true,
      displayName: "Bruno",
    });
    const orfa = fakeGoogle({});
    await admin(orfa.fetcher).createWithPassword(
      "x@example.com",
      "Senha-123456",
      undefined,
      "uid-7",
    );
    expect(orfa.calls.at(-1)!.url).toContain("accounts:update");
    expect(JSON.parse(orfa.calls.at(-1)!.body)).toMatchObject({
      localId: "uid-7",
      emailVerified: true,
      disableUser: false,
    });
    const troca = fakeGoogle({});
    await admin(troca.fetcher).setPassword("uid-7", "Outra-123456");
    expect(JSON.parse(troca.calls.at(-1)!.body)).toEqual({
      localId: "uid-7",
      password: "Outra-123456",
      emailVerified: true,
    });
  });

  it("convite para conta que já existe no Firebase só reenvia o link", async () => {
    const google = fakeGoogle({ users: [{ localId: "uid-1" }] });
    await admin(google.fetcher).invite("novo@example.com");
    expect(google.calls.some((c) => c.url.endsWith("/accounts"))).toBe(false);
  });

  it("desativar invalida as sessões (validSince = agora) e falha vira AccountLookupError", async () => {
    const google = fakeGoogle({});
    await admin(google.fetcher).disable("uid-1");
    expect(JSON.parse(google.calls.at(-1)!.body)).toEqual({
      localId: "uid-1",
      disableUser: true,
      validSince: String(Math.floor(NOW / 1000)),
    });
    await expect(admin(fakeGoogle({}, 500).fetcher).enable("uid-1")).rejects.toThrow(
      AccountLookupError,
    );
  });
});
