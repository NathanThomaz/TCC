# Capítulo 3 — Metodologia

## 3.1 Classificação da Pesquisa

Do ponto de vista de sua natureza, este trabalho configura-se como uma **pesquisa
aplicada**, pois objetiva a geração de conhecimento voltado à solução de um problema
prático e concreto: a construção de uma plataforma de Engenharia de Dados funcional
para inteligência de mercado de trabalho em tecnologia (GIL, 2002). Quanto aos seus
objetivos, classifica-se como **exploratório-descritiva**: exploratória pela relativa
escassez de estudos aplicados que combinem Arquitetura Medalhão, orquestração com
Airflow e integração de múltiplas APIs públicas no domínio de mercado de trabalho;
descritiva por registrar sistematicamente as características do pipeline implementado
e seus resultados mensuráveis.

Em relação à abordagem do problema, a pesquisa é **mista (quali-quantitativa)**: adota
instrumentos quantitativos para coleta e análise de métricas de qualidade de dados e
de desempenho dos pipelines, e abordagem qualitativa para avaliação da adequação da
arquitetura proposta ao problema de inteligência de mercado. Quanto ao procedimento
técnico, enquadra-se como **estudo de caso experimental**, pois implementa um sistema de
software completo — desde a extração das APIs até a camada analítica — e avalia seus
resultados em condições controladas (YIN, 2015).

---

## 3.2 Ambiente de Desenvolvimento

A implementação deste trabalho é realizada em ambiente local, com as seguintes
especificações de hardware e software:

**Hardware:**

- Sistema Operacional: Microsoft Windows 11 Pro
- Processador: compatível com execução de containers Docker
- Memória RAM: mínimo 8 GB

**Software e versões:**

| Ferramenta | Versão | Finalidade |
|---|---|---|
| Python | 3.11 | Linguagem principal do projeto |
| Apache Airflow | 2.9 | Orquestração dos pipelines |
| Pandas | 2.2 | Manipulação de dados tabulares |
| Requests | 2.31 | Consumo das APIs externas |
| Docker | 26+ | Execução do ambiente Airflow |
| Power BI Desktop | Versão atual | Camada de visualização analítica |
| API Adzuna | v1 | Fonte de vagas de emprego |
| API IBGE | v3 | Fonte de dados geográficos e populacionais |

O Apache Airflow é executado via **Docker Compose**, utilizando a imagem oficial da
Apache, o que garante portabilidade e reprodutibilidade do ambiente de desenvolvimento.

---

## 3.3 Fontes de Dados

O projeto utiliza APIs públicas como fontes primárias de dados, permitindo a integração
de diferentes contextos de informação sobre o mercado de trabalho em tecnologia.

### 3.3.1 API Adzuna — Vagas de Emprego

A API da Adzuna é a principal fonte de dados do projeto, fornecendo informações sobre
vagas de emprego publicadas no mercado, incluindo cargos, empresas, localizações,
descrições e informações salariais quando disponíveis. O acesso é realizado mediante
cadastro e obtenção de chave de API (`app_id` e `app_key`). A coleta é restrita à
categoria `it-jobs` ("Vagas em Tecnologia Informática") da própria taxonomia da
Adzuna, garantindo que o conjunto de dados analisado corresponda especificamente ao
mercado de trabalho em tecnologia, foco deste trabalho.

#### Quadro 3 — Endpoints da API Adzuna utilizados

| Método | Endpoint | Retorno |
|---|---|---|
| GET | `/api/v1/{country}/search/{page}` | Lista de vagas com paginação |
| GET | `/api/v1/{country}/categories` | Categorias de vagas disponíveis |
| GET | `/api/v1/{country}/histogram` | Distribuição salarial por categoria |

Fonte: Adzuna (2024).

### 3.3.2 API IBGE — Dados Geográficos e Populacionais

Os serviços do IBGE fornecem dados complementares sobre estados, municípios, regiões e
indicadores populacionais, enriquecendo as análises geográficas e permitindo
correlacionar o volume de vagas com a população de cada localidade.

#### Quadro 4 — Endpoints da API IBGE utilizados

