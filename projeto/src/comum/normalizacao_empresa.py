"""Normalização de nomes de empresa para fins de agrupamento (deduplicação).

Compartilhado entre a camada Gold (src/analitico/tabelas_gold.py) e a lista de
empresas verificadas por CNPJ (src/comum/empresas_verificadas.py) — as duas
precisam gerar exatamente a mesma chave para uma dada grafia de nome de empresa.
"""

# Sufixos societários removidos apenas para AGRUPAR nomes de empresa quase-idênticos
# (ex.: "stefanini" e "stefanini group" viram o mesmo grupo). O nome de exibição
# continua sendo a grafia original mais frequente — normalização determinística,
# não fuzzy matching probabilístico, para não arriscar unir empresas diferentes.
SUFIXOS_CORPORATIVOS_AGRUPAMENTO = [
    " ltda.", " ltda", " s.a.", " s/a", " sa", " me", " eireli", " epp",
    " inc.", " inc", " incorporated", " corp.", " corp", " corporation",
    " group", " grupo", " gmbh", " llc", " ltd.", " ltd", " co.", " co",
    " company", " holdings", " holding",
]


def chave_agrupamento_empresa(nome: str) -> str:
    """Normaliza um nome de empresa para fins de agrupamento (remove sufixo
    societário e espaços extras), sem alterar o nome de exibição."""
    if not isinstance(nome, str):
        return ""
    texto = " ".join(nome.strip().lower().split())
    for sufixo in SUFIXOS_CORPORATIVOS_AGRUPAMENTO:
        if texto.endswith(sufixo):
            texto = texto[: -len(sufixo)].strip()
            break
    return texto
