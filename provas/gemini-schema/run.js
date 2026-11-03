// Prova técnica do Gemini (ADR-001, itens 3 e 7): o JSON Schema gerado do Zod é aceito como
// responseJsonSchema? A resposta passa no mesmo schema? Quanto custa uma chamada típica?
// Uso: GEMINI_API_KEY=... node provas/gemini-schema/run.js   (dados 100% fictícios)
import { z } from "zod";

const MODEL = process.env.PROVA_MODELO ?? "gemini-3.1-flash-lite";
const REPETICOES = Number(process.env.PROVA_REPETICOES ?? 3);
// Preço oficial consultado em 2026-11-03 (aistudio.google.com/docs/pricing), US$ por 1M tokens.
const PRECO = { entrada: 0.25, saida: 1.5 };
// Câmbio e IOF conservadores para a estimativa em reais (não é custo faturado).
const USD_BRL = 6.0;
const IOF = 0.0438;

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("Defina GEMINI_API_KEY");

// Versão reduzida e representativa do contrato: enums, aninhamento, inteiros com limites e
// união discriminada de regras (o ponto mais arriscado do subconjunto de JSON Schema).
const Requisito = z.object({
  id: z.string().regex(/^REQ-\d{2}$/),
  texto: z.string().min(5).max(300),
  status: z.enum(["pendente", "confirmado"]),
});
const Regra = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("limite_atacado"),
    valor_centavos: z.number().int().min(1).max(100_000_000),
    requisitos: z.array(z.string()).min(1),
  }),
  z.object({
    tipo: z.literal("unidades_por_caixa"),
    produto: z.string().min(1),
    unidades: z.number().int().min(1).max(1000),
    requisitos: z.array(z.string()).min(1),
  }),
  z.object({
    tipo: z.literal("prazo_reserva"),
    minutos: z.number().int().min(1).max(1440),
    requisitos: z.array(z.string()).min(1),
  }),
  z.object({
    tipo: z.literal("duracao_atendimento"),
    atendimento: z.enum(["instalacao", "retirada", "servico"]),
    minutos: z.number().int().min(15).max(480),
    requisitos: z.array(z.string()).min(1),
  }),
]);
const Proposta = z.object({
  modelo: z.enum(["comercio", "servicos", "comercio_com_servicos"]),
  modulos: z
    .array(z.enum(["clientes", "produtos", "vendas", "estoque", "profissionais", "agenda"]))
    .min(1),
  requisitos: z.array(Requisito).min(1),
  regras: z.array(Regra),
  perguntas: z.array(z.string()).max(5),
});

// Variante "zod": schema como o Zod gera (oneOf + const). Variante "adaptado": oneOf vira anyOf e
// const vira enum de um valor. A validação no backend usa sempre o schema Zod original.
const VARIANTE = process.env.PROVA_VARIANTE ?? "zod";

// Variantes controladas (uma mudança por vez): zod | sem_schema | anyof | adaptado (as duas).
const MUDANCAS = {
  zod: { tiraSchema: false, anyOf: false },
  sem_schema: { tiraSchema: true, anyOf: false },
  anyof: { tiraSchema: false, anyOf: true },
  adaptado: { tiraSchema: true, anyOf: true },
}[VARIANTE];
if (!MUDANCAS) throw new Error(`Variante desconhecida: ${VARIANTE}`);

function adaptar(node, raiz = true) {
  if (Array.isArray(node)) return node.map((item) => adaptar(item, false));
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema" && raiz && MUDANCAS.tiraSchema) continue;
    if (key === "oneOf" && MUDANCAS.anyOf) out.anyOf = adaptar(value, false);
    else if (key === "const" && MUDANCAS.anyOf) out.enum = [value];
    else out[key] = adaptar(value, false);
  }
  return out;
}

const schema = adaptar(z.toJSONSchema(Proposta));

const SISTEMA =
  "Você configura sistemas de gestão a partir de um catálogo fechado. Responda só com JSON no " +
  "schema dado. Use apenas módulos e tipos de regra do schema. Não invente valores que o dono não " +
  "disse: quando faltar informação, registre o requisito como pendente e faça uma pergunta. " +
  "Dinheiro em centavos.";
const NEGOCIO =
  "Tenho uma distribuidora de bebidas. Vendo cerveja em lata, por unidade ou na caixa com 12, e " +
  "chope em barril. Quem compra a partir de mil reais paga o preço de atacado. Também levo a " +
  "chopeira na casa do cliente e busco depois, sempre o mesmo técnico, cada visita leva uma hora. " +
  "Quando começo um pedido quero segurar o estoque por um tempo até fechar.";

async function chamar() {
  const inicio = Date.now();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SISTEMA }] },
        contents: [{ role: "user", parts: [{ text: NEGOCIO }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature: 0,
          maxOutputTokens: 4096,
        },
      }),
    },
  );
  const body = await response.json();
  const ms = Date.now() - inicio;
  if (!response.ok) return { ok: false, http: response.status, erro: body.error?.message, ms };

  const texto = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const uso = body.usageMetadata ?? {};
  const entrada = uso.promptTokenCount ?? 0;
  const saida = (uso.candidatesTokenCount ?? 0) + (uso.thoughtsTokenCount ?? 0);
  const usd = (entrada * PRECO.entrada + saida * PRECO.saida) / 1e6;

  let validacao;
  let proposta;
  try {
    proposta = JSON.parse(texto);
    const r = Proposta.safeParse(proposta);
    validacao = r.success ? "ok" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  } catch {
    validacao = "json_invalido";
  }

  return {
    ok: true,
    ms,
    modeloRespondido: body.modelVersion,
    tokens: { entrada, saida, raciocinio: uso.thoughtsTokenCount ?? 0 },
    custo: { usd, brl: usd * USD_BRL * (1 + IOF) },
    validacao,
    resposta: texto,
    resumo: proposta && {
      modelo: proposta.modelo,
      modulos: proposta.modulos,
      regras: proposta.regras?.map(
        (r) => r.tipo + ":" + (r.valor_centavos ?? r.unidades ?? r.minutos),
      ),
      pendentes: proposta.requisitos?.filter((q) => q.status === "pendente").length,
      perguntas: proposta.perguntas,
    },
  };
}

const execucoes = [];
for (let i = 0; i < REPETICOES; i++) execucoes.push(await chamar());
const validas = execucoes.filter((e) => e.ok);
const media = (f) => validas.reduce((s, e) => s + f(e), 0) / Math.max(validas.length, 1);

console.log(
  JSON.stringify(
    {
      quando: new Date().toISOString(),
      modelo: MODEL,
      variante: VARIANTE,
      schemaBytes: JSON.stringify(schema).length,
      schemaEnviado: schema,
      respostasIguais: new Set(validas.map((e) => e.resposta)).size === 1,
      execucoes,
      media: {
        tokensEntrada: media((e) => e.tokens.entrada),
        tokensSaida: media((e) => e.tokens.saida),
        custoBrl: media((e) => e.custo.brl),
      },
    },
    null,
    2,
  ),
);