| Método | Endpoint | Retorno |
|---|---|---|
| GET | `/api/v1/localidades/estados` | Lista de estados brasileiros |
| GET | `/api/v1/localidades/regioes` | Lista de macrorregiões |
| GET | `/api/v1/localidades/estados/{uf}/municipios` | Municípios de uma UF |
| GET | `/api/v3/agregados/6579/periodos/-1/variaveis/9324` | População estimada (por estado e por município) |

Fonte: IBGE (2024).

---

## 3.4 Arquitetura do Pipeline de Dados

O pipeline de dados é implementado seguindo o padrão de três camadas da Arquitetura
Medalhão, orquestrado pelo Apache Airflow por meio de DAGs dedicadas para cada fonte
de dados.

### 3.4.1 Camada Bronze — Ingestão Bruta

A camada Bronze realiza a ingestão dos dados diretamente das APIs Adzuna e IBGE, sem
nenhuma transformação. Os dados são armazenados em formato JSON particionado por data
de ingestão, preservando o histórico completo e garantindo rastreabilidade total.

**Processo:**

1. DAG do Airflow dispara a coleta conforme agendamento configurado
2. Chamada HTTP às APIs via biblioteca `requests`
3. Adição de metadados de ingestão (`_data_ingestao`, `_origem`)
4. Gravação em formato JSON no diretório `dados/bronze/{fonte}/`

### 3.4.2 Camada Silver — Refinamento e Qualidade

A camada Silver aplica as regras de qualidade e padronização sobre os dados da camada
Bronze. Cada regra é documentada e auditável.

**Transformações aplicadas:**

- Remoção de registros duplicados com base em chave de negócio
- Preenchimento ou exclusão de registros com campos obrigatórios nulos
- Validação de domínio (salários não negativos, datas válidas)
- Normalização de strings (trim, minúsculas, remoção de espaços duplicados)
- Extração de habilidades técnicas a partir das descrições das vagas, de forma
  insensível a acentuação
- Classificação do cargo/área de atuação (ex.: desenvolvimento, dados e analytics,
  infraestrutura e cloud, suporte técnico) a partir de palavras-chave no título da
  vaga — necessária porque a categoria bruta da Adzuna é constante após o filtro
  por `it-jobs`, não servindo isoladamente como dimensão analítica
- Integração com dados geográficos do IBGE (município, UF, região e população
  estimada)

**Saída:** tabelas em formato Parquet em `dados/silver/{fonte}/`

### 3.4.3 Camada Gold — Modelo Dimensional

A camada Gold organiza os dados refinados da camada Silver em um modelo dimensional
(Star Schema, seção 2.2.1) otimizado para consumo pelo Power BI, respondendo
diretamente aos indicadores de mercado de trabalho definidos na hipótese.

**Processo:**

1. Leitura das tabelas Silver já geolocalizadas
2. Geração das chaves substitutas (surrogate keys) e construção das dimensões
3. Construção da tabela fato, referenciando as dimensões pelas chaves substitutas
4. Gravação em formato Parquet em `dados/gold/{tabela}/`
5. Cálculo automático das métricas de qualidade (seção 3.7.1) sobre a tabela fato
6. Conexão do Power BI Desktop às pastas de Parquet

---

## 3.5 Modelo Dimensional — Camada Gold

O modelo implementado na camada Gold segue o padrão Star Schema (KIMBALL; ROSS,
2013; seção 2.2.1): uma tabela fato central, com grão "uma vaga de TI publicada na
Adzuna", circundada por tabelas dimensão que fornecem contexto descritivo. Uma tabela
ponte resolve o relacionamento N:N entre vagas e habilidades, e uma tabela de
referência complementa o modelo com a distribuição salarial agregada da própria
Adzuna.

```
        dim_tempo        dim_localizacao
             \                  /
              \                /
  dim_empresa —— fato_vagas —— dim_categoria
              /                \
             /                  \
  ponte_vaga_habilidade ——— dim_habilidade

  benchmark_salarial_categoria  (tabela de referência, independente do grão da fato)
```

### 3.5.1 Tabela fato: fato_vagas

