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
