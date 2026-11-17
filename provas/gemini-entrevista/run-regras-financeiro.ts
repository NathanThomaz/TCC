// Prova real das regras do financeiro (ADR-015, etapa 2a) contra o Gemini: a pessoa pede
// categorias e aviso de vencimento; a geração precisa trazer as regras e passar no validador.
// (Mesmo roteiro de run-controle-financeiro.ts, com outras falas.)
// Lê a chave de GEMINI_API_KEY (nunca a imprime). Uso: npx tsx provas/gemini-entrevista/run-regras-financeiro.ts
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
const ia = geminiDoAmbiente({ GEMINI_API_KEY: process.env.GEMINI_API_KEY } as Env, comDiagnostico);
if (!ia) throw new Error("Defina GEMINI_API_KEY.");

const falas = [
  "Quero só controlar contas a pagar e a receber da minha casa.",
  "Quero separar por categoria: despesas Moradia, Alimentação e Transporte; receitas Salário e Renda extra.",
  "Sim, quero ser avisado 3 dias antes de vencer.",
];
const historico: { papel: "usuario" | "modelo"; texto: string }[] = [];
let requisitos: Parameters<typeof instrucoesLevantamento>[1] = [];
let total = 0;
for (const fala of falas) {
  historico.push({ papel: "usuario", texto: fala });
  const r = await ia.gerar({
    instrucoes: instrucoesLevantamento("Finanças da casa", requisitos),
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
  instrucoes: instrucoesModelagem("Finanças da casa", confirmados),
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
console.log(`\nMODELO ESCOLHIDO: ${draft.modelo} | módulos: ${draft.modulos.join(", ")}`);
console.log(
  `REGRAS: ${JSON.stringify(draft.regras.map((r) => ({ ...r, requisitos: undefined })))}`,
);
console.log(
  `Validador: ${v.ok ? "ok" : "com bloqueios"} ${JSON.stringify(v.issues.map((i) => i.code))}`,
);
console.log(`Custo total estimado: R$ ${(total / 1_000_000).toFixed(4)}`);
