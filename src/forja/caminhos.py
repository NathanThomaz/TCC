"""Modelo navegável do mapa: campos, relacionamentos e resolução de caminhos.

Um caminho como 'produto.estoque' é percorrido segmento a segmento:
- um segmento pode ser um CAMPO (só no fim) ou o NOME de um relacionamento;
- relacionamento "para um" leva a um registro; "para muitos" leva a uma coleção,
  que só pode aparecer no fim do caminho (para agregações e para_cada).
Nada é executado: o mapa é tratado apenas como dados.
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass, field

FAMILIA_DO_TIPO = {
    "inteiro": "numero", "decimal": "numero", "moeda": "numero",
    "texto": "texto", "texto_longo": "texto", "telefone": "texto", "email": "texto", "opcoes": "texto",
    "data": "data", "data_hora": "data",
    "booleano": "booleano",
}


def origem_do_campo(campo: dict) -> str:
    """Origem efetiva: 'origem' explícita, ou o sinônimo obsoleto 'calculado: true'."""
    if "origem" in campo:
        return campo["origem"]
    return "calculo" if campo.get("calculado") is True else "usuario"


@dataclass(frozen=True)
class Navegacao:
    nome: str
    relacionamento: str
    destino: str
    muitos: bool


@dataclass(frozen=True)
class Resolucao:
    """Resultado de um caminho válido."""
    tipo: str            # "valor" | "registro" | "colecao"
    entidade: str        # entidade do campo (valor) ou do registro/coleção
    campo: dict | None = None

    @property
    def familia(self) -> str | None:
        return FAMILIA_DO_TIPO[self.campo["tipo"]] if self.campo else None


@dataclass(frozen=True)
class FalhaCaminho:
    codigo: str
    mensagem: str
    detalhes: dict = field(default_factory=dict)


@dataclass
class Modelo:
    entidades: dict[str, dict] = field(default_factory=dict)
    indice_entidade: dict[str, int] = field(default_factory=dict)
    campos: dict[str, dict[str, dict]] = field(default_factory=dict)
    indice_campo: dict[tuple[str, str], int] = field(default_factory=dict)
    relacionamentos: dict[str, dict] = field(default_factory=dict)
    navegacoes: dict[str, dict[str, Navegacao]] = field(default_factory=dict)
    # (índice do relacionamento, chave do nome, entidade, nome) dos nomes rejeitados por conflito
    conflitos: list[tuple[int, str, str, str]] = field(default_factory=list)

    @classmethod
    def do_mapa(cls, mapa: dict) -> "Modelo":
        m = cls()
        for i, ent in enumerate(mapa.get("entidades", [])):
            if ent["id"] in m.entidades:
                continue  # duplicata: a primeira ocorrência vale (o erro é reportado à parte)
            m.entidades[ent["id"]] = ent
            m.indice_entidade[ent["id"]] = i
            m.campos[ent["id"]] = {}
            m.navegacoes[ent["id"]] = {}
            for j, campo in enumerate(ent["campos"]):
                if campo["id"] not in m.campos[ent["id"]]:
                    m.campos[ent["id"]][campo["id"]] = campo
                    m.indice_campo[(ent["id"], campo["id"])] = j
        for i, rel in enumerate(mapa.get("relacionamentos", [])):
            if rel["id"] in m.relacionamentos:
                continue
            m.relacionamentos[rel["id"]] = rel
            origem, destino = rel["origem"], rel["destino"]
            if origem not in m.entidades or destino not in m.entidades:
                continue
            m._registrar(i, "nome_na_origem", origem, Navegacao(rel["nome_na_origem"], rel["id"], destino, True))
            m._registrar(i, "nome_no_destino", destino,
                         Navegacao(rel["nome_no_destino"], rel["id"], origem, rel["tipo"] == "muitos_para_muitos"))
        return m

    def _registrar(self, indice_rel: int, chave: str, entidade: str, nav: Navegacao) -> None:
        if nav.nome in self.campos[entidade] or nav.nome in self.navegacoes[entidade]:
            self.conflitos.append((indice_rel, chave, entidade, nav.nome))
            return
        self.navegacoes[entidade][nav.nome] = nav

    def resolver(self, entidade: str, caminho: str) -> Resolucao | FalhaCaminho:
        if entidade not in self.entidades:
            return FalhaCaminho("REF_ENTIDADE_INEXISTENTE", f"A entidade '{entidade}' não existe.")
        segmentos = caminho.split(".")
        atual = entidade
        for i, seg in enumerate(segmentos):
            ultimo = i == len(segmentos) - 1
            campo = self.campos[atual].get(seg)
            if campo is not None:
                if not ultimo:
                    return FalhaCaminho(
                        "CAMINHO_INVALIDO",
                        f"No caminho '{caminho}', '{seg}' é um campo de '{atual}' e não pode ser seguido de '.{segmentos[i + 1]}'.")
                return Resolucao("valor", atual, campo)
            nav = self.navegacoes[atual].get(seg)
            if nav is None:
                candidatos = sorted(set(self.campos[atual]) | set(self.navegacoes[atual]))
                sugestoes = difflib.get_close_matches(seg, candidatos, n=3)
                codigo = "REF_CAMPO_INEXISTENTE" if ultimo else "CAMINHO_INVALIDO"
                return FalhaCaminho(
                    codigo, f"O caminho '{caminho}' não existe a partir de '{entidade}': '{seg}' não é campo nem relacionamento de '{atual}'.",
                    {"valor": caminho, "sugestoes": sugestoes})
            if nav.muitos:
                if not ultimo:
                    return FalhaCaminho(
                        "CAMINHO_INVALIDO",
                        f"No caminho '{caminho}', '{seg}' é uma coleção; uma coleção só pode aparecer no fim do caminho.")
                return Resolucao("colecao", nav.destino)
            atual = nav.destino
        return Resolucao("registro", atual)
