"""Empresas verificadas manualmente por CNPJ junto à Receita Federal (via BrasilAPI).

Nenhuma das cinco fontes de vagas (Adzuna, Jooble, RemoteOK, Remotive, Arbeitnow)
retorna CNPJ — só o nome da empresa em texto livre. Não existe busca reversa
gratuita "nome da empresa → CNPJ" em escala nacional no Brasil, então validar
automaticamente as 1000+ empresas do dataset não é tecnicamente possível hoje.

Em vez disso, as empresas com maior volume de vagas e identificação inequívoca
foram pesquisadas manualmente e tiveram o CNPJ validado de verdade (dígitos
verificadores + consulta à Receita Federal via BrasilAPI, situação ATIVA
confirmada) em 2026-07-14. Ver src/comum/cliente_brasilapi.py para o cliente
usado na verificação, e src/analitico/tabelas_gold.py:aplicar_verificacao_cnpj
para como isso é aplicado à dim_empresa.

Os dados abaixo (razão social, situação, porte, CNAE) são um retrato do momento
da verificação — não são recalculados a cada execução do pipeline, pois a
situação cadastral de uma empresa não muda dia a dia, e depender de uma chamada
de rede toda vez que a camada Gold é gerada adicionaria uma fragilidade
desnecessária. Para reverificar, rode este módulo como script
(`python -m src.comum.empresas_verificadas`).

A chave de cada entrada é a mesma gerada por
src.comum.normalizacao_empresa.chave_agrupamento_empresa para o nome como
aparece nos dados tratados — é assim que a junção com a dim_empresa é feita.
"""

EMPRESAS_VERIFICADAS = {
    "stefanini": {
        "cnpj": "58069360000120",
        "razao_social": "STEFANINI CONSULTORIA E ASSESSORIA EM INFORMATICA S.A.",
        "situacao_cadastral": "ATIVA",
        "porte": "DEMAIS",
        "cnae_principal": "Desenvolvimento de programas de computador sob encomenda",
    },
    "grupo gps": {
        "cnpj": "09229201000130",
        "razao_social": "GPS PARTICIPACOES E EMPREENDIMENTOS S.A.",
        "situacao_cadastral": "ATIVA",
        "porte": "DEMAIS",
        "cnae_principal": "Holdings de instituições não-financeiras",
    },
    "btg pactual": {
        "cnpj": "30306294000145",
        "razao_social": "BANCO BTG PACTUAL S.A.",
        "situacao_cadastral": "ATIVA",
        "porte": "DEMAIS",
        "cnae_principal": "Bancos múltiplos, com carteira comercial",
    },
    "radix": {
        "cnpj": "11677441000149",
        "razao_social": "RADIX ENGENHARIA E DESENVOLVIMENTO DE SOFTWARE S/A",
        "situacao_cadastral": "ATIVA",
        "porte": "DEMAIS",
        "cnae_principal": "Desenvolvimento de programas de computador sob encomenda",
    },
    "itaú unibanco": {
        "cnpj": "60701190000104",
        "razao_social": "ITAU UNIBANCO S.A.",
        "situacao_cadastral": "ATIVA",
        "porte": "DEMAIS",
        "cnae_principal": "Bancos comerciais",
    },
    "almaviva experience": {
        "cnpj": "08174089000114",
        "razao_social": "ALMAVIVA EXPERIENCE S.A.",
        "situacao_cadastral": "ATIVA",
        "porte": "DEMAIS",
        "cnae_principal": "Atividades de teleatendimento",
    },
    "sonda it": {
        "cnpj": "64641327000125",
        "razao_social": "SONDA DO BRASIL LTDA",
        "situacao_cadastral": "ATIVA",
        "porte": "DEMAIS",
        "cnae_principal": "Suporte técnico, manutenção e outros serviços em tecnologia da informação",
    },
}


if __name__ == "__main__":
    # Reverifica cada CNPJ acima contra a Receita Federal (chamada de rede real).
    import logging

    from src.comum.cliente_brasilapi import consultar_cnpj, validar_cnpj

    logging.basicConfig(level=logging.INFO)
    for chave, dados in EMPRESAS_VERIFICADAS.items():
        cnpj = dados["cnpj"]
        if not validar_cnpj(cnpj):
            logging.error("%s: CNPJ %s com dígitos verificadores inválidos!", chave, cnpj)
            continue
        atual = consultar_cnpj(cnpj)
        situacao_atual = atual.get("descricao_situacao_cadastral")
        divergente = situacao_atual != dados["situacao_cadastral"]
        nivel = logging.WARNING if divergente else logging.INFO
        logging.log(nivel, "%s (%s): situação atual = %s (cadastrado: %s)", chave, cnpj, situacao_atual, dados["situacao_cadastral"])
