"""Camada Silver — limpeza, padronização e enriquecimento das vagas de TI.

Unifica cinco fontes de vagas do projeto (Adzuna, Jooble, RemoteOK, Remotive e
Arbeitnow) em um esquema comum.

Regras aplicadas (Capítulo 3, seção 3.4.2):
- remoção de registros duplicados por chave de negócio (id_vaga, já prefixado por fonte)
- exclusão de registros com campos obrigatórios nulos
- validação de domínio (datas válidas, salários não negativos)
- normalização de strings (trim, minúsculas, remoção de espaços duplicados)
- extração de habilidades técnicas a partir da descrição da vaga
- classificação do cargo, da modalidade de trabalho e da senioridade a partir do
  título/descrição da vaga (nenhuma fonte fornece essas três dimensões prontas e
  diretamente utilizáveis)

Observação sobre salário: apenas a Adzuna (fonte 100% Brasil, valores em BRL) é
usada nas medidas salariais. As demais fontes misturam vagas de múltiplos países
com moedas diferentes no mesmo campo de texto livre — converter tudo para o mesmo
número sem detectar a moeda geraria médias salariais incorretas, então
salario_min/salario_max ficam nulos para vagas das demais origens.
"""

import json
import logging
import re
import unicodedata
from datetime import datetime, timezone

import pandas as pd

from src.comum.configuracoes import DADOS_BRONZE, DADOS_SILVER

logger = logging.getLogger(__name__)

CAMPOS_OBRIGATORIOS = ["id_vaga", "titulo", "empresa", "data_publicacao"]

# Termos que indicam que a fonte não revelou o nome real da empresa contratante
# (levantados a partir de uma inspeção real dos dados coletados, não presumidos —
# nomes curtos como "IEL", "ABB", "G4S", "CGI" e "HP" são empresas reais e não
# entram aqui só por serem curtos).
TERMOS_EMPRESA_NAO_IDENTIFICADA = [
    "confidencial", "confidential", "nao informad", "não informad", "undisclosed",
    "anonimo", "anônimo", "anonima", "anônima", "a combinar", "empresa nao informada",
]
ROTULO_EMPRESA_NAO_IDENTIFICADA = "confidencial (não divulgada)"

# Habilidades técnicas reconhecidas nas descrições das vagas, agrupadas por área
# (o agrupamento em categoria_skill é feito em src/analitico/tabelas_gold.py).
HABILIDADES_CONHECIDAS = [
    # Linguagens de programação
    "python", "java", "javascript", "typescript", "php", "ruby", "golang", "go",
    "rust", "c#", "c++", "kotlin", "swift", "scala", "dart", "elixir", "abap", "delphi",
    # Frontend
    "react", "angular", "vue", "next.js", "nuxt", "svelte", "html", "css", "sass",
    "tailwind", "bootstrap", "jquery",
    # Backend / frameworks
    "node.js", "node", "express", "django", "flask", "fastapi", "spring boot", "spring",
    "laravel", "rails", ".net", "asp.net", "nestjs",
    # Mobile
    "android", "ios", "flutter", "react native", "xamarin",
    # Banco de dados
    "sql", "mysql", "postgresql", "postgres", "oracle", "sql server", "mongodb",
    "redis", "cassandra", "dynamodb", "elasticsearch", "firebase", "sqlite", "nosql",
    # Cloud / infraestrutura
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s", "terraform",
    "ansible", "jenkins", "gitlab ci", "github actions", "ci/cd", "linux", "nginx", "apache",
    # Dados / BI / IA
    "power bi", "tableau", "looker", "qlik", "spark", "pyspark", "hadoop", "airflow",
    "dbt", "kafka", "databricks", "snowflake", "machine learning", "deep learning",
    "data science", "etl", "big data", "inteligencia artificial",
    # Ferramentas gerais / metodologias
    "git", "github", "gitlab", "bitbucket", "jira", "confluence", "scrum", "kanban", "agile",
    # Segurança
    "cybersecurity", "pentest", "iso 27001", "firewall",
    # Testes
    "selenium", "cypress", "junit", "pytest", "tdd", "bdd",
    # ERP / CRM
    "sap", "salesforce", "totvs", "protheus", "dynamics",
]

