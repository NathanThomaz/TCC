# Capítulo 2 — Referencial Teórico

## 2.1 Big Data: Conceito e Características

O termo Big Data designa conjuntos de dados cuja dimensão, complexidade e velocidade de
geração superam a capacidade dos sistemas de gerenciamento de dados convencionais para
captura, armazenamento, gestão e análise (CHEN; MAO; LIU, 2014). A popularização do
conceito remonta ao trabalho de Laney (2001), que caracterizou o fenômeno por três
dimensões fundamentais — volume, velocidade e variedade —, modelo posteriormente
expandido para incluir veracidade e valor, compondo o que a literatura denomina os
cinco Vs do Big Data.

O **volume** refere-se à quantidade massiva de dados gerados continuamente por dispositivos,
transações e interações digitais. A **velocidade** diz respeito à taxa de geração e ao tempo
exigido para processamento e resposta. A **variedade** abrange a multiplicidade de formatos
e fontes, incluindo dados estruturados, semiestruturados (JSON, XML) e não estruturados
(imagens, vídeos, texto livre). A **veracidade** concerne à incerteza e à qualidade inerente
aos dados em grande escala, enquanto o **valor** refere-se à capacidade de extrair
inteligência útil para a tomada de decisão organizacional (CHEN; MAO; LIU, 2014).

No contexto do mercado de trabalho em tecnologia, todas essas dimensões se manifestam de
forma intensa: plataformas de vagas geram grandes volumes de anúncios, descrições de
cargos, dados salariais e localizações provenientes de múltiplas fontes heterogêneas,
exigindo infraestruturas de dados capazes de ingerir, armazenar e processar esse fluxo
contínuo com confiabilidade e rastreabilidade (LANEY, 2001; CHEN; MAO; LIU, 2014).

---

## 2.2 Arquiteturas de Armazenamento e Processamento de Dados

### 2.2.1 Data Warehouse

O Data Warehouse (Armazém de Dados) é definido por Inmon (2002) como um conjunto de
dados orientado por assunto, integrado, variante no tempo e não volátil, projetado para
suporte à tomada de decisão gerencial. Nessa abordagem, os dados são extraídos de sistemas
transacionais, transformados para um formato padronizado e carregados em um repositório
centralizado — processo denominado ETL (Extração, Transformação e Carga).

A modelagem de dados no Data Warehouse é fundamentada nos princípios de Kimball e Ross
(2013), que propõem a organização dos dados em esquemas dimensionais — notadamente o
Star Schema (Esquema Estrela) e o Snowflake Schema —, estruturas otimizadas para
consultas analíticas de alto desempenho. O Star Schema organiza os dados em uma tabela
fato central, que registra métricas de negócio mensuráveis, circundada por tabelas
dimensão que fornecem contexto descritivo às métricas (KIMBALL; ROSS, 2013).

Os Data Warehouses tradicionais apresentam vantagens reconhecidas: garantias de qualidade
e consistência dos dados, desempenho elevado em consultas analíticas e maturidade
tecnológica consolidada. Contudo, suas limitações tornam-se evidentes em cenários de Big
Data: o esquema rígido definido na ingestão dificulta a adaptação a novas fontes de dados,
a escalabilidade predominantemente vertical impõe custos crescentes, e a separação entre
dados brutos e processados cria silos que dificultam a rastreabilidade
(INMON, 2002; STONEBRAKER; ÇETINTEMEL, 2005).

Soluções modernas de Data Warehouse em nuvem — como Snowflake, Google BigQuery e Amazon
Redshift — mitigaram parte dessas limitações por meio de escalabilidade elástica e modelos
de custo por uso. No entanto, introduzem dependência de fornecedor, custos significativos
para armazenamento de dados brutos e semiestruturados, e integração limitada com fluxos
de aprendizado de máquina e processamento em tempo real (DRECHSLER; SAUER, 2023).

### 2.2.2 Data Lake

O Data Lake (Lago de Dados) surgiu como resposta às limitações dos Data Warehouses
tradicionais diante da explosão de volumes e variedades de dados. Conceitualmente, é
um repositório centralizado que armazena dados em seu formato nativo e bruto —
estruturados, semiestruturados e não estruturados —, sem a necessidade de definição de
esquema no momento da ingestão. Essa abordagem, denominada schema-on-read, posterga a
definição da estrutura para o momento do consumo, conferindo máxima flexibilidade
(FANG, 2015).

