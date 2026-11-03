// Cliente da prova no D1 remoto: roda os cenários sequenciais e dispara reservas simultâneas.
// Uso: PROVA_URL=https://... PROVA_TOKEN=... node provas/d1-atomicidade/run.js
const url = process.env.PROVA_URL;
const token = process.env.PROVA_TOKEN;
const PARALLEL = Number(process.env.PROVA_PARALELAS ?? 40);
if (!url || !token) throw new Error("Defina PROVA_URL e PROVA_TOKEN");

const call = async (method, path) => {
  const response = await fetch(`${url}${path}`, { method, headers: { "x-prova-token": token } });
  return { status: response.status, body: await response.json() };
};

const sequencial = await call("POST", "/sequencial");
await call("POST", "/reset");
// Estoque físico 30, 2 unidades por reserva: no máximo 15 podem ser aceitas.
const results = await Promise.all(
  Array.from({ length: PARALLEL }, () => call("POST", "/reservar")),
);
const aceitas = results.filter((r) => r.body.ok).length;
const recusadas = results.filter((r) => !r.body.ok);
const estado = await call("GET", "/estado");

console.log(
  JSON.stringify(
    {
      quando: new Date().toISOString(),
      sequencial: sequencial.body,
      concorrencia: {
        requisicoes: PARALLEL,
        aceitas,
        recusadas: recusadas.length,
        motivosRecusa: [...new Set(recusadas.map((r) => r.body.erro))],
        estadoFinal: estado.body,
        esperado: { aceitas: 15, unidades: 30 },
      },
    },
    null,
    2,
  ),
);

// Falha (código de saída 1) se qualquer resposta não for 200 ou se um invariante não se confirmar.
const s = sequencial.body ?? {};
const falhas = [
  sequencial.status !== 200 && `sequencial HTTP ${sequencial.status}`,
  estado.status !== 200 && `estado HTTP ${estado.status}`,
  results.some((r) => r.status !== 200) && "alguma reserva respondeu fora de 200",
  s.loteComFalha?.reservasGravadas !== 0 && "lote com falha gravou reservas",
  s.foraDoLote?.reservasGravadas !== 1 && "contraste fora do lote diferente de 1",
  s.parDeAgenda?.agendamentos !== 1 && "par de agenda gravou parcialmente",
  aceitas !== 15 && `aceitas = ${aceitas}, esperado 15`,
  estado.body?.unidades !== 30 && `unidades reservadas = ${estado.body?.unidades}, esperado 30`,
].filter(Boolean);
if (falhas.length) {
  console.error("PROVA FALHOU:", falhas.join("; "));
  process.exit(1);
}
