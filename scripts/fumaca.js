// Fumaça da URL publicada (T32, parte automática): sem login, confere saúde, configuração pública,
// rotas protegidas, 404 em JSON, deep link da SPA com os cabeçalhos de segurança e que o pacote do
// front é o atual. O fluxo logado (criar → ativar → vender) é feito por uma pessoa. Só lê.
// Uso: node scripts/fumaca.js [url-base]
const base = process.argv[2] ?? "https://nexus-production.organizador-automatico-gmail.workers.dev";
const falhas = [];
const ok = (cond, msg) => {
  console.log(`${cond ? "ok  " : "FALHA"} ${msg}`);
  if (!cond) falhas.push(msg);
};

const saude = await fetch(`${base}/api/v1/health`).then((r) => r.json());
ok(saude.status === "ok" && saude.checks?.database === "ok", "saúde e banco ok");

const config = await fetch(`${base}/api/v1/config`).then((r) => r.json());
ok(
  config.firebase &&
    Object.keys(config.firebase).sort().join() === "apiKey,appId,authDomain,projectId",
  "configuração pública só com os 4 campos do Firebase",
);

for (const rota of [
  "/systems",
  "/contas",
  "/systems/x/criacao",
  "/systems/x/pedidos",
  "/systems/x/logotipo",
]) {
  const r = await fetch(`${base}/api/v1${rota}`);
  ok(r.status === 401, `${rota} sem login responde 401 (veio ${r.status})`);
}

const inexistente = await fetch(`${base}/api/v1/nao-existe`);
ok(
  inexistente.status === 404 &&
    (inexistente.headers.get("content-type") ?? "").includes("application/json"),
  "API inexistente: 404 em JSON",
);

const pagina = await fetch(`${base}/sistemas/abc/criar/revisao`);
const html = await pagina.text();
ok(pagina.status === 200, "deep link da SPA: 200");
ok(!!pagina.headers.get("content-security-policy"), "CSP presente");
ok(pagina.headers.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");
ok(pagina.headers.get("x-content-type-options") === "nosniff", "nosniff");

const js = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
const pacote = js ? await fetch(`${base}${js}`).then((r) => r.text()) : "";
for (const trecho of ["Extras comuns", "Pedidos ao desenvolvedor", "Enviar logotipo"]) {
  ok(pacote.includes(trecho), `pacote do front contém "${trecho}"`);
}

console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