As principais vantagens do Data Lake incluem o custo reduzido de armazenamento em
sistemas de arquivos distribuídos, a capacidade de preservar dados brutos para
reprocessamento futuro e a flexibilidade para acomodar diferentes tipos de carga
analítica, incluindo processamento em lote, em tempo real e aprendizado de máquina.
Entretanto, sem governança, processos de qualidade e controle de acesso adequados,
os Data Lakes tendem a se degradar em repositórios de dados desorganizados, sem
catalogação e de difícil consumo analítico — fenômeno conhecido como pântano de dados.
Essa deterioração decorre da ausência de garantias transacionais, da falta de
versionamento e da dificuldade em aplicar atualizações e exclusões em arquivos
imutáveis (FANG, 2015; ZAHARIA et al., 2021).

### 2.2.3 Arquitetura Medalhão

A Arquitetura Medalhão (Medallion Architecture) é um padrão de design amplamente adotado
em projetos de Engenharia de Dados modernos para organizar o fluxo de dados em estágios
progressivos de refinamento e qualidade. O modelo estrutura o ambiente de dados em três
camadas denominadas Bronze, Silver e Gold, cada uma com responsabilidades bem definidas
no processo de transformação e disponibilização da informação (DATABRICKS, 2023).

Ao contrário de abordagens que tentam transformar os dados já no momento da ingestão,
a Arquitetura Medalhão adota o princípio de preservar os dados brutos e aplicar
transformações incrementais e documentáveis em cada estágio. Essa abordagem garante
rastreabilidade completa, facilita reprocessamentos e perm ite auditar cada decisão de
transformação aplicada ao longo do pipeline (DATABRICKS, 2023).

### 2.2.4 Quadro Comparativo das Arquiteturas

O Quadro 1 sintetiza as principais características das três arquiteturas discutidas,
permitindo a visualização objetiva das diferenças e complementaridades entre elas.

#### Quadro 1 — Comparativo entre Data Warehouse, Data Lake e Arquitetura Medalhão

| Característica | Data Warehouse | Data Lake | Arq. Medalhão |
| --- | --- | --- | --- |
| Definição de esquema | Na ingestão (schema-on-write) | No consumo (schema-on-read) | Por camada (progressivo) |
| Tipos de dados suportados | Estruturados | Todos | Todos |
| Transformações | Em estágio único (ETL) | Ausentes ou ad hoc | Incrementais e documentáveis |
| Custo de armazenamento | Alto | Baixo | Baixo |
| Escalabilidade | Vertical | Horizontal | Horizontal |
| Desempenho analítico | Alto | Variável | Alto (camada Gold) |
| Rastreabilidade | Limitada | Limitada | Nativa (por camada) |
| Orquestração | Ferramentas ETL | Variada | Apache Airflow |
| Governança de dados | Madura | Imattura | Progressiva por camada |

Fonte: elaborado pelo autor.

---

## 2.3 Arquitetura em Camadas: Bronze, Silver e Gold

A organização dos dados em camadas é um padrão arquitetural amplamente adotado em
projetos de Engenharia de Dados moderna. O modelo de três camadas — Bronze, Silver e
Gold — estrutura o fluxo de dados de acordo com seu grau de refinamento e propósito de
uso, permitindo que cada estágio seja claramente definido, monitorado e auditado
(DATABRICKS, 2023).

A **camada Bronze** recebe os dados em seu estado bruto, diretamente das fontes de origem,
sem transformações. Neste projeto, os dados brutos das APIs da Adzuna e do IBGE são
armazenados nessa camada em formato JSON, preservando o histórico completo das
extrações e possibilitando reprocessamentos futuros sem dependência das fontes externas.

A **camada Silver** representa a fase de refinamento dos dados. Nela são aplicados processos
de limpeza, padronização de formatos, remoção de duplicatas, validação de integridade,
enriquecimento com informações complementares e integração entre as diferentes fontes.
Também são aplicadas técnicas de extração de informações das descrições das vagas,
permitindo identificar tecnologias e competências exigidas pelo mercado.

A **camada Gold** é a camada analítica da arquitetura. Os dados, já tratados e validados,
são organizados em modelos orientados a indicadores de mercado de trabalho, com foco
na geração de informações estratégicas e na alimentação dos dashboards no Power BI.
Essa separação em camadas promove isolamento de falhas, controle de qualidade progressivo
e rastreabilidade completa do ciclo de vida dos dados.

---

## 2.4 Engenharia de Dados e Pipelines de Transformação

A Engenharia de Dados é a disciplina responsável pelo projeto, construção e manutenção
de infraestruturas e pipelines que permitem a coleta, o armazenamento, o processamento
e a disponibilização de dados para consumo analítico e científico (VASSILIADIS, 2009).
No contexto de arquiteturas modernas, dois paradigmas de transformação de dados se
destacam: ETL e ELT.

No modelo tradicional **ETL** (Extração, Transformação e Carga), os dados são extraídos
das fontes, transformados em um ambiente intermediário e somente então carregados no
destino analítico. Esse modelo é adequado quando o sistema de destino tem capacidade de
armazenamento limitada ou quando a transformação requer lógica complexa que não pode ser
executada no ambiente de destino.

