/**
 * Relógio de referência do backend (ADR-001, item 7). Toda regra que depende de tempo
 * (expiração de reservas, agenda no passado) lê o relógio daqui, nunca do navegador,
 * para que os testes possam fixar o instante.
 */
export interface Clock {
  /** Instante atual em milissegundos desde 1970-01-01 UTC. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** Relógio controlado para testes: começa em `start` e só anda quando mandado. */
export function fixedClock(start: number): Clock & { advance(ms: number): void } {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}
