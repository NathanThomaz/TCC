# TCC — Plataforma de Inteligência de Mercado de Trabalho em Tecnologia

**Instituição:** Centro Universitário La Salle (Unilasalle)
**Autor:** Nathan Thomaz
**Curso:** Sistemas de Informação

---

## Sobre o Projeto

Este trabalho propõe a concepção e implementação de uma plataforma de inteligência de
mercado de trabalho para profissionais de tecnologia, baseada na Arquitetura Medalhão
(Bronze, Silver e Gold), com orquestração automatizada por Apache Airflow e visualização
analítica via Microsoft Power BI. As vagas vêm de cinco fontes públicas — **Adzuna**
(restrita à categoria de TI, `it-jobs`), **Jooble** (agregador de múltiplos portais),
**RemoteOK**, **Remotive** e **Arbeitnow** (vagas remotas/globais) — enriquecidas com
dados geográficos e populacionais do **IBGE**, integradas em um pipeline de Engenharia
de Dados desenvolvido inteiramente em Python.

**Pergunta de pesquisa:**
Como projetar e implementar uma plataforma de Engenharia de Dados capaz de coletar,
integrar e disponibilizar informações de múltiplas APIs públicas sobre o mercado de
trabalho em tecnologia, aplicando a Arquitetura Medalhão com orquestração via Apache
Airflow, de forma a produzir análises estratégicas confiáveis e auditáveis?

Documentação completa dos capítulos do TCC em [`docs/arquivos/`](docs/arquivos/), e o
mapa de fontes/arquitetura para expansões futuras em
[`projeto/documentacao/ARQUITETURA_EXPANSAO_DADOS.md`](projeto/documentacao/ARQUITETURA_EXPANSAO_DADOS.md).

---

## Tecnologias

- **Python 3.11** — linguagem única do pipeline
- **Apache Airflow 2.9** — orquestração das DAGs (via Docker Compose)
- **pandas / pyarrow** — tratamento tabular e gravação em Parquet
- **requests** — consumo das APIs Adzuna, Jooble, RemoteOK, Remotive, Arbeitnow e IBGE
- **Power BI** — visualização e dashboard analítico da camada Gold

---

## Estrutura do Repositório

O repositório separa a **documentação acadêmica** (`docs/`) da **implementação do
pipeline** (`projeto/`):

```text
TCC/
├── docs/
│   ├── arquivos/          Capítulos do TCC (Markdown, DOCX, PDF)
│   ├── referencias/       Material de apoio (PDFs das aulas, não versionados)
│   └── templates/         Templates institucionais
│
└── projeto/
    ├── dags/               DAGs do Airflow (uma por etapa do pipeline)
    │   ├── dag_bronze_adzuna.py
    │   ├── dag_bronze_jooble.py
    │   ├── dag_bronze_fontes_remotas.py
    │   ├── dag_bronze_ibge.py
    │   ├── dag_silver_tratamento.py
    │   └── dag_gold_analitico.py
    │
    ├── src/
    │   ├── comum/           Configurações compartilhadas, normalização de empresa,
    │   │                     cliente BrasilAPI e lista de empresas verificadas por CNPJ
    │   ├── ingestao/        Camada Bronze — clientes HTTP e ingestão bruta (6 fontes)
    │   ├── tratamento/      Camada Silver — unificação de fontes, validação de
    │   │                     empresa, classificação e geolocalização
    │   ├── analitico/       Camada Gold — construção do modelo dimensional (fato + dimensões)
    │   └── qualidade/       Métricas de qualidade de dados (completude, consistência,
    │                         aproveitamento bruto, unicidade, acurácia, validade de empresa)
    │
    ├── dados/               Dados por camada (não versionados — ver .gitignore)
    │   ├── bronze/{adzuna,jooble,remoteok,remotive,arbeitnow,ibge}/
    │   ├── silver/{vagas,localidades}/
    │   └── gold/
    │       ├── fato_vagas/, dim_tempo/, dim_localizacao/, dim_empresa/, dim_categoria/,
    │       │   dim_habilidade/, dim_fonte/, dim_senioridade/, dim_modalidade/
    │       ├── ponte_vaga_habilidade/
    │       ├── benchmark_salarial_categoria/
    │       └── metricas_qualidade/
    │
    ├── documentacao/
    │   └── ARQUITETURA_EXPANSAO_DADOS.md   Catálogo de fontes e roteiro de expansão
    ├── painel/
    │   └── GUIA_POWER_BI.md                Roteiro de conexão do Power BI ao modelo Gold
    │
    ├── docker-compose.yml   Ambiente do Apache Airflow (webserver, scheduler, Postgres)
    ├── requirements.txt
    ├── .env.exemplo         Modelo de variáveis de ambiente (chaves de API etc.)
    ├── iniciar.bat          Sobe o Docker Desktop (se preciso) e o Airflow, e abre o navegador
    └── parar.bat            Encerra os containers, preservando dados e histórico
```

