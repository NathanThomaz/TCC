import { describe, expect, it } from "vitest";
import type { ClienteDto } from "../../../shared/api";
import type { Campo } from "@/types/nexus";
import { filtrarPessoas, textoDoCampo } from "./Pessoas";

const aniversario: Campo = {
  id: "aniversario",
  entidade: "clientes",
  rotulo: "Aniversário",
  tipo: "data",
  obrigatorio: false,
};
const pessoa = (nome: string, extra: Partial<ClienteDto> = {}): ClienteDto => ({
  id: nome,
  nome,
  sobrenome: null,
  nomeCompleto: nome,
  status: "active",
  campos: {},
  ...extra,
});
const ze = pessoa("José", {
  campos: { aniversario: "2026-11-13" },
  resumo: { desde: 1, totalCentavos: 500, ultimaCompra: 10 },
});
const ana = pessoa("Ana", {
  status: "inactive",
  resumo: { desde: 1, totalCentavos: 900, ultimaCompra: 5, proximoAtendimento: 50 },
});
const nomes = (l: ClienteDto[]) => l.map((p) => p.nome);

describe("tabela de clientes", () => {
  it("mostra data como dd/mm/aaaa e vazio como travessão", () => {
    expect(textoDoCampo(aniversario, "2026-11-13")).toBe("13/11/2026");
    expect(textoDoCampo(aniversario, undefined)).toBe("—");
  });

  it("busca pelo valor mostrado, pelo guardado e sem acento", () => {
    expect(nomes(filtrarPessoas([ze, ana], [aniversario], "13/11/2026", "todos", "nome"))).toEqual([
      "José",
    ]);
    expect(nomes(filtrarPessoas([ze, ana], [aniversario], "2026-11", "todos", "nome"))).toEqual([
      "José",
    ]);
    expect(nomes(filtrarPessoas([ze, ana], [], "jose", "todos", "nome"))).toEqual(["José"]);
  });

  it("filtra a situação e ordena por quem mais comprou ou pelo próximo atendimento", () => {
    expect(nomes(filtrarPessoas([ze, ana], [], "", "active", "nome"))).toEqual(["José"]);
    expect(nomes(filtrarPessoas([ze, ana], [], "", "todos", "total"))).toEqual(["Ana", "José"]);
    expect(nomes(filtrarPessoas([ze, ana], [], "", "todos", "ultima"))).toEqual(["José", "Ana"]);
    expect(nomes(filtrarPessoas([ze, ana], [], "", "todos", "proximo"))).toEqual(["Ana", "José"]);
  });
});

describe("sobrenome (2026-11-17)", () => {
  it("busca e ordena pelo nome completo", () => {
    const silva = pessoa("Maria", { sobrenome: "Silva", nomeCompleto: "Maria Silva" });
    const alves = pessoa("Maria", { id: "m2", sobrenome: "Alves", nomeCompleto: "Maria Alves" });
    expect(nomes(filtrarPessoas([silva, alves], [], "silva", "todos", "nome"))).toEqual(["Maria"]);
    expect(
      filtrarPessoas([silva, alves], [], "", "todos", "nome").map((p) => p.nomeCompleto),
    ).toEqual(["Maria Alves", "Maria Silva"]);
  });
});