No modelo **ELT** (Extração, Carga e Transformação), predominante em arquiteturas modernas
de Big Data, os dados são primeiramente carregados no sistema de destino em seu formato
bruto e transformados posteriormente, aproveitando a capacidade de processamento
distribuído do próprio ambiente analítico (VASSILIADIS, 2009). Esse modelo é natural na
Arquitetura Medalhão, onde a camada Bronze recebe os dados brutos e as transformações
são aplicadas progressivamente nas camadas Silver e Gold.

---

## 2.5 Orquestração de Pipelines com Apache Airflow

A orquestração de pipelines de dados refere-se à coordenação automatizada das etapas de
processamento, garantindo que cada tarefa seja executada na ordem correta, no momento
adequado e com tratamento apropriado de dependências e falhas. Em arquiteturas modernas
de Engenharia de Dados, a orquestração é considerada um componente crítico para a
confiabilidade e observabilidade dos pipelines (HARENSLAK; RUITER, 2021).

O Apache Airflow é uma plataforma de orquestração de workflows de código aberto,
originalmente desenvolvida pelo Airbnb e posteriormente incorporada à Apache Software
Foundation. Sua principal abstração é o conceito de **DAG** (Directed Acyclic Graph —
Grafo Acíclico Dirigido), que representa um conjunto de tarefas e suas dependências de
execução. Cada tarefa dentro de uma DAG pode representar desde uma chamada a uma API
até uma transformação de dados ou uma carga em banco de dados (APACHE AIRFLOW, 2024).

As principais funcionalidades do Apache Airflow relevantes para este projeto são:

- **Agendamento:** permite definir cronogramas de execução baseados em expressões cron
  ou intervalos de tempo, automatizando a extração periódica das APIs.
- **Controle de dependências:** garante que a camada Silver só processe dados após a
  concluisão bem-sucedida da ingestão Bronze, e assim sucessivamente.
- **Monitoramento e logs:** o painel web do Airflow permite visualizar o status de cada
  execução, identificar falhas e acessar logs detalhados por tarefa.
- **Reprocessamento:** em caso de falha, o Airflow permite reexecutar apenas as tarefas
  afetadas, sem necessidade de reprocessar todo o pipeline.
- **Integração nativa com Python:** todas as tarefas são definidas em Python, facilitando
  a integração com bibliotecas de processamento de dados e chamadas a APIs externas.

---

## 2.6 Qualidade e Governança de Dados

A qualidade de dados é um atributo multidimensional que reflete o grau em que um conjunto
de dados atende aos requisitos de uso para os quais foi coletado ou produzido. Vassiliadis
(2009) identifica as principais dimensões de qualidade relevantes para sistemas analíticos:

- **Completude:** proporção de valores preenchidos em relação aos esperados, sem campos
  nulos onde são obrigatórios.
- **Consistência:** ausência de contradições entre registros, seja dentro de uma mesma
  tabela ou entre tabelas relacionadas.
- **Acurácia:** conformidade dos valores registrados com os valores reais que representam.
- **Unicidade:** ausência de registros duplicados que possam distorcer análises.
- **Pontualidade:** disponibilidade dos dados no momento em que são necessários para a
  tomada de decisão.

Na Arquitetura Medalhão, a qualidade de dados é gerenciada progressivamente entre as
camadas: na camada Bronze, os dados são ingeridos sem filtros, preservando o histórico;
na camada Silver, são aplicadas regras de validação e limpeza; na camada Gold, os dados
atendem a um padrão de qualidade estabelecido para consumo analítico (DATABRICKS, 2023).

A **governança de dados** complementa a qualidade ao definir políticas, processos e
responsabilidades para o gerenciamento dos dados ao longo de seu ciclo de vida. Neste
projeto, a governança é implementada por meio de: controle de versões dos pipelines,
registro de logs de execução no Airflow, documentação das regras de transformação
aplicadas em cada camada e monitoramento de indicadores operacionais dos pipelines.

---

## 2.7 Ferramentas e Tecnologias

### 2.7.1 Python

Python é uma linguagem de programação de alto nível, interpretada e de propósito geral,
que se consolidou como a principal linguagem para projetos de Engenharia de Dados,
Ciência de Dados e Inteligência Artificial (RAMALHO, 2022). Sua ampla adoção no ecossistema
de dados é impulsionada pela rica biblioteca padrão, pelo vasto repositório de pacotes
disponíveis no PyPI e pela integração nativa com as principais ferramentas de orquestração
e processamento de dados.