---

## Arquitetura

```text
API Adzuna (vagas de TI)      ──┐
API Jooble (multi-portais)    ──┤
API RemoteOK (remoto)         ──┼──►  [ BRONZE ]  Ingestão bruta em JSON, particionada por data
API Remotive (remoto)         ──┤
API Arbeitnow (remoto/Europa) ──┘
API IBGE (geo/pop)            ──►             │
                                               ▼
                                      [ SILVER ]  Unificação de fontes, classificação de cargo,
                                                   senioridade e modalidade, geolocalização e
                                                   escopo nacional/internacional
                                               │
                                               ▼
                                       [ GOLD ]  Modelo dimensional (Star Schema) em Parquet
                                               │
                                               ▼
                                    Power BI Dashboard
```

**Modelo dimensional — camada Gold (Star Schema):**

- `fato_vagas` — uma linha por vaga (grão), com FKs para as dimensões e as medidas de salário/experiência
- `dim_tempo` — calendário de publicação (ano, mês, trimestre)
- `dim_localizacao` — município, UF, região, escopo nacional/internacional e população estimada (IBGE)
- `dim_empresa` — empresas anunciantes; nomes quase-idênticos deduplicados por sufixo
  societário, nomes não identificados ("confidencial" etc.) marcados explicitamente, e
  as principais empresas com CNPJ validado de verdade na Receita Federal via BrasilAPI
- `dim_categoria` — cargo/área classificado a partir do título da vaga
- `dim_habilidade` — habilidades técnicas catalogadas, por grupo (100+ termos reconhecidos)
- `dim_fonte` — sistema de ingestão e portal de origem da vaga
- `dim_senioridade` — estágio/trainee, júnior, pleno, sênior, especialista
- `dim_modalidade` — remoto, híbrido, presencial
- `ponte_vaga_habilidade` — relação N:N entre vagas e habilidades
- `benchmark_salarial_categoria` — distribuição salarial de referência (histograma da Adzuna)
- `metricas_qualidade` — completude, consistência, aproveitamento bruto, unicidade,
  acurácia de tipos e validade de empresa, calculadas a cada execução

Orquestração via Airflow: `dag_bronze_adzuna` (diária) alimenta a camada Bronze e dispara
`dag_silver_tratamento`, que por sua vez dispara `dag_gold_analitico` (constrói o modelo
dimensional e calcula as métricas de qualidade). `dag_bronze_jooble`, `dag_bronze_fontes_remotas`
e `dag_bronze_ibge` rodam semanalmente e de forma independente — seus dados são incorporados
na próxima execução diária da Silver, sem disparar cargas concorrentes.

---

## Qualidade e Confiabilidade dos Dados

Nenhum dado é descartado silenciosamente. A cada execução, a camada Silver grava uma
decomposição completa da perda entre Bronze e Gold por causa (duplicata, campo
obrigatório vazio, data implausível) em `dados/silver/vagas/relatorio_limpeza.json`,
distinguindo perda **justificada** (por uma regra de validação documentada) de perda
**não justificada** (que indicaria um defeito real no pipeline).

Tratativas aplicadas especificamente para garantir que a camada Gold reflita empresas
reais:

- Vagas sem nome de empresa nenhum (campo vazio na fonte) são excluídas — um bug real
  encontrado e corrigido durante o desenvolvimento (114 vagas estavam sendo contadas
  como "empresa" válida antes da correção).
- Nomes como "confidencial" são normalizados para um rótulo único e explícito, e a
  vaga é marcada como `empresa_identificada = falso` — mantida (ainda é um dado real
  de mercado), mas não conta como uma empresa distinta nos indicadores.
