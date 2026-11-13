import { describe, expect, it } from "vitest";
import {
  deCampoLocal,
  formatarDataHora,
  paraCampoLocal,
  planejarAtendimento,
  sobrepoe,
} from "../../src/shared/dominio/agenda";
import { validarCampos } from "../../src/shared/dominio/campos";
import { calcularTotais, unidadesDoItem } from "../../src/shared/dominio/precos";
import { conferirHorarios } from "../../src/shared/dominio/regras";
import { DISTRIBUIDORA } from "../fixtures/distribuidora";

// Regras puras compartilhadas entre o Worker e as telas (seções 10 e 13).

const H = 3_600_000;
const AGORA = Date.UTC(2026, 10, 5, 12, 0);

describe("preços e quantidades", () => {
  it("T15: 2 caixas de 12 + 3 unidades = 27; caixa sem fator é recusada", () => {
    expect(unidadesDoItem(2, 3, 12)).toBe(27);
    expect(() => unidadesDoItem(1, 0, null)).toThrow(RangeError);
    expect(unidadesDoItem(0, 5, null)).toBe(5);
  });

  it("sem limite de atacado tudo é varejo", () => {
    const t = calcularTotais(
      [{ unidades: 1000, varejoCentavos: 500, atacadoCentavos: null }],
      null,
    );
    expect(t).toMatchObject({ faixa: "varejo", totalCentavos: 500_000 });
  });
});

describe("agenda", () => {
  it("AGE-10: 14:00 em São Paulo é 17:00 UTC, independente do fuso do navegador", () => {
    const instante = deCampoLocal("2026-11-06T14:00");
    expect(instante).toBe(Date.UTC(2026, 10, 6, 17, 0));
    expect(paraCampoLocal(instante!)).toBe("2026-11-06T14:00");
    expect(formatarDataHora(instante!)).toBe("06/11/2026, 14:00");
    expect(deCampoLocal("06/11/2026")).toBeNull();
  });

  it("AGE-03/AGE-04: par com a duração configurada; segundo antes do fim é recusado", () => {
    const ok = planejarAtendimento(
      DISTRIBUIDORA,
      { tipo: "instalacao", inicio: AGORA + H, inicioSegundo: AGORA + 2 * H },
      AGORA,
    );
    expect(ok).toEqual({
      planos: [
        { tipo: "instalacao", intervalo: { inicio: AGORA + H, fim: AGORA + 2 * H } },
        { tipo: "retirada", intervalo: { inicio: AGORA + 2 * H, fim: AGORA + 3 * H } },
      ],
    });
    const antes = planejarAtendimento(
      DISTRIBUIDORA,
      { tipo: "instalacao", inicio: AGORA + H, inicioSegundo: AGORA + H + 1 },
      AGORA,
    );
    expect(antes).toMatchObject({ erro: { code: "segundo_antes_do_fim" } });
    const semSegundo = planejarAtendimento(
      DISTRIBUIDORA,
      { tipo: "instalacao", inicio: AGORA + H },
      AGORA,
    );
    expect(semSegundo).toMatchObject({ erro: { code: "segundo_horario_obrigatorio" } });
  });

  it("AGE-05: intervalos semiabertos — consecutivos não conflitam", () => {
    expect(sobrepoe({ inicio: 0, fim: 10 }, { inicio: 10, fim: 20 })).toBe(false);
    expect(sobrepoe({ inicio: 0, fim: 10 }, { inicio: 9, fim: 20 })).toBe(true);
  });
});

describe("campos informativos", () => {
  it("aceita os definidos, recusa desconhecido e exige obrigatório", () => {
    expect(validarCampos(DISTRIBUIDORA, "clientes", { telefone: " 5199 " })).toEqual({
      valores: { telefone: "5199" },
    });
    expect(validarCampos(DISTRIBUIDORA, "clientes", { cpf: "1" })).toHaveProperty("erros");
    expect(validarCampos(DISTRIBUIDORA, "agendamentos", {})).toHaveProperty("erros");
    expect(validarCampos(DISTRIBUIDORA, "agendamentos", { endereco: "Rua A" })).toEqual({
      valores: { endereco: "Rua A" },
    });
  });
});

describe("regras de horário (ADR-005)", () => {
  // Sexta, 06/11/2026, no fuso de São Paulo (UTC−3).
  const sexta = (h: number, m = 0, seg = 0) => Date.UTC(2026, 10, 6, h + 3, m, seg);
  const config = {
    ...DISTRIBUIDORA,
    regras: [
      ...DISTRIBUIDORA.regras,
      {
        tipo: "horario_funcionamento" as const,
        abre: "08:00",
        fecha: "12:00",
        dias_semana: [5],
        requisitos: ["REQ-01"],
      },
    ],
  };
  const agora = sexta(0);

  it("aceita do horário de abertura até o fechamento, inclusive", () => {
    expect(conferirHorarios(config, [{ inicio: sexta(8), fim: sexta(12) }], agora)).toBeNull();
  });

  it("conta os segundos: terminar 30 s depois do fechamento é recusado", () => {
    expect(
      conferirHorarios(config, [{ inicio: sexta(11, 0, 30), fim: sexta(12, 0, 30) }], agora)?.code,
    ).toBe("fora_do_horario");
    expect(conferirHorarios(config, [{ inicio: sexta(7, 59), fim: sexta(9) }], agora)?.code).toBe(
      "fora_do_horario",
    );
  });

  it("fechamento às 23:59 permite terminar à meia-noite", () => {
    const ateMeiaNoite = {
      ...config,
      regras: config.regras.map((r) =>
        r.tipo === "horario_funcionamento" ? { ...r, fecha: "23:59" } : r,
      ),
    };
    expect(
      conferirHorarios(ateMeiaNoite, [{ inicio: sexta(23), fim: sexta(24) }], agora),
    ).toBeNull();
  });
});
