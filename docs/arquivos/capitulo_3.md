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

### 3.3.2 API Jooble — Vagas de Emprego Complementares

A API da Jooble é a segunda fonte de vagas do projeto, agregando anúncios de
múltiplos portais de emprego (ziprecruiter.com, appcast.io, lensa.com, entre
outros), o que amplia a cobertura e a diversidade de empresas anunciantes em
relação a uma única fonte. O acesso é gratuito, mediante cadastro e obtenção de
uma chave de API, com cota limitada de requisições.

O parâmetro de localização da API não filtra corretamente por Brasil (testes
com "Brasil", "Brazil", "BR" e nomes de cidade retornaram poucos ou nenhum
resultado), portanto a coleta é feita sem filtro geográfico, e cada vaga é
classificada como nacional ou internacional na camada Silver — por correspondência
de UF/município (IBGE) ou, na ausência desta, pela menção a "Brasil"/"Brazil" no
título ou na descrição da vaga (comum em vagas remotas anunciadas por agências
internacionais para candidatos no Brasil).

#### Quadro 3.1 — Endpoint da API Jooble utilizado

| Método | Endpoint | Retorno |
|---|---|---|
| POST | `/api/{chave}` | Lista de vagas por palavra-chave, paginada |

Fonte: Jooble (2026).

### 3.3.3 APIs de Vagas Remotas Complementares

Três fontes adicionais, todas com acesso público, gratuito e sem necessidade de
cadastro, ampliam a cobertura de vagas remotas de tecnologia: **RemoteOK**,
**Remotive** e **Arbeitnow**. As três são majoritariamente compostas por vagas
remotas/globais — por isso contribuem principalmente para os indicadores de
tecnologias, cargos e modalidade de trabalho, e menos para a distribuição
geográfica por UF (tratadas como "internacional" quando não é possível
identificar vínculo com o Brasil, seção 3.4.2).

#### Quadro 3.2 — Endpoints das APIs de vagas remotas utilizados

| Fonte | Método | Endpoint | Retorno |
|---|---|---|---|
| RemoteOK | GET | `/api` | Lista completa de vagas remotas mais recentes (sem paginação) |
| Remotive | GET | `/api/remote-jobs?category=software-dev` | Vagas remotas filtradas por categoria de tecnologia |
| Arbeitnow | GET | `/api/job-board-api?page={n}` | Lista paginada de vagas (europeu-focado, com sinalizador `remote`) |

Fonte: RemoteOK, Remotive e Arbeitnow (2026).

### 3.3.4 API IBGE — Dados Geográficos e Populacionais

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

A camada Bronze realiza a ingestão dos dados diretamente das APIs Adzuna, Jooble,
RemoteOK, Remotive, Arbeitnow e IBGE, sem nenhuma transformação. Os dados são
armazenados em formato JSON particionado por data de ingestão, preservando o
histórico completo e garantindo rastreabilidade total.

**Processo:**

1. DAG do Airflow dispara a coleta conforme agendamento configurado
2. Chamada HTTP às APIs via biblioteca `requests`
3. Adição de metadados de ingestão (`_data_ingestao`, `_origem`)
4. Gravação em formato JSON no diretório `dados/bronze/{fonte}/`

### 3.4.2 Camada Silver — Refinamento e Qualidade

A camada Silver aplica as regras de qualidade e padronização sobre os dados da camada
Bronze, unificando as cinco fontes de vagas em um esquema comum. Cada regra é
documentada e auditável.

**Transformações aplicadas:**

- Unificação das cinco fontes de vagas em um esquema comum, com chave de negócio
  prefixada por fonte (`adzuna_{id}`, `jooble_{id}`, `remoteok_{id}`, `remotive_{id}`,
  `arbeitnow_{slug}`) para garantir unicidade global
- Remoção de registros duplicados com base na chave de negócio
- Preenchimento ou exclusão de registros com campos obrigatórios nulos — inclui a
  normalização de campos "vazios" (string em branco), que não são detectados pela
  checagem padrão de valor nulo
- Validação de identidade da empresa: nomes que indicam que a fonte não revelou a
  empresa contratante (ex.: "confidencial") são normalizados para um rótulo único
  e explícito, e a vaga é marcada como `empresa_identificada = falso` — a vaga é
  mantida (ainda é um registro real de mercado), mas não contamina indicadores
  por empresa