| Coluna | Tipo | Descrição |
|---|---|---|
| id_vaga | STRING | Identificador único da vaga (Adzuna) — grão da fato |
| id_tempo | INT | FK → dim_tempo (formato AAAAMMDD) |
| id_localizacao | INT | FK → dim_localizacao |
| id_empresa | INT | FK → dim_empresa |
| id_categoria | INT | FK → dim_categoria |
| titulo | STRING | Título do cargo |
| salario_min | DECIMAL(10,2) | Salário mínimo anunciado |
| salario_max | DECIMAL(10,2) | Salário máximo anunciado |
| salario_medio | DECIMAL(10,2) | Média entre salario_min e salario_max |
| quantidade | INT | Medida aditiva de contagem (valor fixo 1, soma-se para contar vagas) |

### 3.5.2 Tabela dimensão: dim_tempo

| Coluna | Tipo | Descrição |
|---|---|---|
| id_tempo | INT | Chave substituta (AAAAMMDD) |
| data | DATE | Data de publicação da vaga |
| ano | INT | Ano |
| mes | INT | Mês (1–12) |
| nome_mes | STRING | Nome do mês por extenso |
| trimestre | INT | Trimestre (1–4) |
| ano_mes | STRING | Período no formato AAAA-MM |

### 3.5.3 Tabela dimensão: dim_localizacao

| Coluna | Tipo | Descrição |
|---|---|---|
| id_localizacao | INT | Chave substituta |
| municipio | STRING | Município da vaga (quando identificado) |
| uf | STRING | Sigla do estado |
| nome_estado | STRING | Nome completo do estado |
| regiao | STRING | Norte, Nordeste, Centro-Oeste, Sudeste, Sul |
| populacao | BIGINT | População estimada do estado (IBGE) |
| total_vagas | INT | Total de vagas associadas à localização |
| vagas_por_100k_hab | DECIMAL(8,2) | Vagas por 100 mil habitantes |

### 3.5.4 Tabela dimensão: dim_empresa

| Coluna | Tipo | Descrição |
|---|---|---|
| id_empresa | INT | Chave substituta |
| nome_empresa | STRING | Nome da empresa anunciante |

### 3.5.5 Tabela dimensão: dim_categoria

| Coluna | Tipo | Descrição |
|---|---|---|
| id_categoria | INT | Chave substituta |
| categoria | STRING | Cargo/área de atuação classificado a partir do título |

### 3.5.6 Tabela dimensão: dim_habilidade

| Coluna | Tipo | Descrição |
|---|---|---|
| id_habilidade | INT | Chave substituta |
| habilidade | STRING | Nome da tecnologia ou habilidade |
| categoria_skill | STRING | Linguagem, banco de dados, cloud, ferramenta, framework, metodologia, disciplina |

### 3.5.7 Tabela ponte: ponte_vaga_habilidade

| Coluna | Tipo | Descrição |
|---|---|---|
| id_vaga | STRING | FK → fato_vagas |
| id_habilidade | INT | FK → dim_habilidade |

### 3.5.8 Tabela de referência: benchmark_salarial_categoria

| Coluna | Tipo | Descrição |
|---|---|---|
| categoria | STRING | Categoria da Adzuna usada na coleta (`it-jobs`) |
| faixa_salarial_min | DECIMAL(10,2) | Valor mínimo da faixa salarial do histograma |
| quantidade_vagas | INT | Quantidade de vagas de TI nessa faixa, segundo a Adzuna |

---

## 3.6 Orquestração com Apache Airflow

O Apache Airflow é responsável por automatizar, agendar e monitorar todos os pipelines
da plataforma. Cada camada da Arquitetura Medalhão possui uma DAG dedicada, garantindo
modularidade e rastreabilidade das execuções.

### 3.6.1 DAGs Implementadas

| DAG | Fonte | Periodicidade | Descrição |
|---|---|---|---|
| `dag_bronze_adzuna` | Adzuna API | Diária | Coleta de vagas e armazenamento em Bronze |
| `dag_bronze_ibge` | IBGE API | Semanal | Coleta de dados geográficos e populacionais |
| `dag_silver_tratamento` | Bronze | Diária | Limpeza, padronização e integração |
| `dag_gold_analitico` | Silver | Diária | Geração do modelo dimensional e cálculo das métricas de qualidade |

