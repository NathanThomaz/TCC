"""Máquina de estados de uma execução e cálculo de tempo ativo.

O estado é sempre reconstruído a partir dos eventos já registrados, então não
existe estado escondido fora de data/raw/.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from tcc_exp.eventos import ts

# Eventos que podem ocorrer em qualquer estado depois da abertura.
LIVRES = {"nota", "analise_estatica", "metadados_ia", "anexo", "percepcao", "questionario"}

TRANSICOES: dict[str | None, dict[str, str]] = {
    None: {"abertura": "aberta"},
    "aberta": {"inicio": "em_execucao", "aborto": "abortada"},
    "em_execucao": {
        "pausa": "pausada",
        "teste_publico": "em_execucao",
        "entrega": "avaliando",
        "fim": "encerrada",
        "aborto": "abortada",
    },
    "pausada": {"retomada": "em_execucao", "aborto": "abortada"},
    "avaliando": {"avaliacao": "avaliada"},
    "avaliada": {"devolutiva": "em_execucao", "fim": "encerrada"},
    "encerrada": {},
    "abortada": {},
}


class TransicaoInvalida(RuntimeError):
    pass


@dataclass
class EstadoSessao:
    estado: str | None = None
    exec_id: str | None = None
    tarefa_id: str | None = None
    condicao: str | None = None
    entregas: int = 0
    devolutivas: int = 0
    eventos: list[dict] = field(default_factory=list)

    @property
    def finalizada(self) -> bool:
        return self.estado in ("encerrada", "abortada")


def proximo_estado(estado: str | None, tipo: str) -> str | None:
    if tipo in LIVRES and estado is not None:
        return estado
    destinos = TRANSICOES.get(estado, {})
    if tipo not in destinos:
        permitidos = sorted(set(destinos) | (LIVRES if estado is not None else set()))
        raise TransicaoInvalida(
            f"Evento '{tipo}' não é permitido no estado '{estado}'. Permitidos: {permitidos}"
        )
    return destinos[tipo]


def reconstruir(eventos: list[dict]) -> EstadoSessao:
    s = EstadoSessao(eventos=list(eventos))
    for ev in eventos:
        s.estado = proximo_estado(s.estado, ev["tipo"])
        if ev["tipo"] == "abertura":
            s.exec_id = ev["exec_id"]
            s.tarefa_id = ev["payload"].get("tarefa_id")
            s.condicao = ev["payload"].get("condicao")
        elif ev["tipo"] == "entrega":
            s.entregas += 1
        elif ev["tipo"] == "devolutiva":
            s.devolutivas += 1
    return s


def tempo_ativo(eventos: list[dict], i_ini: int, i_fim: int) -> float:
    """Segundos ativos entre eventos[i_ini] e eventos[i_fim], descontando pausas."""
    if i_fim < i_ini:
        raise ValueError("i_fim deve ser >= i_ini")
    total = (ts(eventos[i_fim]) - ts(eventos[i_ini])).total_seconds()
    inicio_pausa = None
    for ev in eventos[i_ini : i_fim + 1]:
        if ev["tipo"] == "pausa":
            inicio_pausa = ts(ev)
        elif ev["tipo"] == "retomada" and inicio_pausa is not None:
            total -= (ts(ev) - inicio_pausa).total_seconds()
            inicio_pausa = None
    if inicio_pausa is not None:  # pausa aberta até o fim do intervalo
        total -= (ts(eventos[i_fim]) - inicio_pausa).total_seconds()
    return total


def indice(eventos: list[dict], tipo: str, a_partir: int = 0) -> int | None:
    for i in range(a_partir, len(eventos)):
        if eventos[i]["tipo"] == tipo:
            return i
    return None


def tempo_ativo_desde_inicio(eventos: list[dict]) -> float | None:
    i = indice(eventos, "inicio")
    if i is None:
        return None
    return tempo_ativo(eventos, i, len(eventos) - 1)
