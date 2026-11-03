import { describe, expect, it } from "vitest";
import { TEMPLATE_MODULES } from "../../src/shared/contract/catalog";
import { validateDraft } from "../../src/shared/contract/validate";
import c1 from "../../experiments/cenarios/c1-gabarito.json";
import c2 from "../../experiments/cenarios/c2-gabarito.json";
import c3 from "../../experiments/cenarios/c3-gabarito.json";

// Os gabaritos do experimento precisam ser configurações que o próprio Nexus aceitaria;
// senão a comparação "configuração final × gabarito" mediria um alvo impossível.
const cenarios = [
  { nome: "C1", gabarito: c1, modelo: "comercio" },
  { nome: "C2", gabarito: c2, modelo: "servicos" },
  { nome: "C3", gabarito: c3, modelo: "comercio_com_servicos" },
] as const;

describe("gabaritos do experimento", () => {
  for (const { nome, gabarito, modelo } of cenarios) {
    it(`${nome} passa no validador sem bloqueios e cobre um modelo diferente`, () => {
      const result = validateDraft(gabarito);

      expect(result.issues.filter((i) => i.severity === "bloqueante")).toEqual([]);
      expect(result.ok).toBe(true);
      expect(gabarito.modelo).toBe(modelo);
      expect([...gabarito.modulos].sort()).toEqual([...TEMPLATE_MODULES[modelo]].sort());
    });
  }

  it("cada regra do gabarito aponta para um requisito do próprio gabarito", () => {
    for (const { gabarito } of cenarios) {
      const ids = new Set(gabarito.requisitos.map((r) => r.id));
      for (const regra of gabarito.regras) {
        for (const ref of regra.requisitos) expect(ids.has(ref)).toBe(true);
      }
    }
  });
});
