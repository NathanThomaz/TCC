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

// Só contas criadas por esta prova (marcadas no displayName) podem ser alteradas ou apagadas.
// Uma conta já existente sem a marca faz a prova parar: um e-mail errado nunca apaga ninguém.
const MARCA = "nexus-prova-descartavel";
async function exigirLivre() {
  const existente = await lookup();
  if (!existente) return;
  if (existente.displayName !== MARCA) {
    throw new Error("Já existe uma conta com esse e-mail que não é da prova; nada foi alterado.");
  }
  await apagar(existente.localId);
}
async function contaDaProva() {
  const conta = await lookup();
  if (!conta || conta.displayName !== MARCA) {
    throw new Error("Conta da prova não encontrada (ou sem a marca da prova); nada foi alterado.");
  }
  return conta;
}
async function apagar(localId) {
  const r = await admin("accounts:delete", { localId });
  if (r.status !== 200) throw new Error(`Falha ao apagar a conta de teste (${r.status}).`);
  return r.status;
}

let criada; // localId criado nesta execução, apagado no finally (exceto em convidar)
try {
  if (fase === "convidar") {
    await exigirLivre();
    const r = await admin("accounts", { email: EMAIL, emailVerified: false, displayName: MARCA });
    const conta = await contaDaProva();
    const envio = await pub("accounts:sendOobCode", {
      requestType: "PASSWORD_RESET",
      email: EMAIL,
    });
    Object.assign(out, {
      criarContaPeloBackend: r.status,
      contaCriada: {
        emailVerified: conta.emailVerified ?? false,
        temSenha: Boolean(conta.passwordHash),
      },
      envioDoLinkDefinirSenha: envio.status,
    });
  } else if (fase === "concluir" && oobCode) {
    criada = (await contaDaProva()).localId;
    const senha = `Pv-${crypto.randomUUID()}`; // descartada no fim
    const reset = await pub("accounts:resetPassword", { oobCode, newPassword: senha });
    const aposReset = await contaDaProva();
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
    // Mesmas exigências centrais do verificador do Worker (RS256, aud, iss); as demais (kid,
    // auth_time, iat no passado) são conferidas abaixo e testadas no Worker em auth.test.ts.
    const { payload, protectedHeader } = await jwtVerify(login.body.idToken, keys, {
      algorithms: ["RS256"],
      audience: PROJECT,
      issuer: `https://securetoken.google.com/${PROJECT}`,
    });
    const agora = Math.floor(Date.now() / 1000);
    Object.assign(out, {
      definirSenha: reset.status,
      emailVerifiedAposDefinirSenha: aposReset.emailVerified ?? false,
      login: login.status,
      tokenComAsExigenciasDoWorker: {
        kid: typeof protectedHeader.kid === "string" && protectedHeader.kid.length > 0,
        email_verified: payload.email_verified === true,
        auth_time_no_passado:
          typeof payload.auth_time === "number" && payload.auth_time <= agora + 5,
        iat_no_passado: typeof payload.iat === "number" && payload.iat <= agora + 5,
      },
    });
  } else if (fase === "revogar") {
    // Revogação com o relógio do Google como referência (o desta máquina pode estar atrasado):
    // login, espera, validSince = horário do servidor do Google, e confere o auth_time do token.
    await exigirLivre();
    const senha = `Pv-${crypto.randomUUID()}`;
    await admin("accounts", {
      email: EMAIL,
      password: senha,
      emailVerified: true,
      displayName: MARCA,
    });
    criada = (await contaDaProva()).localId;
    const login = await pub("accounts:signInWithPassword", {
      email: EMAIL,
      password: senha,
      returnSecureToken: true,
    });
    const auth_time = JSON.parse(
      Buffer.from(login.body.idToken.split(".")[1], "base64url").toString(),
    ).auth_time;
    await new Promise((r) => setTimeout(r, 4000));
    const relogio = await fetch("https://identitytoolkit.googleapis.com/", { method: "HEAD" });
    const agoraGoogle = Math.floor(new Date(relogio.headers.get("date")).getTime() / 1000);
    const revoga = await admin("accounts:update", {
      localId: criada,
      validSince: String(agoraGoogle),
    });
    const depois = await contaDaProva();
    Object.assign(out, {
      login: login.status,
      revogacao: {
        atualizar: revoga.status,
        authTimeSegundos: auth_time,
        validSinceSegundos: Number(depois.validSince),
        // Regra do Worker (session.ts): auth_time < valid_since => sessão recusada.
        pelaRegraDoWorkerSeriaRecusado: auth_time * 1000 < Number(depois.validSince) * 1000,
      },
    });
  } else {
    throw new Error("Uso: convidar | concluir <oobCode> | revogar");
  }
} finally {
  if (criada) out.contaDeTesteApagada = await apagar(criada);
}
console.log(JSON.stringify(out, null, 2));
