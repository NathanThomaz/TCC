// Prova real do controle de estoque e dos campos de fábrica dos clientes (2026-11-17) contra o
// Gemini: a entrevista curta de um almoxarifado deve levar a controle_estoque com a saída por
// motivo; a de uma loja, a clientes com Telefone e E-mail. As duas passam no validador.
// Lê a chave de GEMINI_API_KEY (nunca a imprime). Uso: npx tsx provas/gemini-entrevista/run-controle-estoque.ts
import { configDraftGeminiSchema } from "../../src/shared/contract/gemini-schema";
import { ConfigDraftSchema } from "../../src/shared/contract/schema";
import { validateDraft } from "../../src/shared/contract/validate";
import { geminiDoAmbiente } from "../../src/worker/ia/gemini";
import { custoMicroBrl } from "../../src/worker/ia/orcamento";
import {
  instrucoesLevantamento,
  instrucoesModelagem,
  levantamentoGeminiSchema,
  LevantamentoSchema,
} from "../../src/worker/ia/prompts";
import type { Env } from "../../src/worker/env";

declare const process: { env: Record<string, string | undefined> };

const comDiagnostico = (async (url: string, init: RequestInit) => {
  const r = await fetch(url, init);
  if (!r.ok) console.log("ERRO DO PROVEDOR:", (await r.clone().text()).slice(0, 800));
  return r;
}) as unknown as typeof fetch;
const talvez = geminiDoAmbiente(
  { GEMINI_API_KEY: process.env.GEMINI_API_KEY } as Env,
  comDiagnostico,
);
if (!talvez) throw new Error("Defina GEMINI_API_KEY.");
const ia = talvez;

let total = 0;
async function cenario(nome: string, falas: string[]) {
  const historico: { papel: "usuario" | "modelo"; texto: string }[] = [];
  let requisitos: Parameters<typeof instrucoesLevantamento>[1] = [];
  for (const fala of falas) {
    historico.push({ papel: "usuario", texto: fala });
    const r = await ia.gerar({
      instrucoes: instrucoesLevantamento(nome, requisitos),
      mensagens: historico,
      schema: levantamentoGeminiSchema(),
    });
    const d = LevantamentoSchema.parse(JSON.parse(r.texto));
    total += custoMicroBrl(r.tokensEntrada, r.tokensSaida);
    console.log(`\n>>> ${fala}\nIA: ${d.resposta}\n  assunto: ${d.assunto_atual}`);
    for (const q of d.requisitos) console.log(`  - [${q.assunto}] ${q.titulo}: ${q.texto}`);
    historico.push({ papel: "modelo", texto: d.resposta });
    let n = requisitos.length;
    requisitos = d.requisitos.map((q) => ({
      codigo: q.codigo ?? `REQ-${String(++n).padStart(2, "0")}`,
      texto: q.texto,
      status: "pendente",
      assunto: q.assunto,
      titulo: q.titulo,
      sugestao: q.sugestao,
    }));
  }

  // Geração: os requisitos levantados, como se o dono tivesse confirmado.
  const confirmados = requisitos.map((r) => ({ codigo: r.codigo, texto: r.texto }));
  const g = await ia.gerar({
    instrucoes: instrucoesModelagem(nome, confirmados),
    mensagens: [
      { papel: "usuario", texto: "Gere a configuração a partir dos requisitos confirmados." },
    ],
    schema: configDraftGeminiSchema(),
  });
  total += custoMicroBrl(g.tokensEntrada, g.tokensSaida);
  const bruto = JSON.parse(g.texto) as Record<string, unknown>;
  // O backend completa os requisitos com os confirmados; aqui, o mesmo.
  const draft = ConfigDraftSchema.parse({
    ...bruto,
    requisitos: confirmados.map((r) => ({ id: r.codigo, texto: r.texto, status: "confirmado" })),
  });
  const v = validateDraft(draft);
  console.log(
    `\n[${nome}] MODELO ESCOLHIDO: ${draft.modelo} | módulos: ${draft.modulos.join(", ")}`,
  );
  console.log(`  regras: ${draft.regras.map((r) => r.tipo).join(", ") || "nenhuma"}`);
  console.log(
    `  campos: ${draft.campos.map((c) => `${c.entidade}.${c.rotulo}`).join(", ") || "nenhum"}`,
  );
  console.log(
    `Validador: ${v.ok ? "ok" : "com bloqueios"} ${JSON.stringify(v.issues.map((i) => i.code))}`,
  );
}

await cenario("Almoxarifado da obra", [
  "Quero controlar o que entra e sai do almoxarifado da obra, não vendo nada.",
  "Cimento, areia, luvas e capacetes. Sai por uso na obra, perda ou quebra.",
  "Sim, quero registrar o motivo: uso na obra, perda ou quebra.",
]);
await cenario("Loja da Bia", [
  "Tenho uma loja de roupas, vendo à vista e controlo o estoque.",
  "Quero cadastrar os clientes para saber quem compra mais. A reserva da venda dura 1 hora.",
]);
console.log(`
Custo total estimado: R$ ${(total / 1_000_000).toFixed(4)}`);