# Classificação de cargo a partir de palavras-chave no título da vaga, avaliada em
# ordem — a primeira categoria cujo termo aparecer no título é atribuída à vaga.
# As palavras-chave são comparadas sem acentuação (ver _remover_acentos), por isso
# são escritas aqui já sem acentos.
CARGOS_POR_PALAVRA_CHAVE = [
    ("dados e analytics", [
        "dados", "data engineer", "data scientist", "data analyst", "analytics", "bi ",
        "business intelligence", "inteligencia de negocios", "inteligencia de dados",
        "inteligencia artificial", "machine learning", "cientista de dados",
    ]),
    ("infraestrutura e cloud", [
        "devops", "sre", "infraestrutura", "infra", "cloud", "redes", "sysadmin",
        "administrador de sistemas", "administrador de banco de dados", "dba", "network",
        "cloud engineer",
    ]),
    ("segurança da informação", ["seguranca", "security", "cyber", "soc ", "pentest"]),
    ("suporte técnico", [
        "suporte", "helpdesk", "help desk", "service desk", "atendimento tecnico",
        "tecnico de informatica", "tecnico de ti", "tecnico de instalacao", "tecnico de manutencao",
        "tecnico de telecomunicacoes", "field service",
    ]),
    ("qualidade e testes", ["qa ", "quality", "teste", "tester", "automacao de testes", "sdet"]),
    ("gestão de ti", [
        "gerente", "coordenador", "gestor", "head de", "lider tecnico", "tech lead",
        "lider de implantacao", "diretor de ti", " cio ", " cto ", "gerente de projetos", "pmo",
    ]),
    ("arquitetura de soluções", ["arquiteto", "architect"]),
    ("mobile", ["mobile", "android", "ios ", "flutter", "react native", "aplicativo"]),
    ("produto e agilidade", [
        "product owner", "scrum master", "produto", "product manager", "agile coach", "product analyst",
    ]),
    ("desenvolvimento", [
        "desenvolvedor", "developer", "programador", "engenheiro de software", "software engineer",
        "front-end", "frontend", "front end", "back-end", "backend", "back end", "full stack", "fullstack",
        "engenheiro de aplicacoes",
    ]),
    ("design de produto", ["designer", "ui/ux", "ux/ui", "design de produto"]),
    ("consultoria e sistemas erp", ["consultor sap", "consultor erp", "salesforce", "sap ", "erp "]),
]

# Classificação de senioridade — primeira correspondência no título vence.
SENIORIDADES_POR_PALAVRA_CHAVE = [
    ("estágio/trainee", 0, ["estagio", "estagiario", "trainee", "intern", "internship"]),
    ("júnior", 1, ["junior", " jr ", " jr.", "entry level", "entry-level"]),
    ("pleno", 2, ["pleno", "mid-level", "mid level", "intermediate"]),
    ("sênior", 3, ["senior", " sr ", " sr.", "sr.-"]),
    ("especialista", 4, ["especialista", "principal", "staff engineer", "expert"]),
]

# Classificação de modalidade — primeira correspondência no texto vence.
PALAVRAS_REMOTO = ["remoto", "remote", "home office", "trabalho remoto", "100% remoto", "work from home"]
PALAVRAS_HIBRIDO = ["hibrido", "híbrido", "hybrid"]
PALAVRAS_PRESENCIAL = ["presencial", "on-site", "onsite", "in-office", "in office"]

PADRAO_ANOS_EXPERIENCIA = re.compile(
    r"(\d{1,2})\s*\+?\s*(?:anos?|years?)\s+(?:de\s+)?(?:experi[eê]ncia|experience)"
)


def _normalizar_string(valor) -> str:
    if not isinstance(valor, str):
        return ""
    return re.sub(r"\s+", " ", valor).strip().lower()


def _remover_acentos(texto: str) -> str:
    """Remove acentuação para permitir comparação de palavras-chave insensível a acentos."""
    return "".join(caractere for caractere in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(caractere))


def _limpar_html(texto: str) -> str:
    """Remove marcações HTML simples (Jooble, RemoteOK e Remotive retornam texto com tags)."""
    if not isinstance(texto, str):
        return ""
    return re.sub(r"<[^>]+>", " ", texto)


def _texto_busca(*partes: str) -> str:
    """Concatena e normaliza (minúsculas, sem acento) campos de texto para busca de palavras-chave."""
    return _remover_acentos(_normalizar_string(" ".join(p or "" for p in partes)))


