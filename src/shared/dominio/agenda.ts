import type { ConfigDraft } from "../contract/schema";

// Regras de agenda (seção 13). Intervalos [início, fim) em ms UTC; a exibição usa o fuso
// America/Sao_Paulo (AGE-10). A sobreposição por profissional é barrada também no D1.

export const FUSO = "America/Sao_Paulo";
const MINUTO = 60_000;

export interface Intervalo {
  inicio: number;
  fim: number;
}

export interface PlanoAtendimento {
  tipo: string;
  intervalo: Intervalo;
}

export type ErroAgenda =
  | { code: "tipo_desconhecido"; message: string }
  | { code: "horario_no_passado"; message: string }
  | { code: "segundo_horario_obrigatorio"; message: string }
  | { code: "segundo_antes_do_fim"; message: string }
  | { code: "segundo_sem_par"; message: string };

/** Par configurado em que o tipo é o primeiro (ex.: instalação → retirada), se houver. */
export function parDoTipo(config: ConfigDraft, tipo: string) {
  for (const regra of config.regras) {
    if (regra.tipo === "par_atendimento" && regra.primeiro === tipo) return regra;
  }
  return null;
}

/** Tipos que só existem como segundo de um par: não são agendados sozinhos. */
export function ehSegundoDePar(config: ConfigDraft, tipo: string): boolean {
  return config.regras.some((r) => r.tipo === "par_atendimento" && r.segundo === tipo);
}

function duracao(config: ConfigDraft, tipo: string): number | null {
  const encontrado = config.tipos_atendimento.find((t) => t.id === tipo);
  return encontrado ? encontrado.duracao_minutos * MINUTO : null;
}

/**
 * Planeja um atendimento (ou o par dele) a partir da configuração: duração do tipo (AGE-03),
 * nada no passado (AGE-06) e, no par, o segundo começando no fim do primeiro ou depois (AGE-04).
 */
export function planejarAtendimento(
  config: ConfigDraft,
  pedido: { tipo: string; inicio: number; inicioSegundo?: number | undefined },
  agora: number,
): { planos: PlanoAtendimento[] } | { erro: ErroAgenda } {
  const dur = duracao(config, pedido.tipo);
  if (dur === null) {
    return { erro: { code: "tipo_desconhecido", message: "Tipo de atendimento não configurado." } };
  }
  if (ehSegundoDePar(config, pedido.tipo)) {
    return {
      erro: {
        code: "segundo_sem_par",
        message: "Este atendimento é agendado junto com o primeiro do par.",
      },
    };
  }
  if (pedido.inicio < agora) {
    return { erro: { code: "horario_no_passado", message: "Não é possível agendar no passado." } };
  }
  const primeiro = {
    tipo: pedido.tipo,
    intervalo: { inicio: pedido.inicio, fim: pedido.inicio + dur },
  };
  const par = parDoTipo(config, pedido.tipo);
  if (!par) return { planos: [primeiro] };

  if (pedido.inicioSegundo === undefined) {
    return {
      erro: {
        code: "segundo_horario_obrigatorio",
        message: "Informe também o horário do segundo atendimento do par.",
      },
    };
  }
  const durSegundo = duracao(config, par.segundo);
  if (durSegundo === null) {
    return { erro: { code: "tipo_desconhecido", message: "Tipo de atendimento não configurado." } };
  }
  if (pedido.inicioSegundo < primeiro.intervalo.fim) {
    return {
      erro: {
        code: "segundo_antes_do_fim",
        message: "O segundo atendimento começa depois do fim do primeiro.",
      },
    };
  }
  return {
    planos: [
      primeiro,
      {
        tipo: par.segundo,
        intervalo: { inicio: pedido.inicioSegundo, fim: pedido.inicioSegundo + durSegundo },
      },
    ],
  };
}

/** Intervalos semiabertos: consecutivos (fim = início) não conflitam (AGE-05). */
export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

function partesEmSaoPaulo(instante: number) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return {
    ano: valor("year"),
    mes: valor("month"),
    dia: valor("day"),
    hora: valor("hour"),
    minuto: valor("minute"),
  };
}

/** Valor para `<input type="datetime-local">` ("2026-11-06T14:00") no fuso do Nexus. */
export function paraCampoLocal(instante: number): string {
  const p = partesEmSaoPaulo(instante);
  return `${p.ano}-${p.mes}-${p.dia}T${p.hora}:${p.minuto}`;
}

/**
 * "2026-11-06T14:00" lido como horário de São Paulo → instante UTC, independente do fuso do
 * navegador. O deslocamento vem do Intl (vale também se o horário de verão voltar).
 */
export function deCampoLocal(texto: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(texto);
  if (!m) return null;
  const [ano, mes, dia, hora, minuto] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const comoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let instante = comoUtc;
  // Duas passadas resolvem a troca de deslocamento perto da virada.
  for (let i = 0; i < 2; i++) {
    const p = partesEmSaoPaulo(instante);
    const lido = Date.UTC(+p.ano, +p.mes - 1, +p.dia, +p.hora, +p.minuto);
    instante += comoUtc - lido;
  }
  return instante;
}

/** "05/11/2026 14:30" no fuso do Nexus. */
export function formatarDataHora(instante: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instante);
}
