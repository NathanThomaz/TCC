// Backup do D1 do Nexus e teste de restauração (seção 23: backup privado fora do repositório,
// antes de migrations e do experimento, com restauração testada em ambiente separado).
//   1. exporta o banco (wrangler d1 export) para NEXUS_BACKUP_DIR, fora de PROJETOS;
//   2. restaura o arquivo num D1 local NOVO e descartável (pasta temporária);
//   3. compara a contagem de linhas de cada tabela entre a origem e a cópia restaurada.
// Só lê a origem. O arquivo contém dados reais em produção: nunca vai para Git, Vault ou Notion.
// Não cobre as contas do Firebase (procedimento próprio, seção 23).
// Uso: NEXUS_BACKUP_DIR=<pasta privada> node scripts/backup-d1.js [--env production] [--local]
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const local = args.includes("--local");
const iEnv = args.indexOf("--env");
const ambiente = iEnv >= 0 ? args[iEnv + 1] : undefined;
const config = args.includes("-c") ? args[args.indexOf("-c") + 1] : undefined;
const destino = process.env.NEXUS_BACKUP_DIR;
if (!destino) throw new Error("Defina NEXUS_BACKUP_DIR (pasta privada fora de PROJETOS).");

const raiz = fileURLToPath(new URL("..", import.meta.url));
if (path.resolve(destino).toLowerCase().startsWith(path.resolve(raiz, "..").toLowerCase())) {
  throw new Error("NEXUS_BACKUP_DIR não pode ficar dentro de PROJETOS.");
}
const banco = ambiente === "production" ? "nexus-prod" : local ? "DB" : "nexus-dev";

/** Wrangler pelo próprio Node (sem shell): os argumentos chegam intactos. */
function wrangler(extra) {
  return execFileSync(
    process.execPath,
    [`${raiz}node_modules/wrangler/bin/wrangler.js`, ...extra],
    {
      cwd: raiz,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" },
    },
  );
}
const origem = [
  ...(ambiente ? ["--env", ambiente] : []),
  ...(config ? ["-c", config] : []),
  ...(local ? ["--local"] : ["--remote"]),
];

function contagens(nome, alvo) {
  const tabelas = JSON.parse(
    wrangler([
      "d1",
      "execute",
      nome,
      ...alvo,
      "--json",
      "--command",
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
    ]),
  )[0].results.map((r) => r.name);
  // Uma linha com uma subconsulta por tabela (o D1 limita os termos de um UNION).
  const sql = `SELECT ${tabelas.map((t) => `(SELECT COUNT(*) FROM "${t}") AS "${t}"`).join(", ")}`;
  return JSON.parse(wrangler(["d1", "execute", nome, ...alvo, "--json", "--command", sql]))[0]
    .results[0];
}

/** Agrupa as instruções do export: CREATE TABLE, depois INSERT, depois o restante. */
function reordenar(sql) {
  const inicio =
    /^(CREATE TABLE|INSERT INTO|CREATE (UNIQUE )?INDEX|CREATE TRIGGER|CREATE VIEW|PRAGMA)\b/;
  const blocos = [];
  for (const linha of sql.split("\n")) {
    if (inicio.test(linha) || blocos.length === 0) blocos.push([linha]);
    else blocos[blocos.length - 1].push(linha);
  }
  const texto = blocos.map((b) => b.join("\n").trim()).filter(Boolean);
  const tabelas = texto.filter((b) => b.startsWith("CREATE TABLE"));
  const dados = texto.filter((b) => b.startsWith("INSERT INTO"));
  const resto = texto.filter((b) => !tabelas.includes(b) && !dados.includes(b));
  return ["PRAGMA defer_foreign_keys = ON;", ...tabelas, ...dados, ...resto].join("\n") + "\n";
}

mkdirSync(destino, { recursive: true });
const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
const arquivo = path.join(destino, `nexus-${ambiente ?? (local ? "local" : "dev")}-${carimbo}.sql`);

// 1. Exportação (só leitura da origem).
wrangler(["d1", "export", banco, ...origem, "--output", arquivo]);
const antes = contagens(banco, origem);

// 2. Restauração num D1 local novo, numa pasta temporária (nada é sobrescrito).
const temporaria = mkdtempSync(path.join(tmpdir(), "nexus-restauracao-"));
const copia = [
  "-c",
  config ?? path.join(raiz, "wrangler.jsonc"),
  "--local",
  "--persist-to",
  temporaria,
];
// O export cria e preenche cada tabela na ordem em que foi criada: systems (que referencia
// model_versions pela coluna da migration 0002) é preenchida antes de model_versions existir, e o
// SQLite recusa. A restauração reordena: todas as tabelas, depois os dados (com as chaves
// adiadas até o fim do lote) e por último índices e triggers, como o próprio export já faz —
// então os dados históricos não passam pelas regras de negócio ao entrar.
const restauracao = path.join(temporaria, "restauracao.sql");
writeFileSync(restauracao, reordenar(readFileSync(arquivo, "utf8")));
wrangler(["d1", "execute", "DB", ...copia, "--file", restauracao]);
// A cópia é um D1 local do wrangler.jsonc base: o nome é o binding DB, sem --env.
const depois = contagens("DB", copia);

// 3. Conferência.
const divergencias = Object.keys({ ...antes, ...depois }).filter((t) => antes[t] !== depois[t]);
console.log(
  JSON.stringify(
    {
      arquivo,
      bytes: statSync(arquivo).size,
      tabelas: Object.keys(antes).length,
      linhas: Object.values(antes).reduce((s, n) => s + n, 0),
      restauradoEm: temporaria,
      divergencias: divergencias.map((t) => ({ tabela: t, origem: antes[t], copia: depois[t] })),
      resultado: divergencias.length === 0 ? "restauração conferida" : "DIVERGÊNCIA",
    },
    null,
    2,
  ),
);
if (divergencias.length) process.exitCode = 1;
