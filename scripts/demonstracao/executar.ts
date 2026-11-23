// Carrega a massa de dados da demonstração (cenario.ts) numa conta do Nexus.
//
//   npm run demonstracao:migrar && npm run demonstracao -- --alvo local --ate 2026-11-23
//   npm run backup:d1 -- --env production
//   npm run demonstracao -- --alvo producao --email <conta> --ate AAAA-MM-DD --conta <id da conta>
//
// Roda o Worker do Nexus neste computador (createApp) com o relógio simulado e uma identidade fixa,
// sobre o D1 local (.wrangler/demonstracao) ou sobre o D1 de produção pelo binding remoto do
// Wrangler. Tudo passa pela API (validações, gatilhos, regras); o executor só lê o banco direto.
//
// Produção, por segurança: só uma conta criada pelo cadastro aberto (nunca a do dono nem uma
// secundária), ativa, sem sistemas, e confirmada pelo id com --conta (o script mostra o id e para
// quando ele falta). A identidade usa o uid do Firebase que a conta já tem, então o login dela não
// muda. Se a carga parar no meio, os dados parciais ficam só nessa conta: crie outra conta de
// demonstração e rode de novo. Não imprime chaves nem tokens.
import { getPlatformProxy } from "wrangler";
import { createApp } from "../../src/worker/app";
import type { Env } from "../../src/worker/env";
import { executarCenario, type Corpo, type Metodo, type Resposta } from "./cenario";

function argumento(nome: string): string | undefined {
  const k = process.argv.indexOf(`--${nome}`);
  if (k < 0) return undefined;
  const valor = process.argv[k + 1];
  // Opção sem valor não cai no padrão em silêncio.
  if (valor === undefined || valor.startsWith("--")) throw new Error(`--${nome} sem valor.`);
  return valor;
}

function dataValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split("-").map(Number) as [number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

const alvo = argumento("alvo") ?? "local";
if (alvo !== "local" && alvo !== "producao") throw new Error("--alvo local | producao");
const hojeBrasilia = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
const ate = argumento("ate") ?? hojeBrasilia;
if (!dataValida(ate) || ate > hojeBrasilia) {
  throw new Error(
    "--ate AAAA-MM-DD válida e no máximo hoje (dado no futuro confundiria o painel).",
  );
}
const dias = Number(argumento("dias") ?? 90);
if (!Number.isInteger(dias) || dias < 7 || dias > 180)
  throw new Error("--dias inteiro de 7 a 180.");
const emailInformado = argumento("email");
if (alvo === "producao" && !emailInformado) throw new Error("Em produção, informe --email.");
const email = (emailInformado ?? "demonstracao@example.com").trim().toLowerCase();

const proxy = await getPlatformProxy<Env>(
  alvo === "local"
    ? { configPath: "wrangler.jsonc", persist: { path: ".wrangler/demonstracao/v3" } }
    : { configPath: "scripts/demonstracao/wrangler.producao.jsonc" },
);
const env = proxy.env;

try {
  // A conta: em produção, a que a pessoa criou pela tela; no local, criada no primeiro acesso.
  const conta = await env.DB.prepare(
    `SELECT id, firebase_uid, status, role, owner_id, created_by, self_signup
     FROM users WHERE email = ? COLLATE NOCASE`,
  )
    .bind(email)
    .first<{
      id: string;
      firebase_uid: string | null;
      status: string;
      role: string;
      owner_id: string | null;
      created_by: string | null;
      self_signup: number;
    }>();
  if (alvo === "producao") {
    if (!conta?.firebase_uid || conta.status !== "active") {
      throw new Error("Conta não encontrada ou ainda não ativa: entre nela uma vez pela tela.");
    }
    if (
      conta.role !== "admin" ||
      conta.owner_id !== null ||
      conta.created_by !== null ||
      conta.self_signup !== 1
    ) {
      throw new Error("Só uma conta criada pelo cadastro aberto recebe a demonstração.");
    }
    if (argumento("conta") !== conta.id) {
      throw new Error(`Confira a conta e repita com --conta ${conta.id}`);
    }
  }
  if (conta) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM systems WHERE owner_id = ?")
      .bind(conta.id)
      .first<{ n: number }>();
    if ((n?.n ?? 0) > 0) throw new Error("A conta de demonstração já tem sistemas; use outra.");
  }
  const uid = conta?.firebase_uid ?? `demonstracao-local-${email}`;

  // Token só deste processo (a sessão exige de 20 a 4096 caracteres); não sai do computador.
  // O login vale "agora" (relógio real), depois de qualquer corte de sessões gravado na conta.
  const TOKEN = `demonstracao-${crypto.randomUUID()}`;
  const authTime = Date.now();
  let agora = authTime;
  const app = createApp({
    clock: { now: () => agora },
    auth: () => ({
      verify: (token) =>
        token === TOKEN
          ? Promise.resolve({ uid, email, emailVerified: true, authTime })
          : Promise.reject(new Error("token inesperado")),
      lookup: () => Promise.resolve({ validSince: null, disabled: false }),
    }),
    ia: () => undefined,
  });

  // Falha passageira do D1 remoto: repete com a MESMA chave de idempotência, então um POST que já
  // tinha sido gravado devolve a resposta guardada em vez de gravar de novo.
  const chamar = async (metodo: Metodo, caminho: string, corpo?: unknown): Promise<Resposta> => {
    const chave = crypto.randomUUID();
    for (let tentativa = 1; ; tentativa++) {
      try {
        const response = await app(
          new Request(`https://demonstracao.local/api/v1${caminho}`, {
            method: metodo,
            headers: {
              authorization: `Bearer ${TOKEN}`,
              ...(corpo === undefined ? {} : { "content-type": "application/json" }),
              ...(metodo === "POST" ? { "idempotency-key": chave } : {}),
            },
            ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
          }),
          env,
        );
        if (response.status < 500 || tentativa >= 4) {
          return { status: response.status, body: await response.json<Corpo>() };
        }
      } catch (error) {
        if (tentativa >= 4) throw error;
      }
      await new Promise((r) => setTimeout(r, 2_000 * tentativa));
    }
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
    limite: authTime,
    nomeConta: "Conta de demonstração",
    log: (m) => process.stdout.write(`${m}\n`),
  }).finally(() => (console.log = logOriginal));

  const duracao = Math.round((Date.now() - t0) / 1000);
  console.log(`\nAlvo: ${alvo} · ${dias} dias até ${ate} · ${duracao} s`);
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
      process.stdout.write(`\n${sistema.nome}: ${JSON.stringify(painel, semListas)}\n`);
    }
  } finally {
    console.log = logOriginal;
  }
} finally {
  await proxy.dispose();
}
