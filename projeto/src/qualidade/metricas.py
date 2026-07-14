"""Métricas de qualidade de dados da plataforma (Capítulo 3, Quadro 7).

Calcula completude, consistência entre camadas, unicidade e acurácia de tipos
da camada Gold, e verifica os critérios de aceitação que operacionalizam a
hipótese do TCC (completude >= 95%, consistência >= 98%, unicidade = 100%,
acurácia de tipos = 100%).
"""

import json
import logging
from datetime import datetime, timezone

import pandas as pd

from src.comum.configuracoes import DADOS_GOLD, DADOS_BRONZE

logger = logging.getLogger(__name__)

CRITERIOS_ACEITACAO = {
    "completude": 95.0,
    "consistencia": 98.0,
    "unicidade": 100.0,
    "acuracia_tipos": 100.0,
}

CAMPOS_OBRIGATORIOS_FATO_VAGAS = ["id_vaga", "id_tempo", "id_localizacao", "id_empresa", "id_categoria", "titulo"]

TIPOS_ESPERADOS_FATO_VAGAS = {
    "id_tempo": "int",
    "salario_min": "float",
    "salario_max": "float",
    "salario_medio": "float",
    "quantidade": "int",
}


def _contar_vagas_bronze_mais_recentes() -> int:
    """Conta os registros brutos da ingestão Adzuna mais recente (base do cálculo de consistência)."""
    diretorios = sorted((DADOS_BRONZE / "adzuna").glob("*"))
    if not diretorios:
        return 0
    diretorio_mais_recente = diretorios[-1]
    total = 0
    for arquivo in diretorio_mais_recente.glob("vagas_pagina_*.json"):
        total += len(json.loads(arquivo.read_text(encoding="utf-8")))
    return total


def calcular_completude(df: pd.DataFrame, campos_obrigatorios: list) -> float:
    """Proporção de campos obrigatórios preenchidos sobre o total esperado."""
    total_esperado = len(df) * len(campos_obrigatorios)
    if total_esperado == 0:
        return 0.0
    registros_completos = df[campos_obrigatorios].notna().sum().sum()
    return round((registros_completos / total_esperado) * 100, 2)


def calcular_consistencia(total_bronze: int, total_gold: int) -> float:
    """Proporção de registros da Bronze que chegam íntegros à Gold, sem perda não justificada."""
    if total_bronze == 0:
        return 0.0
    return round((total_gold / total_bronze) * 100, 2)


def calcular_unicidade(df: pd.DataFrame, chave: str) -> float:
    """Proporção de registros sem duplicidade pela chave de negócio."""
    total = len(df)
    if total == 0:
        return 100.0
    duplicatas = df[chave].duplicated().sum()
    return round(((total - duplicatas) / total) * 100, 2)


def calcular_acuracia_tipos(df: pd.DataFrame, tipos_esperados: dict) -> float:
    """Proporção de campos cujo tipo de dado gravado corresponde ao tipo esperado."""
    total_campos = len(tipos_esperados)
    if total_campos == 0:
        return 100.0
    campos_corretos = 0
    for campo, tipo_esperado in tipos_esperados.items():
        if campo not in df.columns:
            continue
        if tipo_esperado == "int" and pd.api.types.is_integer_dtype(df[campo]):
            campos_corretos += 1
        elif tipo_esperado == "float" and pd.api.types.is_numeric_dtype(df[campo]):
            campos_corretos += 1
    return round((campos_corretos / total_campos) * 100, 2)


def gerar_relatorio() -> pd.DataFrame:
    """Calcula as métricas de qualidade da camada Gold (Quadro 7) e grava o relatório em Parquet."""
    fato_vagas = pd.read_parquet(DADOS_GOLD / "fato_vagas" / "fato_vagas.parquet")

    total_bronze = _contar_vagas_bronze_mais_recentes()
    total_gold = len(fato_vagas)

    metricas = {
        "completude": calcular_completude(fato_vagas, CAMPOS_OBRIGATORIOS_FATO_VAGAS),
        "consistencia": calcular_consistencia(total_bronze, total_gold),
        "unicidade": calcular_unicidade(fato_vagas, "id_vaga"),
        "acuracia_tipos": calcular_acuracia_tipos(fato_vagas, TIPOS_ESPERADOS_FATO_VAGAS),
    }

    linhas = []
    for nome_metrica, valor in metricas.items():
        criterio = CRITERIOS_ACEITACAO[nome_metrica]
        atende = valor >= criterio
        linhas.append(
            {
                "data_avaliacao": datetime.now(timezone.utc).isoformat(),
                "metrica": nome_metrica,
                "valor_percentual": valor,
                "criterio_aceitacao": criterio,
                "atende_criterio": atende,
            }
        )
        nivel_log = logging.INFO if atende else logging.WARNING
        logger.log(nivel_log, "Métrica '%s': %.2f%% (critério >= %.2f%%)", nome_metrica, valor, criterio)

    relatorio = pd.DataFrame(linhas)
    destino = DADOS_GOLD / "metricas_qualidade"
    destino.mkdir(parents=True, exist_ok=True)
    relatorio.to_parquet(destino / "metricas_qualidade.parquet", index=False)
    return relatorio


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(gerar_relatorio().to_string(index=False))