def _extrair_habilidades(descricao: str) -> list:
    texto = _remover_acentos(_normalizar_string(_limpar_html(descricao)))
    return sorted({habilidade for habilidade in HABILIDADES_CONHECIDAS if habilidade in texto})


def _classificar_cargo(titulo: str) -> str:
    texto = _remover_acentos(_normalizar_string(titulo))
    for cargo, palavras_chave in CARGOS_POR_PALAVRA_CHAVE:
        if any(palavra in texto for palavra in palavras_chave):
            return cargo
    return "outros"


def _classificar_senioridade(titulo: str) -> str:
    texto = f" {_remover_acentos(_normalizar_string(titulo))} "
    for nivel, _ordem, palavras_chave in SENIORIDADES_POR_PALAVRA_CHAVE:
        if any(palavra in texto for palavra in palavras_chave):
            return nivel
    return "não informado"


def _classificar_modalidade(texto_busca: str, forcar: str = None) -> str:
    """Classifica remoto/híbrido/presencial. `forcar` sobrepõe a busca por palavra-chave
    quando a fonte já garante a modalidade por definição (ex.: RemoteOK é 100% remoto)
    ou fornece um sinal estruturado (ex.: campo booleano `remote` da Arbeitnow)."""
    if forcar is not None:
        return forcar
    if any(p in texto_busca for p in PALAVRAS_HIBRIDO):
        return "híbrido"
    if any(p in texto_busca for p in PALAVRAS_REMOTO):
        return "remoto"
    if any(p in texto_busca for p in PALAVRAS_PRESENCIAL):
        return "presencial"
    return "não informado"


def _epoch_para_iso(valor) -> str:
    """Converte timestamp Unix (segundos, como a Arbeitnow retorna em `created_at`)
    para string ISO 8601. Sem isso, o valor numérico é interpretado incorretamente
    pelo parser de datas (produz datas próximas à época Unix zero, 1970-01-01)."""
    if valor is None:
        return None
    try:
        return datetime.fromtimestamp(int(valor), tz=timezone.utc).isoformat()
    except (ValueError, TypeError, OSError):
        return None


def _extrair_anos_experiencia(descricao: str):
    texto = _remover_acentos(_normalizar_string(_limpar_html(descricao)))
    correspondencia = PADRAO_ANOS_EXPERIENCIA.search(texto)
    return int(correspondencia.group(1)) if correspondencia else None


def _validar_nome_empresa(nome: str) -> tuple:
    """Verifica se o nome de empresa retornado pela fonte identifica de fato uma
    empresa (em vez de um espaço reservado como "confidencial"). Retorna
    (nome_normalizado, empresa_identificada)."""
    texto = _remover_acentos(_normalizar_string(nome))
    if any(termo in texto for termo in TERMOS_EMPRESA_NAO_IDENTIFICADA):
        return ROTULO_EMPRESA_NAO_IDENTIFICADA, False
    return nome, True


def _carregar_adzuna() -> pd.DataFrame:
    registros = []
    diretorio = DADOS_BRONZE / "adzuna"
    for arquivo in diretorio.glob("*/vagas_pagina_*.json"):
        registros.extend(json.loads(arquivo.read_text(encoding="utf-8")))

    if not registros:
        logger.warning("Nenhum arquivo de vagas da Adzuna encontrado em %s", diretorio)
        return pd.DataFrame()

    linhas = []
    for registro in registros:
        localizacao = registro.get("location", {}) or {}
        categoria = registro.get("category", {}) or {}
        empresa = registro.get("company", {}) or {}
        titulo = _normalizar_string(registro.get("title"))
        descricao = registro.get("description", "")
        texto_busca = _texto_busca(titulo, descricao)
        linhas.append(
            {
                "id_vaga": f"adzuna_{registro.get('id')}",
                "titulo": titulo,
                "empresa": _normalizar_string(empresa.get("display_name")),
                "localizacao_bruta": localizacao.get("display_name"),
                "salario_min": registro.get("salary_min"),
                "salario_max": registro.get("salary_max"),
                "data_publicacao": registro.get("created"),
                "categoria_adzuna": _normalizar_string(categoria.get("label")),
                "categoria": _classificar_cargo(titulo),
                "senioridade": _classificar_senioridade(titulo),
                "modalidade": _classificar_modalidade(texto_busca),
                "anos_experiencia_min": _extrair_anos_experiencia(descricao),
                "descricao": descricao,
                "habilidades": _extrair_habilidades(descricao),
                "fonte": "adzuna",
                "portal_origem": "adzuna",
            }
        )

    return pd.DataFrame(linhas)


