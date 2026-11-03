import { decodeJwt, exportPKCS8, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  AccountLookupError,
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
