# TCC — Plataforma de Inteligência de Mercado de Trabalho em Tecnologia

**Instituição:** Centro Universitário La Salle (Unilasalle)
**Autor:** Nathan Thomaz
**Curso:** Sistemas de Informação

---

## Sobre o Projeto

Este trabalho propõe a concepção e implementação de uma plataforma de inteligência de
mercado de trabalho para profissionais de tecnologia, baseada na Arquitetura Medalhão
(Bronze, Silver e Gold), com orquestração automatizada por Apache Airflow e visualização
analítica via Microsoft Power BI. A fonte de vagas é a API pública da **Adzuna**,
restrita à categoria de Tecnologia da Informação (`it-jobs`), enriquecida com dados
geográficos e populacionais do **IBGE**, integrados em um pipeline de Engenharia de
Dados desenvolvido inteiramente em Python.

**Pergunta de pesquisa:**
Como projetar e implementar uma plataforma de Engenharia de Dados capaz de coletar,
integrar e disponibilizar informações de múltiplas APIs públicas sobre o mercado de
trabalho em tecnologia, aplicando a Arquitetura Medalhão com orquestração via Apache
Airflow, de forma a produzir análises estratégicas confiáveis e auditáveis?

Documentação completa dos capítulos do TCC em [`docs/arquivos/`](docs/arquivos/).

---

## Tecnologias

- **Python 3.11** — linguagem única do pipeline
- **Apache Airflow 2.9** — orquestração das DAGs (via Docker Compose)
- **pandas / pyarrow** — tratamento tabular e gravação em Parquet
- **requests** — consumo das APIs Adzuna e IBGE
- **Power BI** — visualização e dashboard analítico da camada Gold

---

## Estrutura do Repositório

O repositório separa a **documentação acadêmica** (`docs/`) da **implementação do
pipeline** (`projeto/`):

```
TCC/
├── docs/
│   ├── arquivos/          Capítulos do TCC (Markdown, DOCX, PDF)
│   ├── referencias/       Material de apoio (PDFs das aulas, não versionados)
│   └── templates/         Templates institucionais
│
└── projeto/
    ├── dags/               DAGs do Airflow (uma por etapa do pipeline)
    │   ├── dag_bronze_adzuna.py
    │   ├── dag_bronze_ibge.py
    │   ├── dag_silver_tratamento.py
    │   └── dag_gold_analitico.py
    │
    ├── src/
    │   ├── comum/           Configurações e variáveis de ambiente compartilhadas
    │   ├── ingestao/        Camada Bronze — clientes HTTP e ingestão bruta (Adzuna, IBGE)
    │   ├── tratamento/      Camada Silver — limpeza, classificação e integração geográfica
    │   ├── analitico/       Camada Gold — construção do modelo dimensional (fato + dimensões)
    │   └── qualidade/       Métricas de qualidade de dados (completude, consistência, unicidade, acurácia)
    │
    ├── dados/               Dados por camada (não versionados — ver .gitignore)
    │   ├── bronze/{adzuna,ibge}/
    │   ├── silver/{vagas,localidades}/
    │   └── gold/
    │       ├── fato_vagas/, dim_tempo/, dim_localizacao/, dim_empresa/, dim_categoria/, dim_habilidade/
    │       ├── ponte_vaga_habilidade/
    │       ├── benchmark_salarial_categoria/
    │       └── metricas_qualidade/
    │
    ├── docker-compose.yml   Ambiente do Apache Airflow (webserver, scheduler, Postgres)
    ├── requirements.txt
    ├── .env.exemplo         Modelo de variáveis de ambiente (chaves de API etc.)
    ├── iniciar.bat          Sobe o Docker Desktop (se preciso) e o Airflow, e abre o navegador
    └── parar.bat            Encerra os containers, preservando dados e histórico
```

O painel Power BI (`.pbix`) será adicionado em `projeto/painel/` quando o desenvolvimento
do dashboard for iniciado.

---

## Arquitetura

```
API Adzuna (vagas de TI)  ──┐
                             ├──►  [ BRONZE ]  Ingestão bruta em JSON, particionada por data
API IBGE (geo/pop)        ──┘             │
                                           ▼
                                  [ SILVER ]  Limpeza, classificação de cargo e integração geográfica
                                           │
                                           ▼
                                   [ GOLD ]  Modelo dimensional (Star Schema) em Parquet
                                           │
                                           ▼
                                Power BI Dashboard
```

**Modelo dimensional — camada Gold (Star Schema):**

- `fato_vagas` — uma linha por vaga (grão), com FKs para as dimensões e as medidas de salário
- `dim_tempo` — calendário de publicação (ano, mês, trimestre)
- `dim_localizacao` — município, UF, região e população estimada (IBGE)
- `dim_empresa` — empresas anunciantes
- `dim_categoria` — cargo/área classificado a partir do título da vaga
- `dim_habilidade` — habilidades técnicas catalogadas, por grupo
- `ponte_vaga_habilidade` — relação N:N entre vagas e habilidades
- `benchmark_salarial_categoria` — distribuição salarial de referência (histograma da Adzuna)
- `metricas_qualidade` — completude, consistência, unicidade e acurácia de tipos de cada execução

Orquestração via Airflow: `dag_bronze_adzuna` (diária) e `dag_bronze_ibge` (semanal)
alimentam a camada Bronze; ao concluir, `dag_bronze_adzuna` dispara `dag_silver_tratamento`,
que por sua vez dispara `dag_gold_analitico` (constrói o modelo dimensional e calcula as
métricas de qualidade).

---

## Como Executar

1. Copie `projeto/.env.exemplo` para `projeto/.env` e preencha `ADZUNA_APP_ID` e
   `ADZUNA_APP_KEY` (cadastro gratuito em [developer.adzuna.com](https://developer.adzuna.com)).
2. Dê duplo-clique em **`projeto/iniciar.bat`** (ou rode `iniciar.bat` a partir de
   `projeto/`). O script:
   - verifica se o Docker Desktop está aberto e o abre automaticamente se não estiver;
   - inicializa o banco do Airflow (idempotente — seguro rodar sempre);
   - sobe o webserver e o scheduler em segundo plano;
   - abre o navegador em `http://localhost:8080` (usuário/senha: `admin`/`admin`).
3. Ative as DAGs `dag_bronze_adzuna` e `dag_bronze_ibge` na interface — a cascata
   Silver → Gold dispara sozinha depois disso.
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
```
python -m src.ingestao.ingestao_adzuna
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
| Ingestão Bronze (Adzuna filtrada por TI, e IBGE) | Validado com dados reais |
| Tratamento Silver (classificação de cargo, geolocalização) | Validado com dados reais (~70% das vagas geolocalizadas) |
| Modelo dimensional Gold (fato + dimensões) | Validado com dados reais |
| Métricas de qualidade (completude, consistência, unicidade, acurácia) | Validado — 100% em todas as métricas na amostra coletada |
| Orquestração completa no Airflow | Validado (DAGs carregando sem erro no Docker Compose) |
| Dashboard Power BI | Pendente |
| Capítulo 4 — Resultados | Pendente |
| Capítulo 5 — Conclusão | Pendente |