def _carregar_jooble() -> pd.DataFrame:
    registros = []
    diretorio = DADOS_BRONZE / "jooble"
    for arquivo in diretorio.glob("*/vagas_*.json"):
        registros.extend(json.loads(arquivo.read_text(encoding="utf-8")))

    if not registros:
        logger.warning("Nenhum arquivo de vagas da Jooble encontrado em %s", diretorio)
        return pd.DataFrame()

    linhas = []
    for registro in registros:
        titulo = _normalizar_string(registro.get("title"))
        descricao = _limpar_html(registro.get("snippet", ""))
        texto_busca = _texto_busca(titulo, descricao, registro.get("location"))
        linhas.append(
            {
                "id_vaga": f"jooble_{registro.get('id')}",
                "titulo": titulo,
                "empresa": _normalizar_string(registro.get("company")),
                "localizacao_bruta": registro.get("location"),
                "salario_min": float("nan"),
                "salario_max": float("nan"),
                "data_publicacao": registro.get("updated"),
                "categoria_adzuna": None,
                "categoria": _classificar_cargo(titulo),
                "senioridade": _classificar_senioridade(titulo),
                "modalidade": _classificar_modalidade(texto_busca),
                "anos_experiencia_min": _extrair_anos_experiencia(descricao),
                "descricao": descricao,
                "habilidades": _extrair_habilidades(descricao),
                "fonte": "jooble",
                "portal_origem": _normalizar_string(registro.get("source")) or "jooble",
            }
        )

    return pd.DataFrame(linhas)


def _carregar_remoteok() -> pd.DataFrame:
    registros = []
    diretorio = DADOS_BRONZE / "remoteok"
    for arquivo in diretorio.glob("*/vagas.json"):
        registros.extend(json.loads(arquivo.read_text(encoding="utf-8")))

    if not registros:
        logger.warning("Nenhum arquivo de vagas da RemoteOK encontrado em %s", diretorio)
        return pd.DataFrame()

    linhas = []
    for registro in registros:
        if not registro.get("id"):
            continue
        titulo = _normalizar_string(registro.get("position"))
        descricao = _limpar_html(registro.get("description", ""))
        linhas.append(
            {
                "id_vaga": f"remoteok_{registro.get('id')}",
                "titulo": titulo,
                "empresa": _normalizar_string(registro.get("company")),
                "localizacao_bruta": registro.get("location"),
                "salario_min": float("nan"),
                "salario_max": float("nan"),
                "data_publicacao": registro.get("date"),
                "categoria_adzuna": None,
                "categoria": _classificar_cargo(titulo),
                "senioridade": _classificar_senioridade(titulo),
                "modalidade": "remoto",  # RemoteOK é 100% vagas remotas, por definição do site
                "anos_experiencia_min": _extrair_anos_experiencia(descricao),
                "descricao": descricao,
                "habilidades": _extrair_habilidades(descricao),
                "fonte": "remoteok",
                "portal_origem": "remoteok",
            }
        )

    return pd.DataFrame(linhas)


def _carregar_remotive() -> pd.DataFrame:
    registros = []
    diretorio = DADOS_BRONZE / "remotive"
    for arquivo in diretorio.glob("*/vagas.json"):
        registros.extend(json.loads(arquivo.read_text(encoding="utf-8")))

    if not registros:
        logger.warning("Nenhum arquivo de vagas da Remotive encontrado em %s", diretorio)
        return pd.DataFrame()

    linhas = []
    for registro in registros:
        titulo = _normalizar_string(registro.get("title"))
        descricao = _limpar_html(registro.get("description", ""))
        linhas.append(
            {
                "id_vaga": f"remotive_{registro.get('id')}",
                "titulo": titulo,
                "empresa": _normalizar_string(registro.get("company_name")),
                "localizacao_bruta": registro.get("candidate_required_location"),
                "salario_min": float("nan"),
                "salario_max": float("nan"),
                "data_publicacao": registro.get("publication_date"),
                "categoria_adzuna": None,
                "categoria": _classificar_cargo(titulo),
                "senioridade": _classificar_senioridade(titulo),
                "modalidade": "remoto",  # Remotive é 100% vagas remotas, por definição do site
                "anos_experiencia_min": _extrair_anos_experiencia(descricao),
                "descricao": descricao,
                "habilidades": _extrair_habilidades(descricao),
                "fonte": "remotive",
                "portal_origem": "remotive",
            }
        )

    return pd.DataFrame(linhas)