- Deduplicação de empresas quase-idênticas por remoção determinística de sufixo
  societário (ex.: "Stefanini" e "Stefanini Group" tornam-se a mesma empresa) —
  normalização por regra, não por similaridade probabilística, para não arriscar
  unir empresas diferentes por engano
- Validação de domínio (salários não negativos; datas válidas — inclui a correção
  de formatos de data distintos entre as fontes e a conversão de timestamp Unix da
  Arbeitnow; descarte de datas-sentinela implausíveis, como "1970-01-01" retornada
  por registros sem data real)
- Normalização de strings (trim, minúsculas, remoção de espaços duplicados) e
  remoção de marcações HTML residuais (presentes nos textos da Jooble, RemoteOK e
  Remotive)
- Extração de habilidades técnicas a partir das descrições das vagas (mais de 100
  termos catalogados, entre linguagens, frameworks, bancos de dados, nuvem, dados/IA
  e metodologias), de forma insensível a acentuação
- Classificação do cargo/área de atuação (ex.: desenvolvimento, dados e analytics,
  infraestrutura e cloud, suporte técnico, mobile) a partir de palavras-chave no
  título da vaga — necessária porque nenhuma das fontes fornece uma categoria de
  cargo diretamente utilizável como dimensão analítica
- Classificação da senioridade (estágio/trainee, júnior, pleno, sênior,
  especialista) e da modalidade de trabalho (remoto, híbrido, presencial) a partir
  de palavras-chave no título/descrição, com sinalizadores estruturados da fonte
  (ex.: campo `remote` da Arbeitnow) tendo prioridade sobre a inferência textual
- Extração do número mínimo de anos de experiência exigido, quando mencionado
  explicitamente na descrição (expressão regular)
- Integração com dados geográficos do IBGE (município, UF, região e população
  estimada) e classificação de cada vaga como nacional ou internacional

Cada execução grava uma decomposição da perda entre a Bronze e a Silver por
causa (duplicata, campo obrigatório vazio, data inválida) em
`dados/silver/vagas/relatorio_limpeza.json`, distinguindo perda **justificada**
(por uma regra de validação documentada) de perda **não justificada** (que
indicaria um defeito no pipeline) — base do cálculo da métrica de consistência
(seção 3.7.1).

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
2013; seção 2.2.1): uma tabela fato central, com grão "uma vaga de TI publicada em
uma das cinco fontes", circundada por tabelas dimensão que fornecem contexto
descritivo. Uma tabela ponte resolve o relacionamento N:N entre vagas e
habilidades, e uma tabela de referência complementa o modelo com a distribuição
salarial agregada da própria Adzuna.

```
   dim_tempo   dim_localizacao   dim_senioridade   dim_modalidade
        \             |                 |                /
         \            |                 |               /
dim_empresa ────────────────── fato_vagas ────────────────── dim_categoria
                       |         |        \                        |
                       |         |         \                  dim_fonte
              ponte_vaga_habilidade    (nenhuma; benchmark é tabela de referência)
                       |
                       |
               dim_habilidade

  benchmark_salarial_categoria  (tabela de referência, independente do grão da fato)
```

### 3.5.1 Tabela fato: fato_vagas

| Coluna | Tipo | Descrição |
|---|---|---|
| id_vaga | STRING | Identificador único da vaga, prefixado por fonte (`adzuna_{id}`, `jooble_{id}`, `remoteok_{id}`, `remotive_{id}`, `arbeitnow_{slug}`) — grão da fato |
| id_tempo | INT | FK → dim_tempo (formato AAAAMMDD) |
| id_localizacao | INT | FK → dim_localizacao |
| id_empresa | INT | FK → dim_empresa |
| id_categoria | INT | FK → dim_categoria |
| id_fonte | INT | FK → dim_fonte |
| id_senioridade | INT | FK → dim_senioridade |
| id_modalidade | INT | FK → dim_modalidade |
| titulo | STRING | Título do cargo |
| salario_min | DECIMAL(10,2) | Salário mínimo anunciado (apenas Adzuna — ver seção 3.5.9) |
| salario_max | DECIMAL(10,2) | Salário máximo anunciado (apenas Adzuna) |
| salario_medio | DECIMAL(10,2) | Média entre salario_min e salario_max |
| anos_experiencia_min | INT | Anos mínimos de experiência exigidos, quando extraível da descrição (nulo caso contrário) |
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
| uf | STRING | Sigla do estado; `NI` = Brasil sem UF identificada; `XX` = internacional |
| nome_estado | STRING | Nome completo do estado, "Não informado" ou "Internacional" |
| regiao | STRING | Norte, Nordeste, Centro-Oeste, Sudeste, Sul, "Não informado" ou "Internacional" |
| pais | STRING | "Brasil" ou "Internacional" — permite filtrar vagas nacionais x internacionais |
| populacao | BIGINT | População estimada do estado (IBGE); nula para UF não identificada ou internacional |
| total_vagas | INT | Total de vagas associadas à localização |
| vagas_por_100k_hab | DECIMAL(8,2) | Vagas por 100 mil habitantes (apenas onde população é conhecida) |