### 3.6.2 Mecanismos de Controle

Cada DAG implementa os seguintes mecanismos de controle de qualidade e resiliência:

- **Retentativas automáticas:** até 3 tentativas com intervalo de 5 minutos em caso de
  falha de conexão com as APIs
- **Alertas por e-mail:** notificação automática ao responsável em caso de falha
  persistente
- **Logs de execução:** registros detalhados de cada task armazenados pelo Airflow Web UI
- **Dependências explícitas:** a DAG Silver só é executada após sucesso confirmado da
  DAG Bronze

---

## 3.7 Protocolo de Avaliação

A avaliação da plataforma proposta será conduzida por meio de métricas objetivas,
aplicadas em duas dimensões: qualidade dos dados e capacidade analítica.

### 3.7.1 Métricas de Qualidade de Dados

| Métrica | Fórmula | Critério de Aceitação |
|---|---|---|
| Completude | registros_completos / total_esperado × 100 | ≥ 95% |
| Consistência | registros_íntegros / total_bronze × 100 | ≥ 98% |
| Unicidade | (total − duplicatas) / total × 100 | = 100% |
| Acurácia de tipos | campos_tipados_corretamente / total_campos × 100 | = 100% |

As quatro métricas são calculadas automaticamente pelo módulo `src/qualidade/metricas.py`,
executado como última tarefa da DAG `dag_gold_analitico` sobre a tabela `fato_vagas`.
O resultado é gravado como tabela Gold (`metricas_qualidade`), permitindo tanto a
auditoria pelo Airflow Web UI quanto o acompanhamento histórico no próprio Power BI.

### 3.7.2 Métricas de Capacidade Analítica

A capacidade analítica é avaliada pela capacidade do pipeline de responder a, no
mínimo, cinco indicadores de mercado de trabalho em tecnologia:

1. **Evolução do volume de vagas ao longo do tempo** (mensal/trimestral)
2. **Distribuição geográfica das oportunidades** por UF e região
3. **Empresas com maior volume de vagas publicadas**
4. **Tecnologias e habilidades mais demandadas** (top skills extraídas das descrições)
5. **Indicadores salariais por cargo e região** (quando disponível)

Cada indicador é implementado como uma visualização no Power BI conectada à camada
Gold. Um indicador é considerado **válido** quando: (a) atualiza automaticamente após
execução do pipeline; (b) os valores são coerentes com os dados originais das APIs
(verificação por amostragem); e (c) o painel produz resultado em tempo adequado para
uso interativo no Power BI Desktop.

---

## 3.8 Cronograma de Execução

O desenvolvimento do trabalho está organizado nas seguintes etapas:

| Etapa | Atividade | Período |
|---|---|---|
| 1 | Revisão bibliográfica e fundamentação teórica | Março 2026 |
| 2 | Configuração do ambiente e autenticação nas APIs | Março 2026 |
| 3 | Implementação das DAGs Bronze (Adzuna e IBGE) | Abril 2026 |
| 4 | Implementação da camada Silver (limpeza e integração) | Abril 2026 |
| 5 | Implementação da camada Gold (modelo analítico) | Maio 2026 |
| 6 | Configuração da orquestração completa no Airflow | Maio 2026 |
| 7 | Desenvolvimento do painel Power BI | Junho 2026 |
| 8 | Coleta e análise das métricas de avaliação | Junho 2026 |
| 9 | Redação dos capítulos de resultados e conclusões | Julho 2026 |
| 10 | Revisão final e entrega do TCC | Agosto 2026 |

---

## Referências

ADZUNA. **API Documentation**. Disponível em: <https://developer.adzuna.com>. Acesso em:
2024.

GIL, Antonio Carlos. **Como elaborar projetos de pesquisa**. 6. ed. São Paulo: Atlas,
2002.

IBGE — INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. **API IBGE Serviços**.
Disponível em: <https://servicodados.ibge.gov.br/api/docs>. Acesso em: 2024.

YIN, Robert K. **Estudo de caso: planejamento e métodos**. 5. ed. Porto Alegre:
Bookman, 2015.