def _carregar_arbeitnow() -> pd.DataFrame:
    registros = []
    diretorio = DADOS_BRONZE / "arbeitnow"
    for arquivo in diretorio.glob("*/vagas_pagina_*.json"):
        registros.extend(json.loads(arquivo.read_text(encoding="utf-8")))

    if not registros:
        logger.warning("Nenhum arquivo de vagas da Arbeitnow encontrado em %s", diretorio)
        return pd.DataFrame()

    linhas = []
    for registro in registros:
        titulo = _normalizar_string(registro.get("title"))
        descricao = _limpar_html(registro.get("description", ""))
        eh_remoto = registro.get("remote")
        texto_busca = _texto_busca(titulo, descricao)
        if eh_remoto is True:
            modalidade = "remoto"
        elif eh_remoto is False and any(p in texto_busca for p in PALAVRAS_HIBRIDO):
            modalidade = "híbrido"
        elif eh_remoto is False:
            modalidade = "presencial"
        else:
            modalidade = _classificar_modalidade(texto_busca)
        linhas.append(
            {
                "id_vaga": f"arbeitnow_{registro.get('slug')}",
                "titulo": titulo,
                "empresa": _normalizar_string(registro.get("company_name")),
                "localizacao_bruta": registro.get("location"),
                "salario_min": float("nan"),
                "salario_max": float("nan"),
                "data_publicacao": _epoch_para_iso(registro.get("created_at")),
                "categoria_adzuna": None,
                "categoria": _classificar_cargo(titulo),
                "senioridade": _classificar_senioridade(titulo),
                "modalidade": modalidade,
                "anos_experiencia_min": _extrair_anos_experiencia(descricao),
                "descricao": descricao,
                "habilidades": _extrair_habilidades(descricao),
                "fonte": "arbeitnow",
                "portal_origem": "arbeitnow",
            }
        )

    return pd.DataFrame(linhas)


