// Prova técnica do Firebase (ADR-001, item 6) no projeto real, em duas fases:
//   convidar  — cria a conta pelo backend (conta de serviço), sem senha, e pede o e-mail de
//               "definir senha" (PASSWORD_RESET) para o endereço de teste.
//   concluir  — com o oobCode do e-mail: define a senha, entra, verifica o ID token como o
//               Worker verifica, confere emailVerified e a revogação por validSince, e apaga a
//               conta de teste.
// Uso: PROVA_SA=<chave.json> PROVA_WEB_KEY=<apiKey web> PROVA_EMAIL=<e-mail de teste>
//      node provas/firebase-convite/run.js convidar | concluir <oobCode>
// Não imprime nem grava senha, tokens ou chaves; o e-mail sai mascarado.
import { readFileSync } from "node:fs";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";

const [fase, oobCode] = process.argv.slice(2);
const sa = JSON.parse(readFileSync(process.env.PROVA_SA ?? "", "utf8"));
const WEB_KEY = process.env.PROVA_WEB_KEY ?? "";
const EMAIL = process.env.PROVA_EMAIL ?? "";
const PROJECT = sa.project_id;
const ID = "https://identitytoolkit.googleapis.com/v1";
const mask = (e) => e.replace(/^(.).*(@.*)$/, "$1***$2");

async function adminToken() {
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/identitytoolkit",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(await importPKCS8(sa.private_key, "RS256"));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  return (await r.json()).access_token;
}

async function admin(path, body) {
  const r = await fetch(`${ID}/projects/${PROJECT}/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${await adminToken()}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

async function pub(path, body) {
  const r = await fetch(`${ID}/${path}?key=${encodeURIComponent(WEB_KEY)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

const lookup = async () => (await admin("accounts:lookup", { email: [EMAIL] })).body.users?.[0];
const out = { quando: new Date().toISOString(), projeto: PROJECT, email: mask(EMAIL), fase };

if (fase === "convidar") {
  const antes = await lookup();
  if (antes) await admin("accounts:delete", { localId: antes.localId }); // recomeça limpo
  const criada = await admin("accounts", { email: EMAIL, emailVerified: false });
  const conta = await lookup();
  const envio = await pub("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email: EMAIL });
  Object.assign(out, {
    criarContaPeloBackend: criada.status,
    contaCriada: {
      emailVerified: conta?.emailVerified ?? false,
      temSenha: Boolean(conta?.passwordHash),
    },
    envioDoLinkDefinirSenha: envio.status,
  });
} else if (fase === "concluir" && oobCode) {
  const senha = `Pv-${crypto.randomUUID()}`; // descartada no fim
  const reset = await pub("accounts:resetPassword", { oobCode, newPassword: senha });
  const aposReset = await lookup();
  const login = await pub("accounts:signInWithPassword", {
    email: EMAIL,
    password: senha,
    returnSecureToken: true,
  });
  const keys = createRemoteJWKSet(
    new URL(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    ),
  );
  const { payload, protectedHeader } = await jwtVerify(login.body.idToken, keys, {
    algorithms: ["RS256"],
    audience: PROJECT,
    issuer: `https://securetoken.google.com/${PROJECT}`,
  });
  // Revogação externa: o backend marca validSince agora; o auth_time do token fica anterior.
  await new Promise((r) => setTimeout(r, 1500));
  const revogaEm = Math.floor(Date.now() / 1000);
  const revoga = await admin("accounts:update", {
    localId: aposReset.localId,
    validSince: String(revogaEm),
  });
  const aposRevogar = await lookup();
  const apagada = await admin("accounts:delete", { localId: aposReset.localId });
  Object.assign(out, {
    definirSenha: reset.status,
    emailVerifiedAposDefinirSenha: aposReset?.emailVerified ?? false,
    login: login.status,
    tokenVerificadoComoNoWorker: {
      kid: typeof protectedHeader.kid === "string",
      email_verified: payload.email_verified === true,
      auth_time: typeof payload.auth_time === "number",
    },
    revogacao: {
      atualizar: revoga.status,
      validSinceSegundos: Number(aposRevogar?.validSince),
      authTimeSegundos: payload.auth_time,
      tokenAnteriorSeriaRecusado: payload.auth_time * 1000 < Number(aposRevogar?.validSince) * 1000,
    },
    contaDeTesteApagada: apagada.status,
  });
} else {
  throw new Error("Uso: convidar | concluir <oobCode>");
}
console.log(JSON.stringify(out, null, 2));