### 3.5.4 Tabela dimensão: dim_empresa

Nomes de empresa quase-idênticos (ex.: "Stefanini" e "Stefanini Group") são
agrupados por remoção determinística de sufixo societário antes da geração da
chave substituta (seção 3.4.2), evitando que a mesma empresa apareça duplicada
no indicador "empresas com mais vagas".

| Coluna | Tipo | Descrição |
|---|---|---|
| id_empresa | INT | Chave substituta |
| nome_empresa | STRING | Nome da empresa anunciante (grafia mais frequente do grupo) |
| empresa_identificada | BOOLEAN | Falso quando a fonte não revelou o nome real (ex.: "confidencial") |
| cnpj | STRING | CNPJ, apenas para empresas com verificação manual (seção 3.5.4.1) |
| razao_social | STRING | Razão social oficial na Receita Federal, quando verificado |
| situacao_cadastral | STRING | Situação cadastral na Receita Federal (ex.: ATIVA), quando verificado |
| porte | STRING | Porte da empresa na Receita Federal, quando verificado |
| cnae_principal | STRING | Atividade econômica principal (CNAE), quando verificado |
| cnpj_verificado | BOOLEAN | Verdadeiro para as empresas com CNPJ validado manualmente |

#### 3.5.4.1 Verificação de CNPJ

Nenhuma das cinco fontes de vagas retorna CNPJ — apenas o nome da empresa em
texto livre — e não existe busca reversa gratuita "nome da empresa → CNPJ" em
escala nacional no Brasil, o que torna inviável validar automaticamente a
totalidade das empresas do dataset. Em vez disso, as empresas com maior volume
de vagas e identificação inequívoca tiveram o CNPJ pesquisado manualmente e
validado de forma real: verificação algorítmica dos dígitos verificadores e
consulta à base pública da Receita Federal via BrasilAPI, confirmando razão
social, situação cadastral ATIVA e CNAE compatível com a atividade anunciada
(ver src/comum/empresas_verificadas.py e src/comum/cliente_brasilapi.py). As
demais empresas permanecem no modelo com base apenas no nome informado pela
fonte, sem enriquecimento adicional — uma limitação documentada, não uma
lacuna oculta.

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

### 3.5.8 Tabela dimensão: dim_fonte

| Coluna | Tipo | Descrição |
|---|---|---|
| id_fonte | INT | Chave substituta |
| fonte | STRING | Sistema de ingestão: adzuna, jooble, remoteok, remotive ou arbeitnow |
| portal_origem | STRING | Portal de emprego original da vaga (ex.: ziprecruiter.com para vagas via Jooble); igual à `fonte` para as demais |

### 3.5.9 Tabela dimensão: dim_senioridade

| Coluna | Tipo | Descrição |
|---|---|---|
| id_senioridade | INT | Chave substituta |
| senioridade | STRING | Estágio/trainee, júnior, pleno, sênior, especialista ou "não informado" |
| ordem | INT | Ordinal para ordenação correta em visuais (0 a 4; -1 para "não informado") |

### 3.5.10 Tabela dimensão: dim_modalidade

| Coluna | Tipo | Descrição |
|---|---|---|
| id_modalidade | INT | Chave substituta |
| modalidade | STRING | Remoto, híbrido, presencial ou "não informado" |

### 3.5.11 Tabela de referência: benchmark_salarial_categoria

| Coluna | Tipo | Descrição |
|---|---|---|
| categoria | STRING | Categoria da Adzuna usada na coleta (`it-jobs`) |
| faixa_salarial_min | DECIMAL(10,2) | Valor mínimo da faixa salarial do histograma |
| quantidade_vagas | INT | Quantidade de vagas de TI nessa faixa, segundo a Adzuna |

