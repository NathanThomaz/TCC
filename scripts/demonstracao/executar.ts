// Carrega a massa de dados da demonstração (cenario.ts) numa conta do Nexus.
//
//   npm run demonstracao -- --alvo local --ate 2026-11-23
//   npm run demonstracao -- --alvo producao --email <conta de demonstração> --ate AAAA-MM-DD --confirmar
//
// Roda o Worker do Nexus neste computador (createApp) com o relógio simulado e uma identidade fixa,
// sobre o D1 local (.wrangler/demonstracao) ou sobre o D1 de produção pelo binding remoto do
// Wrangler. Em produção, a conta precisa existir (criada pela tela, com e-mail confirmado) e estar
// sem sistemas; o script usa o mesmo uid do Firebase que ela já tem, então nada muda no login.
// Não imprime chaves nem tokens. Antes de rodar em produção: backup (npm run backup:d1).
import { getPlatformProxy } from "wrangler";
import { createApp } from "../../src/worker/app";
import type { Env } from "../../src/worker/env";
import { executarCenario, type Corpo, type Metodo } from "./cenario";

function argumento(nome: string): string | undefined {
  const k = process.argv.indexOf(`--${nome}`);
  return k >= 0 ? process.argv[k + 1] : undefined;
}

const alvo = argumento("alvo") ?? "local";
if (alvo !== "local" && alvo !== "producao") throw new Error("--alvo local | producao");
const hojeBrasilia = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
const ate = argumento("ate") ?? hojeBrasilia;
if (!/^\d{4}-\d{2}-\d{2}$/.test(ate) || ate > hojeBrasilia) {
  throw new Error("--ate AAAA-MM-DD, no máximo hoje (dados no futuro confundiriam o painel).");
}
const dias = Number(argumento("dias") ?? 90);
const email = (argumento("email") ?? "demonstracao@example.com").trim().toLowerCase();
if (alvo === "producao" && !process.argv.includes("--confirmar")) {
  throw new Error("Em produção, passe --confirmar (depois do backup e da autorização do dono).");
}

const proxy = await getPlatformProxy<Env>(
  alvo === "local"
    ? { configPath: "wrangler.jsonc", persist: { path: ".wrangler/demonstracao/v3" } }
    : { configPath: "scripts/demonstracao/wrangler.producao.jsonc" },
);
const env = proxy.env;

try {
  // A conta: em produção, a que a pessoa criou pela tela; no local, criada no primeiro acesso.
  const conta = await env.DB.prepare(
    "SELECT id, firebase_uid, status FROM users WHERE email = ? COLLATE NOCASE",
  )
    .bind(email)
    .first<{ id: string; firebase_uid: string | null; status: string }>();
  if (alvo === "producao" && (!conta?.firebase_uid || conta.status !== "active")) {
    throw new Error(
      "Conta de demonstração não encontrada ou ainda não ativa: entre nela uma vez pela tela.",
    );
  }
  if (conta) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM systems WHERE owner_id = ?")
      .bind(conta.id)
      .first<{ n: number }>();
    if ((n?.n ?? 0) > 0)
      throw new Error("A conta de demonstração já tem sistemas; use outra conta.");
  }
  const uid = conta?.firebase_uid ?? `demonstracao-local-${email}`;

  // Token só deste processo (a sessão exige de 20 a 4096 caracteres); não sai do computador.
  const TOKEN = `demonstracao-${crypto.randomUUID()}`;
  let agora = Date.now();
  const app = createApp({
    clock: { now: () => agora },
    auth: () => ({
      verify: (token) =>
        token === TOKEN
          ? Promise.resolve({ uid, email, emailVerified: true, authTime: 1 })
          : Promise.reject(new Error("token inesperado")),
      lookup: () => Promise.resolve({ validSince: null, disabled: false }),
    }),
    ia: () => undefined,
  });

  const chamar = async (metodo: Metodo, caminho: string, corpo?: unknown) => {
    const response = await app(
      new Request(`https://demonstracao.local/api/v1${caminho}`, {
        method: metodo,
        headers: {
          authorization: `Bearer ${TOKEN}`,
          ...(corpo === undefined ? {} : { "content-type": "application/json" }),
          ...(metodo === "POST" ? { "idempotency-key": crypto.randomUUID() } : {}),
        },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      }),
      env,
    );
    return { status: response.status, body: await response.json<Corpo>() };
  };

  // O log de cada requisição do Worker (console.log em JSON) sairia aos milhares: fica só o resumo.
  const logOriginal = console.log;
  console.log = () => undefined;
  const t0 = Date.now();
  const resumo = await executarCenario({
    chamar,
    relogio: (t) => (agora = t),
    ate,
    dias,
    nomeConta: "Conta de demonstração",
    log: (m) => process.stdout.write(`${m}\n`),
  }).finally(() => (console.log = logOriginal));

  console.log(
    `\nAlvo: ${alvo} · ${dias} dias até ${ate} · ${Math.round((Date.now() - t0) / 1000)} s`,
  );
  console.table(resumo.sistemas);
  console.table(resumo.contagem);
  if (Object.keys(resumo.recusas).length > 0) console.table(resumo.recusas);

  // Painel de cada sistema como a pessoa verá hoje (sem as listas, só os números).
  agora = Date.now();
  console.log = () => undefined;
  const semListas = (_: string, v: unknown) => (Array.isArray(v) ? `[${v.length}]` : v);
  try {
    for (const sistema of resumo.sistemas) {
      const painel = (await chamar("GET", `/systems/${sistema.id}/painel`)).body.painel;
      process.stdout.write(`
${sistema.nome}: ${JSON.stringify(painel, semListas)}
`);
    }
  } finally {
    console.log = logOriginal;
  }
} finally {
  await proxy.dispose();
}
