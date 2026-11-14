// Prova real da venda ditada (pedido do dono, 2026-11-14): mesmo prompt e schema de produção,
// com produtos e clientes fictícios. Lê a chave de GEMINI_API_KEY (nunca a imprime).
// Uso: npx tsx provas/gemini-entrevista/run-venda-ditada.ts
import { geminiDoAmbiente } from "../../src/worker/ia/gemini";
import { custoMicroBrl } from "../../src/worker/ia/orcamento";
import {
  instrucoesVendaDitada,
  vendaDitadaGeminiSchema,
  VendaDitadaSchema,
} from "../../src/worker/ia/prompts";
import { montarProposta } from "../../src/worker/modules/operacao/automacao";
import type { Env } from "../../src/worker/env";

declare const process: { env: Record<string, string | undefined> };

const ia = geminiDoAmbiente({ GEMINI_API_KEY: process.env.GEMINI_API_KEY } as Env);
if (!ia) throw new Error("Defina GEMINI_API_KEY.");

const produtos = [
  { id: "p1", name: "Água mineral 500 ml", units_per_box: 12 },
  { id: "p2", name: "Cerveja lata 350 ml", units_per_box: 12 },
  { id: "p3", name: "Gelo 5 kg", units_per_box: null },
  { id: "p4", name: "Refrigerante 2 L", units_per_box: 6 },
  { id: "p5", name: "Vinho tinto seco", units_per_box: null },
];
const clientes = [
  { id: "c1", name: "Bar do Zé" },
  { id: "c2", name: "Mercado Bom Preço" },
];
const formas = ["dinheiro", "pix", "cartao_debito", "a_prazo"];
const frases = [
  "2 caixas de cerva e mais 3 latas pro bar do ze no pix",
  "vendi 4 refri, 2 gelos e uma dúzia de água para o mercado bom preço, fiado",
  "1 vinho e 2 pacotes de carvão para a Dona Maria no dinheiro",
];
let custo = 0;
for (const texto of frases) {
  const r = await ia.gerar({
    instrucoes: instrucoesVendaDitada(
      "Distribuidora Exemplo",
      produtos.map((p) => ({ nome: p.name, caixa: p.units_per_box })),
      clientes.map((c) => c.name),
      formas,
    ),
    mensagens: [{ papel: "usuario", texto }],
    schema: vendaDitadaGeminiSchema(),
  });
  custo += custoMicroBrl(r.tokensEntrada, r.tokensSaida);
  const proposta = montarProposta(
    VendaDitadaSchema.parse(JSON.parse(r.texto)),
    produtos,
    clientes,
    formas,
  );
  console.log(`\n"${texto}"\n`, JSON.stringify(proposta));
}
console.log(`\nCusto total: R$ ${(custo / 1_000_000).toFixed(4)}`);