Nota sobre salário: as medidas salariais (`salario_min`, `salario_max`,
`salario_medio` e o benchmark) usam exclusivamente dados da Adzuna, fonte 100%
brasileira com valores em Real (BRL). As demais fontes agregam vagas de múltiplos
países com moedas diferentes em um único campo de texto livre — convertê-las sem
detectar a moeda de origem produziria médias salariais incorretas, portanto
`salario_min`/`salario_max` ficam nulos para vagas dessas origens.

---

## 3.6 Orquestração com Apache Airflow

O Apache Airflow é responsável por automatizar, agendar e monitorar todos os pipelines
da plataforma. Cada camada da Arquitetura Medalhão possui uma DAG dedicada, garantindo
modularidade e rastreabilidade das execuções.

### 3.6.1 DAGs Implementadas

| DAG | Fonte | Periodicidade | Descrição |
|---|---|---|---|
| `dag_bronze_adzuna` | Adzuna API | Diária | Coleta de vagas e armazenamento em Bronze |
| `dag_bronze_jooble` | Jooble API | Semanal | Coleta de vagas complementares (cota limitada de requisições) |
| `dag_bronze_fontes_remotas` | RemoteOK, Remotive, Arbeitnow | Semanal | Coleta de vagas remotas complementares (3 fontes sem autenticação) |
| `dag_bronze_ibge` | IBGE API | Semanal | Coleta de dados geográficos e populacionais |
| `dag_silver_tratamento` | Bronze | Diária | Limpeza, padronização e integração |
| `dag_gold_analitico` | Silver | Diária | Geração do modelo dimensional e cálculo das métricas de qualidade |

As DAGs `dag_bronze_jooble` e `dag_bronze_fontes_remotas` não disparam
`dag_silver_tratamento` diretamente — seus arquivos ficam disponíveis para o
próximo processamento acionado por `dag_bronze_adzuna` (diária), evitando cargas
concorrentes da camada Silver no mesmo dia.

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
| Consistência | (total_bronze − perda_não_justificada) / total_bronze × 100 | ≥ 98% |
| Aproveitamento bruto | total_gold / total_bronze × 100 | ≥ 85% (auxiliar/informativa) |
| Unicidade | (total − duplicatas) / total × 100 | = 100% |
| Acurácia de tipos | campos_tipados_corretamente / total_campos × 100 | = 100% |
| Validade de empresa | vagas_com_empresa_identificada / total × 100 | ≥ 95% |

A fórmula de **consistência** opera literalmente sua própria definição — "sem
perda não justificada" — separando perda por regra de validação de domínio
documentada (duplicata, campo obrigatório vazio, data implausível: seção 3.4.2)
de qualquer perda inexplicada, que indicaria um defeito real no pipeline. A
métrica **aproveitamento bruto** complementa essa leitura sem misturar as duas
naturezas de perda: mostra a taxa bruta de registros que chegam à Gold,
independentemente da causa, servindo de indicador auxiliar de volume — não é
usada para confirmar a hipótese do trabalho (seção 1.3), apenas para
transparência sobre o quanto do dado bruto é efetivamente aproveitado.

As seis métricas são calculadas automaticamente pelo módulo `src/qualidade/metricas.py`,
executado como última tarefa da DAG `dag_gold_analitico` sobre a tabela `fato_vagas`
e a decomposição de perdas gravada pela camada Silver (`relatorio_limpeza.json`).
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

ARBEITNOW. **Job Board API**. Disponível em: <https://www.arbeitnow.com/api/job-board-api>.
Acesso em: 2026.

BRASILAPI. **API de CNPJ**. Disponível em: <https://brasilapi.com.br/docs#tag/CNPJ>.
Acesso em: 2026.

GIL, Antonio Carlos. **Como elaborar projetos de pesquisa**. 6. ed. São Paulo: Atlas,
2002.

IBGE — INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. **API IBGE Serviços**.
Disponível em: <https://servicodados.ibge.gov.br/api/docs>. Acesso em: 2024.

JOOBLE. **REST API Documentation**. Disponível em: <https://jooble.org/api/about>.
Acesso em: 2026.

KIMBALL, Ralph; ROSS, Margy. **The Data Warehouse Toolkit**. 3. ed. Indianapolis:
Wiley, 2013.

REMOTEOK. **RemoteOK API**. Disponível em: <https://remoteok.com/api>. Acesso em: 2026.

REMOTIVE. **Remote Jobs API**. Disponível em: <https://remotive.com/remote-jobs/api>.
Acesso em: 2026.

YIN, Robert K. **Estudo de caso: planejamento e métodos**. 5. ed. Porto Alegre:
Bookman, 2015.