def executar() -> pd.DataFrame:
    """Executa o tratamento Silver das vagas (todas as fontes) e grava o resultado em Parquet."""
    carregadores = (
        _carregar_adzuna, _carregar_jooble, _carregar_remoteok, _carregar_remotive, _carregar_arbeitnow,
    )
    partes = [df for carregar in carregadores if not (df := carregar()).empty]
    if not partes:
        logger.warning("Nenhuma vaga encontrada em nenhuma fonte.")
        return pd.DataFrame()

    df = pd.concat(partes, ignore_index=True)

    # Decomposição da perda entre Bronze e Silver, por causa — para que a métrica
    # de consistência (Capítulo 3, Quadro 7) possa distinguir perda JUSTIFICADA
    # (regra de validação de domínio documentada) de perda não justificada (que
    # indicaria um defeito real no pipeline). Ver src/qualidade/metricas.py.
    total_bruto = len(df)
    decomposicao = {"total_bruto": total_bruto}

    df = df.drop_duplicates(subset="id_vaga")
    decomposicao["duplicatas"] = total_bruto - len(df)

    # Campo obrigatório "vazio" (string em branco) não é pego por dropna — só NaN é.
    # Sem essa normalização, vagas sem nome de empresa nenhum entram como se fossem
    # uma "empresa" válida (observado: 114 vagas com empresa == "").
    df["empresa"] = df["empresa"].replace(r"^\s*$", pd.NA, regex=True)
    antes_campos_obrigatorios = len(df)
    df = df.dropna(subset=CAMPOS_OBRIGATORIOS)
    decomposicao["campos_obrigatorios_vazios"] = antes_campos_obrigatorios - len(df)

    # Validação de identidade da empresa: nomes como "confidencial" não são um
    # campo vazio (a fonte respondeu algo), mas também não identificam uma empresa
    # real — mantém a vaga (ainda é um dado real de mercado: cargo, salário,
    # habilidades), mas marca explicitamente para não contaminar indicadores por
    # empresa (ex.: "empresas com mais vagas"). Não é uma perda: a vaga permanece.
    validacao_empresa = df["empresa"].apply(_validar_nome_empresa)
    df["empresa"] = validacao_empresa.apply(lambda par: par[0])
    df["empresa_identificada"] = validacao_empresa.apply(lambda par: par[1])
    decomposicao["empresa_nao_identificada_mas_mantida"] = int((~df["empresa_identificada"]).sum())
    if decomposicao["empresa_nao_identificada_mas_mantida"]:
        logger.info(
            "%s vaga(s) com empresa não identificada pela fonte (ex.: \"confidencial\") — mantidas, só marcadas.",
            decomposicao["empresa_nao_identificada_mas_mantida"],
        )

    # format="mixed": as fontes retornam formatos de data diferentes na mesma
    # coluna (ex.: "2026-07-03T07:04:53Z" vs "2026-07-06T00:00:00.0000000") — sem
    # isso, o pandas trava no formato do primeiro valor e descarta os demais como NaT.
    df["data_publicacao"] = pd.to_datetime(df["data_publicacao"], errors="coerce", format="mixed", utc=True)
    antes_data_valida = len(df)
    df = df.dropna(subset=["data_publicacao"])
    decomposicao["data_nao_interpretavel"] = antes_data_valida - len(df)

    # Validação de domínio: algumas fontes retornam data-sentinela em vez de nula
    # quando o valor real está ausente (observado na Arbeitnow: "1970-01-01T00:00:01",
    # época Unix zero). Datas fora de uma janela plausível são descartadas.
    antes_validacao_data = len(df)
    agora = pd.Timestamp.now(tz="UTC")
    df = df[(df["data_publicacao"] >= pd.Timestamp("2020-01-01", tz="UTC")) & (df["data_publicacao"] <= agora + pd.Timedelta(days=1))]
    decomposicao["data_implausivel"] = antes_validacao_data - len(df)
    if decomposicao["data_implausivel"]:
        logger.warning(
            "%s registro(s) descartado(s) por data de publicação implausível (fora de 2020-01-01..hoje)",
            decomposicao["data_implausivel"],
        )

    # Datas de vaga não precisam de precisão sub-segundo; arredondar evita erro do
    # PyArrow ao gravar Parquet (timestamp[ns] com resíduo de nanossegundos não
    # cabe em timestamp[us] sem perda, e o PyArrow recusa o cast silencioso).
    df["data_publicacao"] = df["data_publicacao"].dt.floor("s")

    for coluna_salario in ["salario_min", "salario_max"]:
        df[coluna_salario] = pd.to_numeric(df[coluna_salario], errors="coerce")
        df.loc[df[coluna_salario] < 0, coluna_salario] = pd.NA

    decomposicao["total_final"] = len(df)
    decomposicao["perda_total"] = total_bruto - len(df)
    decomposicao["perda_justificada"] = (
        decomposicao["duplicatas"] + decomposicao["campos_obrigatorios_vazios"]
        + decomposicao["data_nao_interpretavel"] + decomposicao["data_implausivel"]
    )
    decomposicao["perda_nao_justificada"] = decomposicao["perda_total"] - decomposicao["perda_justificada"]

    logger.info("Tratamento Silver de vagas: %s -> %s registros", total_bruto, len(df))
    logger.info("Decomposição da perda Bronze->Silver: %s", decomposicao)
    logger.info("Por fonte: %s", df["fonte"].value_counts().to_dict())
    logger.info("Distribuição de cargos: %s", df["categoria"].value_counts().to_dict())
    logger.info("Distribuição de modalidade: %s", df["modalidade"].value_counts().to_dict())
    logger.info("Distribuição de senioridade: %s", df["senioridade"].value_counts().to_dict())

    destino = DADOS_SILVER / "vagas"
    destino.mkdir(parents=True, exist_ok=True)
    df.to_parquet(destino / "vagas.parquet", index=False)
    (destino / "relatorio_limpeza.json").write_text(json.dumps(decomposicao, indent=2), encoding="utf-8")
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    executar()
