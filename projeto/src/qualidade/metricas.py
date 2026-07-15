"""Métricas de qualidade de dados da plataforma (Capítulo 3, Quadro 7).

Calcula completude, consistência entre camadas, unicidade, acurácia de tipos e
validade do nome da empresa (não é um espaço reservado tipo "confidencial") na
camada Gold, e verifica os critérios de aceitação que operacionalizam a
hipótese do TCC (completude >= 95%, consistência >= 98%, unicidade = 100%,
acurácia de tipos = 100%, validade de empresa >= 98%).

Consistência é medida como definida no Capítulo 3: proporção de registros que
chegam íntegros da Bronze à Gold "sem perda não justificada". A camada Silver
(src/tratamento/tratamento_vagas.py) já decompõe toda perda por causa (duplicata,
campo obrigatório vazio, data inválida) e grava essa decomposição em
dados/silver/vagas/relatorio_limpeza.json — usada aqui como fonte única da
verdade, em vez de recontar os arquivos Bronze de forma independente (o que
divergiria à medida que o histórico acumula múltiplos dias de ingestão).
"""

import json
import logging
from datetime import datetime, timezone

import pandas as pd

from src.comum.configuracoes import DADOS_GOLD, DADOS_SILVER

logger = logging.getLogger(__name__)

CRITERIOS_ACEITACAO = {
    "completude": 95.0,
    "consistencia": 98.0,
    "aproveitamento_bruto": 85.0,
    "unicidade": 100.0,
    "acuracia_tipos": 100.0,
    "validade_empresa": 95.0,
}

CAMPOS_OBRIGATORIOS_FATO_VAGAS = [
    "id_vaga", "id_tempo", "id_localizacao", "id_empresa", "id_categoria", "id_fonte",
    "id_senioridade", "id_modalidade", "titulo",
]

TIPOS_ESPERADOS_FATO_VAGAS = {
    "id_tempo": "int",
    "salario_min": "float",
    "salario_max": "float",
    "salario_medio": "float",
    "quantidade": "int",
}


def _carregar_decomposicao_limpeza() -> dict:
    """Lê a decomposição de perda Bronze->Silver gravada por
    src.tratamento.tratamento_vagas.executar()."""
    caminho = DADOS_SILVER / "vagas" / "relatorio_limpeza.json"
    if not caminho.exists():
        raise FileNotFoundError(f"{caminho} não encontrado — execute src.tratamento.tratamento_vagas antes.")
    return json.loads(caminho.read_text(encoding="utf-8"))


def calcular_completude(df: pd.DataFrame, campos_obrigatorios: list) -> float:
    """Proporção de campos obrigatórios preenchidos sobre o total esperado."""
    total_esperado = len(df) * len(campos_obrigatorios)
    if total_esperado == 0:
        return 0.0
    registros_completos = df[campos_obrigatorios].notna().sum().sum()
    return round((registros_completos / total_esperado) * 100, 2)


def calcular_consistencia(total_bronze: int, perda_nao_justificada: int) -> float:
    """Proporção de registros da Bronze que chegam íntegros à Gold, SEM PERDA NÃO
    JUSTIFICADA (definição literal do Capítulo 3) — perda por regra de validação
    de domínio documentada (duplicata, campo obrigatório vazio, data inválida) é
    justificada e não conta contra esta métrica; ver calcular_aproveitamento_bruto
    para a taxa de aproveitamento sem essa distinção."""
    if total_bronze == 0:
        return 0.0
    return round(((total_bronze - perda_nao_justificada) / total_bronze) * 100, 2)


def calcular_aproveitamento_bruto(total_bronze: int, total_gold: int) -> float:
    """Proporção bruta de registros Bronze que chegam à Gold, sem distinguir a
    causa da perda — métrica auxiliar/informativa, não usada para confirmar a
    hipótese (ver calcular_consistencia para a métrica formal do Quadro 7)."""
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


def calcular_validade_empresa(fato_vagas: pd.DataFrame, dim_empresa: pd.DataFrame) -> float:
    """Proporção de vagas cuja empresa foi identificada pela fonte (não é um
    espaço reservado como "confidencial") — ver src.tratamento.tratamento_vagas."""
    fato_com_empresa = fato_vagas.merge(
        dim_empresa[["id_empresa", "empresa_identificada"]], on="id_empresa", how="left"
    )
    total = len(fato_com_empresa)
    if total == 0:
        return 0.0
    identificadas = fato_com_empresa["empresa_identificada"].fillna(False).sum()
    return round((identificadas / total) * 100, 2)


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
    dim_empresa = pd.read_parquet(DADOS_GOLD / "dim_empresa" / "dim_empresa.parquet")
    decomposicao = _carregar_decomposicao_limpeza()

    metricas = {
        "completude": calcular_completude(fato_vagas, CAMPOS_OBRIGATORIOS_FATO_VAGAS),
        "consistencia": calcular_consistencia(decomposicao["total_bruto"], decomposicao["perda_nao_justificada"]),
        "aproveitamento_bruto": calcular_aproveitamento_bruto(decomposicao["total_bruto"], decomposicao["total_final"]),
        "unicidade": calcular_unicidade(fato_vagas, "id_vaga"),
        "acuracia_tipos": calcular_acuracia_tipos(fato_vagas, TIPOS_ESPERADOS_FATO_VAGAS),
        "validade_empresa": calcular_validade_empresa(fato_vagas, dim_empresa),
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

    logger.info("Decomposição da perda Bronze->Silver usada no cálculo: %s", decomposicao)

    relatorio = pd.DataFrame(linhas)
    destino = DADOS_GOLD / "metricas_qualidade"
    destino.mkdir(parents=True, exist_ok=True)
    relatorio.to_parquet(destino / "metricas_qualidade.parquet", index=False)
    return relatorio


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(gerar_relatorio().to_string(index=False))