Neste projeto, Python é a linguagem principal utilizada para: consumo das APIs da Adzuna
e do IBGE; processamento e transformação dos dados nas camadas Bronze, Silver e Gold;
validação de qualidade; e definição das DAGs no Apache Airflow. As principais bibliotecas
utilizadas incluem `requests` para consumo de APIs, `pandas` para manipulação de dados
tabulares e `json` para tratamento dos arquivos brutos.

### 2.7.2 Apache Airflow

O Apache Airflow é uma plataforma de orquestração de workflows de código aberto,
originalmente desenvolvida pelo Airbnb em 2014 e doada à Apache Software Foundation
em 2016. É amplamente utilizada em projetos de Engenharia de Dados para automatizar,
agendar e monitorar pipelines de processamento (HARENSLAK; RUITER, 2021).

O Airflow modela os workflows como DAGs (Directed Acyclic Graphs), nas quais cada nó
representa uma tarefa (operador) e as arestas definem as dependências de execução.
Os operadores são classes Python que encapsulam a lógica de cada tarefa, desde chamadas
a APIs até execução de scripts de transformação. O painel web do Airflow permite
visualizar o estado de cada execução, acessar logs e gerenciar reprocessamentos.

Neste projeto, o Airflow é utilizado para orquestrar todo o fluxo de dados: da extração
das APIs (Bronze) ao processamento e disponibilização analítica (Gold), garantindo
automation completa, rastreabilidade e recuperação automática em caso de falhas.

### 2.7.3 Microsoft Power BI

O Microsoft Power BI é uma plataforma de Inteligência de Negócios voltada para a criação
de relatórios e painéis interativos. Neste projeto, é utilizado como camada de consumo
da camada Gold da Arquitetura Medalhão, transformando os dados analíticos em
visualizações acessíveis e interativas sobre o mercado de trabalho em tecnologia.
Sua capacidade de conectar-se a fontes baseadas em arquivos Parquet e CSV, além de
suportar atualizações agendadas, o torna adequado para o ciclo de atualização periódica
do pipeline proposto (MICROSOFT, 2023).

### 2.7.4 APIs Públicas: Adzuna e IBGE

A **API da Adzuna** é uma interface pública de acesso a dados de vagas de emprego,
disponibilizada pela empresa britânica Adzuna. Oferece endpoints para consulta de
anúncios de emprego com filtragem por país, categoria profissional, localização e
faixa salarial, retornando os dados em formato JSON. Sua documentação pública e
authenticao via chave de API a tornam uma fonte compatível com consumo automatizado
em pipelines de Engenharia de Dados (ADZUNA, 2024).

Os **serviços do IBGE** (Instituto Brasileiro de Geografia e Estatística) disponibilizam
APIs públicas para acesso a dados geográficos e populacionais do Brasil. Neste projeto,
são utilizados os endpoints de localidades (estados e municípios) e indicadores
populacionais, permitindo enriquecer os dados de vagas com informações sobre regiões
e população para análises geográficas e comparativas (IBGE, 2024).

---

## Referências

ADZUNA. **API Documentation**. Disponível em: <https://developer.adzuna.com/>. Acesso em:
jun. 2026.

APACHE AIRFLOW. **Apache Airflow Documentation**. Versão 2.x. Disponível em:
<https://airflow.apache.org/docs/>. Acesso em: jun. 2026.

CHEN, Min; MAO, Shiwen; LIU, Yunhao. **Big Data: A Survey**. Mobile Networks and
Applications, v. 19, n. 2, p. 171–209, 2014.

DATABRICKS. **Medallion Architecture**. Disponível em:
<https://www.databricks.com/glossary/medallion-architecture>. Acesso em: jun. 2026.

FANG, Hu. **Managing Data Lakes in Big Data Era**. In: IEEE International Conference on
Cyber Technology in Automation, Control, and Intelligent Systems (CYBER), 2015.

HARENSLAK, Bas; RUITER, Julian de. **Data Pipelines with Apache Airflow**. Shelter
Island: Manning Publications, 2021.

IBGE — INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. **API IBGE**. Disponível em:
<https://servicodados.ibge.gov.br/api/docs/>. Acesso em: jun. 2026.

INMON, William H. **Building the Data Warehouse**. 4. ed. Nova York: John Wiley & Sons,
2002.

LANEY, Doug. **3D Data Management: Controlling Data Volume, Velocity, and Variety**.
META Group Research Note, 2001.

MICROSOFT. **Power BI Documentation**. Microsoft Docs, 2023.

RAMALHO, Luciano. **Python Fluente**. 2. ed. São Paulo: Novatec, 2022.

VASSILIADIS, Panos. **A Survey of Extract-Transform-Load Technology**. International
Journal of Data Warehousing and Mining, v. 5, n. 3, p. 1–27, 2009.
