"""Cliente para validação e consulta de CNPJ via BrasilAPI (https://brasilapi.com.br).

BrasilAPI agrega, entre outras, a base pública de CNPJ da Receita Federal — usada
aqui para verificar que as principais empresas do dataset (ver
src/comum/empresas_verificadas.py) são pessoas jurídicas reais e ativas, não nomes
fictícios ou mal formatados.

`validar_cnpj` é puramente algorítmico (dígitos verificadores, sem chamada de rede).
`consultar_cnpj` faz a chamada real à Receita Federal via BrasilAPI.
"""

import re

import requests

TIMEOUT_PADRAO = 15
BRASILAPI_CNPJ_URL = "https://brasilapi.com.br/api/cnpj/v1"


def _somente_digitos(cnpj: str) -> str:
    return re.sub(r"\D", "", cnpj or "")


def validar_cnpj(cnpj: str) -> bool:
    """Valida o formato e os dígitos verificadores de um CNPJ (algoritmo público da
    Receita Federal — não confirma que o CNPJ existe de fato, só que é bem formado)."""
    numeros = _somente_digitos(cnpj)
    if len(numeros) != 14 or numeros == numeros[0] * 14:
        return False

    def _digito_verificador(base: str, pesos: list) -> str:
        soma = sum(int(digito) * peso for digito, peso in zip(base, pesos))
        resto = soma % 11
        return "0" if resto < 2 else str(11 - resto)

    pesos_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    digito_1 = _digito_verificador(numeros[:12], pesos_1)
    digito_2 = _digito_verificador(numeros[:12] + digito_1, pesos_2)
    return numeros[12:] == digito_1 + digito_2


def consultar_cnpj(cnpj: str) -> dict:
    """Consulta os dados oficiais de um CNPJ na Receita Federal via BrasilAPI.
    Levanta requests.HTTPError se o CNPJ não for encontrado (404) ou a API falhar."""
    numeros = _somente_digitos(cnpj)
    resposta = requests.get(f"{BRASILAPI_CNPJ_URL}/{numeros}", timeout=TIMEOUT_PADRAO)
    resposta.raise_for_status()
    return resposta.json()