- Grafias quase-idênticas do mesmo nome ("Stefanini" / "Stefanini Group") são
  agrupadas por remoção determinística de sufixo societário — não por similaridade
  probabilística, para não arriscar unir empresas diferentes por engano.
- As empresas com maior volume de vagas têm **CNPJ validado de verdade** junto à
  Receita Federal (dígitos verificadores + consulta via BrasilAPI, confirmando razão
  social, situação cadastral ATIVA e CNAE compatível) — ver
  `src/comum/empresas_verificadas.py`. Nenhuma das cinco fontes de vagas retorna CNPJ
  na origem, então validar automaticamente todas as ~1.000+ empresas do dataset não é
  tecnicamente possível hoje; isso é documentado como limitação, não escondido.

---

## Como Executar

1. Copie `projeto/.env.exemplo` para `projeto/.env` e preencha as chaves das APIs:
   - `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` — cadastro gratuito em [developer.adzuna.com](https://developer.adzuna.com)
   - `JOOBLE_API_KEY` — cadastro gratuito em [jooble.org/api/about](https://jooble.org/api/about) (cota de 500 requisições)
   - RemoteOK, Remotive, Arbeitnow e IBGE não exigem chave
2. Dê duplo-clique em **`projeto/iniciar.bat`** (ou rode `iniciar.bat` a partir de
   `projeto/`). O script:
   - verifica se o Docker Desktop está aberto e o abre automaticamente se não estiver;
   - inicializa o banco do Airflow (idempotente — seguro rodar sempre);
   - sobe o webserver e o scheduler em segundo plano;
   - abre o navegador em `http://localhost:8080` (usuário/senha: `admin`/`admin`).
3. Ative as DAGs `dag_bronze_adzuna`, `dag_bronze_jooble`, `dag_bronze_fontes_remotas` e
   `dag_bronze_ibge` na interface — a cascata Silver → Gold dispara sozinha depois disso.
4. Os dados tratados ficam disponíveis em `projeto/dados/gold/` para conexão
   do Power BI Desktop (pasta de arquivos Parquet).
5. Para encerrar tudo, rode **`projeto/parar.bat`** (os dados e o banco do Airflow são
   preservados; só os containers são derrubados).

Prefere rodar os comandos manualmente? A partir de `projeto/`:

```
docker compose up airflow-init
docker compose up -d airflow-webserver airflow-scheduler
docker compose down   # para encerrar
```

Para rodar os módulos isoladamente, fora do Airflow (a partir de `projeto/`, com
`pip install -r requirements.txt`):
```text
python -m src.ingestao.ingestao_adzuna
python -m src.ingestao.ingestao_jooble
python -m src.ingestao.ingestao_remoteok
python -m src.ingestao.ingestao_remotive
python -m src.ingestao.ingestao_arbeitnow
python -m src.ingestao.ingestao_ibge
python -m src.tratamento.tratamento_vagas
python -m src.tratamento.tratamento_localidades
python -m src.analitico.tabelas_gold
python -m src.qualidade.metricas
```

---

## Progresso do TCC

| Etapa | Status |
|---|---|
| Capítulo 1 — Introdução | Concluído |
| Capítulo 2 — Referencial Teórico | Concluído |
| Capítulo 3 — Metodologia | Concluído |
| Estrutura do pipeline (Bronze/Silver/Gold) | Concluído |
| Ingestão Bronze (Adzuna + Jooble + RemoteOK + Remotive + Arbeitnow + IBGE) | Validado com dados reais |
| Tratamento Silver (unificação de 5 fontes, cargo, senioridade, modalidade, geolocalização) | Validado com dados reais |
| Modelo dimensional Gold (fato + 8 dimensões, empresas deduplicadas e validadas por CNPJ) | Validado com dados reais |
| Métricas de qualidade (completude, consistência, aproveitamento bruto, unicidade, acurácia, validade de empresa) | Validado — todas as 6 acima do critério de aceitação |
| Orquestração completa no Airflow | Validado (6 DAGs carregando sem erro no Docker Compose) |
| Dashboard Power BI | Pendente |
| Capítulo 4 — Resultados | Pendente |
| Capítulo 5 — Conclusão | Pendente |
