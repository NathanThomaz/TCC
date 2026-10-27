"""Registro das condições experimentais relativas à IA.

Este módulo é um adaptador de REGISTRO: ele não chama a API de nenhum fornecedor.
Quem usa a ferramenta é o executor. O instrumento só documenta qual ferramenta,
modelo e versão estavam em uso em cada execução, sem se acoplar a nenhum fornecedor.
"""

from __future__ import annotations

from tcc_exp.config import ErroConfiguracao

CONDICOES = {"A": "sem IA", "B": "com IA"}
MODALIDADES = {"ide-chat", "chat-externo", "agente"}
CAMPOS_OBRIGATORIOS = ("nome", "fornecedor", "modalidade", "modelo")


def validar_ferramenta(ferramenta: dict) -> None:
    faltando = [c for c in CAMPOS_OBRIGATORIOS if not str(ferramenta.get(c, "")).strip()]
    if faltando:
        raise ErroConfiguracao(
            "Ferramenta de IA não configurada em experiment/config/experimento.toml "
            f"(campos vazios: {', '.join(faltando)}). Decisão D3 pendente?"
        )
    if ferramenta["modalidade"] not in MODALIDADES:
        raise ErroConfiguracao(f"modalidade deve ser uma de {sorted(MODALIDADES)}")


def metadados_condicao(
    condicao: str,
    experimento: dict,
    confirmo_sem_ia: bool = False,
    modelo_observado: str | None = None,
) -> dict:
    """Monta o payload do evento `metadados_ia` e falha explicitamente se o protocolo não for cumprido."""
    if condicao not in CONDICOES:
        raise ValueError(f"Condição inválida: {condicao!r}")
    if condicao == "A":
        if not confirmo_sem_ia:
            raise ErroConfiguracao(
                "Condição A exige confirmação de que toda assistência de IA está desativada "
                "(use --confirmo-sem-ia após conferir o checklist em docs/guia-sessao.md)."
            )
        return {"condicao": "A", "ia_desativada_confirmada": True}

    ferramenta = dict(experimento.get("ferramenta_ia", {}))
    validar_ferramenta(ferramenta)
    payload = {"condicao": "B", "ferramenta": ferramenta}
    if modelo_observado:
        payload["modelo_observado"] = modelo_observado
        payload["modelo_diverge_da_config"] = modelo_observado != ferramenta["modelo"]
    return payload
