// Provisiona o primeiro administrador do Nexus (seção 7: sem cadastro público nem senha padrão).
//   1. D1: linha `users` com role 'admin' e status 'pending' (se ainda não existir);
//   2. Firebase: conta com o mesmo e-mail, sem senha (se ainda não existir);
//   3. Firebase envia o link de definir senha, que também confirma o e-mail
//      (provas/firebase-convite). No primeiro login, o Worker vincula o uid e ativa a conta.
// Idempotente: repetir não duplica conta nem linha; só reenvia o link.
// Uso: PROVISAO_SA=<chave.json> PROVISAO_WEB_KEY=<apiKey web> \
//      node scripts/provisionar-admin.js <email> [--env production]
// Não imprime chaves nem tokens.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SignJWT, importPKCS8 } from "jose";

const [email, flag, ambiente = "production"] = process.argv.slice(2);
if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe o e-mail do administrador.");
if (flag && flag !== "--env")
  throw new Error("Uso: provisionar-admin.js <email> [--env <ambiente>]");
const sa = JSON.parse(readFileSync(process.env.PROVISAO_SA ?? "", "utf8"));
const webKey = process.env.PROVISAO_WEB_KEY ?? "";
if (!webKey) throw new Error("Defina PROVISAO_WEB_KEY (apiKey web do Firebase).");

const raiz = fileURLToPath(new URL("..", import.meta.url));
const banco = ambiente === "production" ? "nexus-prod" : "nexus-dev";

/** Executa SQL no D1 remoto pelo próprio Wrangler (sem shell: os argumentos chegam intactos). */
function d1(sql) {
  const saida = execFileSync(
    process.execPath,
    [
      `${raiz}node_modules/wrangler/bin/wrangler.js`,
      "d1",
      "execute",
      banco,
      "--env",
      ambiente,
      "--remote",
      "--json",
      "--command",
      sql,
    ],
    { cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(saida.slice(saida.indexOf("[")))[0]?.results ?? [];
}
const texto = (v) => `'${String(v).replaceAll("'", "''")}'`;

async function tokenAdmin() {
  const agora = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/identitytoolkit" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(agora)
    .setExpirationTime(agora + 600)
    .sign(await importPKCS8(sa.private_key, "RS256"));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!r.ok) throw new Error(`token OAuth recusado (${r.status})`);
  return (await r.json()).access_token;
}

async function firebase(caminho, corpo) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/${caminho}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${await tokenAdmin()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(corpo),
    },
  );
  return { status: r.status, corpo: await r.json() };
}

const resultado = { email: email.replace(/^(.).*(@.*)$/, "$1***$2"), banco };

// 1. D1
const existente = d1(
  `SELECT id, role, status FROM users WHERE email = ${texto(email)} COLLATE NOCASE`,
)[0];
if (existente && existente.role !== "admin") {
  throw new Error(
    "Já existe uma conta com esse e-mail que não é administradora; nada foi alterado.",
  );
}
if (!existente) {
  const agora = Date.now();
  d1(
    `INSERT INTO users (id, email, role, status, created_at, updated_at) VALUES (${texto(crypto.randomUUID())}, ${texto(email)}, 'admin', 'pending', ${agora}, ${agora})`,
  );
  resultado.d1 = "criada (admin, pendente)";
} else {
  resultado.d1 = `já existia (admin, ${existente.status})`;
}

// 2. Firebase
const conta = (await firebase("accounts:lookup", { email: [email] })).corpo.users?.[0];
if (!conta) {
  const r = await firebase("accounts", { email, emailVerified: false });
  if (r.status !== 200) throw new Error(`Falha ao criar a conta no Firebase (${r.status}).`);
  resultado.firebase = "criada sem senha";
} else {
  resultado.firebase = `já existia (e-mail confirmado: ${conta.emailVerified === true})`;
}

// 3. Link de definir senha (enviado pelo Firebase ao próprio e-mail)
const envio = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(webKey)}`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
  },
);
resultado.linkDefinirSenha = envio.ok ? "enviado" : `falhou (${envio.status})`;

console.log(JSON.stringify(resultado, null, 2));
