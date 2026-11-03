// Confere que os cenários congelados do experimento não mudaram (ADR-002 do TCC).
// Roda na `check` do CI: qualquer alteração em enunciado, ficha ou gabarito falha o build.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const dir = new URL("./", import.meta.url);
const { sha256 } = JSON.parse(readFileSync(new URL("congelamento.json", dir), "utf8"));

const diferentes = Object.entries(sha256).filter(([arquivo, esperado]) => {
  const atual = createHash("sha256")
    .update(readFileSync(new URL(arquivo, dir)))
    .digest("hex");
  return atual !== esperado;
});

if (diferentes.length > 0) {
  console.error(
    `Cenários congelados foram alterados: ${diferentes.map(([a]) => a).join(", ")}. ` +
      "Depois do congelamento, mudança exige nova decisão do autor e nova versão do protocolo.",
  );
  process.exit(1);
}
console.log(`Cenários congelados conferidos (${Object.keys(sha256).length} arquivos).`);
