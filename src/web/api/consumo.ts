import type { ConsumoDto } from "../../shared/api";
import { chamar } from "./cliente";

// Consumo da IA por conta (/api/v1/consumo), só do dono do Nexus (ADR-009).

export async function obterConsumo(): Promise<ConsumoDto> {
  return (await chamar<{ consumo: ConsumoDto }>("/consumo")).consumo;
}

/** Limite mensal da conta em centavos; null volta ao padrão do Nexus. */
export async function definirLimite(id: string, limiteCentavos: number | null): Promise<void> {
  await chamar(`/consumo/${encodeURIComponent(id)}/limite`, {
    method: "POST",
    body: { limiteCentavos },
  });
}
