"""Camada 1: validação ESTRUTURAL (forma do mapa) contra o contrato JSON Schema."""

from __future__ import annotations

from jsonschema import Draft202012Validator

from .contrato import VERSAO_MAPA, carregar_schema
from .erros import PREFIXO_ESQUEMA, ErroValidacao, novo, ponteiro

_RESUMO = {
    "required": "propriedade obrigatória ausente",
    "additionalProperties": "propriedade não prevista no contrato",
    "enum": "valor não permitido",
    "const": "valor diferente do exigido",
    "type": "tipo de dado errado",
    "pattern": "formato inválido",
    "oneOf": "não corresponde a nenhuma das formas permitidas",
    "anyOf": "não corresponde a nenhuma das alternativas exigidas",
    "not": "combinação proibida pelo contrato",
    "minItems": "lista com menos itens que o mínimo",
    "minLength": "texto menor que o mínimo",
    "minProperties": "objeto sem as propriedades mínimas",
    "uniqueItems": "lista com itens repetidos",
}

_validador = None


def _validador_schema() -> Draft202012Validator:
    global _validador
    if _validador is None:
        _validador = Draft202012Validator(carregar_schema())
    return _validador


def validar_estrutura(mapa) -> list[ErroValidacao]:
    """Erros de forma. A versão é conferida antes, com mensagem de migração."""
    if isinstance(mapa, dict) and "versao_mapa" in mapa and mapa["versao_mapa"] != VERSAO_MAPA:
        return [novo(
            "VERSAO_NAO_SUPORTADA", ponteiro("versao_mapa"),
            f"Versão do mapa '{mapa['versao_mapa']}' não suportada; esperado '{VERSAO_MAPA}'. "
            "Veja a tabela de migração 0.1 → 0.2 no documento 'Contrato do Mapa do Sistema' (vault Documentação TCC).",
            camada="estrutural", valor=mapa["versao_mapa"], esperado=VERSAO_MAPA)]
    erros = []
    for e in _validador_schema().iter_errors(mapa):
        erros.append(ErroValidacao(
            codigo=PREFIXO_ESQUEMA + e.validator.upper(),
            caminho=ponteiro(*e.absolute_path),
            mensagem=f"{_RESUMO.get(e.validator, 'estrutura inválida')} ({e.validator}).",
            severidade="erro",
            camada="estrutural",
            detalhes={"palavra_chave": e.validator, "mensagem_original": e.message},
        ))
    return erros
