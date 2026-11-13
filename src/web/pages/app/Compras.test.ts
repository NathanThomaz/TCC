import { describe, expect, it } from "vitest";
import { hojeIso } from "./Compras";

describe("vencimento padrão da compra", () => {
  it("usa o dia de São Paulo, não o do navegador nem o UTC", () => {
    // 14/11 às 01:00 UTC ainda é 13/11 às 22:00 em São Paulo.
    expect(hojeIso(Date.UTC(2026, 10, 14, 1, 0))).toBe("2026-11-13");
    expect(hojeIso(Date.UTC(2026, 10, 14, 3, 0))).toBe("2026-11-14");
  });
});
