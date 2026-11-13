// Prova real da entrevista guiada (ADR-004) contra o Gemini, fora do Worker: mesmo cliente, mesmo
// prompt e mesmo schema de produção. Lê a chave de GEMINI_API_KEY (nunca a imprime) e mostra só o
// que a IA devolveu e os tokens. Uso: npx tsx provas/gemini-entrevista/run.ts
import { geminiDoAmbiente } from "../../src/worker/ia/gemini";
import { custoMicroBrl } from "../../src/worker/ia/orcamento";
import {
  instrucoesLevantamento,
  levantamentoGeminiSchema,
  LevantamentoSchema,
} from "../../src/worker/ia/prompts";
import type { Env } from "../../src/worker/env";

declare const process: { env: Record<string, string | undefined> };

// Em erro, mostra a mensagem do provedor (sem a chave, que vai no cabeçalho).
const comDiagnostico = (async (url: string, init: RequestInit) => {
  const r = await fetch(url, init);
  if (!r.ok) console.log("ERRO DO PROVEDOR:", (await r.clone().text()).slice(0, 800));
  return r;
}) as unknown as typeof fetch;
const ia = geminiDoAmbiente({ GEMINI_API_KEY: process.env.GEMINI_API_KEY } as Env, comDiagnostico);
if (!ia) throw new Error("Defina GEMINI_API_KEY.");

const falas = [
  "Tenho uma distribuidora de bebidas, a Bom Gole. Vendo cerveja e refrigerante.",
  "Atacado e varejo",
  "A partir de 1500 reais",
  "quero dar 5% de desconto para cliente fiel",
];

const historico: { papel: "usuario" | "modelo"; texto: string }[] = [];
let requisitos: Parameters<typeof instrucoesLevantamento>[1] = [];
let total = 0;
for (const fala of falas) {
  historico.push({ papel: "usuario", texto: fala });
  const r = await ia.gerar({
    instrucoes: instrucoesLevantamento("Distribuidora Bom Gole", requisitos),
    mensagens: historico,
    schema: levantamentoGeminiSchema(),
  });
  const v = LevantamentoSchema.safeParse(JSON.parse(r.texto));
  total += custoMicroBrl(r.tokensEntrada, r.tokensSaida);
  console.log(`\n>>> ${fala}`);
  if (!v.success) {
    throw new Error(`Resposta fora do schema: ${JSON.stringify(v.error.issues.slice(0, 3))}`);
  }
  const d = v.data;
  console.log(`IA: ${d.resposta}`);
  console.log(
    `  rápidas: ${JSON.stringify(d.respostas_rapidas)} | assunto: ${d.assunto_atual} | pronto: ${d.pronto_para_revisar}`,
  );
  for (const q of d.requisitos) {
    console.log(
      `  - ${q.codigo ?? "(novo)"} [${q.assunto}${q.sugestao ? ", sugestão" : ""}] ${q.titulo}: ${q.texto}`,
    );
  }
  for (const p of d.pedidos_desenvolvedor) {
    console.log(
      `  * PEDIDO: ${p.titulo} | regra: ${p.regra_proposta} | ${p.exemplos.length} exemplo(s), ${p.criterios_aceite.length} critério(s)`,
    );
  }
  console.log(`  tokens: ${r.tokensEntrada} + ${r.tokensSaida}`);
  historico.push({ papel: "modelo", texto: d.resposta });
  // Simula a mescla: numera os novos como o backend faria.
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
console.log(`\nCusto total estimado: R$ ${(total / 1_000_000).toFixed(4)}`);
