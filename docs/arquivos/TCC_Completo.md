# Plataforma de Inteligência de Mercado de Trabalho para Profissionais de Tecnologia utilizando Arquitetura Medalhão, Airflow, Python e Power BI

**Autor:** Nathan Thomaz
**Instituição:** Centro Universitário La Salle — Unilasalle
**Curso:** Sistemas de Informação
**Trabalho de Conclusão de Curso**
**Ano:** 2026

---

## Resumo

Este trabalho propõe a concepção e implementação de uma plataforma de inteligência de
mercado de trabalho para profissionais de tecnologia, baseada na Arquitetura Medalhão
(Bronze, Silver e Gold), com orquestração automatizada por Apache Airflow e visualização
analítica via Microsoft Power BI. As fontes de dados são as APIs públicas da Adzuna
(vagas de emprego) e do IBGE (dados geográficos e populacionais), integradas em um
pipeline de Engenharia de Dados desenvolvido inteiramente em Python. A hipótese é
operacionalizada por critérios mensuráveis: completude dos dados superior a 95%,
consistência entre camadas superior a 98%, automação completa do pipeline via Airflow e
capacidade analítica comprovada por ao menos cinco indicadores-chave de desempenho (KPIs)
de mercado de trabalho em tecnologia disponíveis no Power BI. A metodologia classifica-se
como pesquisa aplicada de natureza mista, com estudo de caso experimental. O trabalho
contribui para demonstrar a viabilidade de pipelines modernos de Engenharia de Dados
com dados reais de mercado, integração de múltiplas APIs públicas e orquestração
profissional em cenário acadêmico.

**Palavras-chave:** Arquitetura Medalhão. Apache Airflow. Mercado de Trabalho. Engenharia
de Dados. APIs Públicas. Power BI. Python. Qualidade de Dados.

---

---

## CAPÍTULO 1 — INTRODUÇÃO

### 1.1 Motivação

A transformação digital acelerou profundamente o mercado de trabalho na área de
tecnologia, gerando um fluxo contínuo e volumoso de dados sobre vagas de emprego,
demanda por competências, distribuição geográfica de oportunidades e dinâmicas salariais.
De acordo com o relatório do Fórum Econômico Mundial (2023), espera-se a criação de
milhões de novos postos de trabalho em áreas como inteligência artificial, ciência de
dados e engenharia de software nos próximos anos, ao mesmo tempo em que outras funções
tradicionais tendem a desaparecer ou se transformar. Nesse contexto, a capacidade de
coletar, integrar e analisar dados sobre o mercado de trabalho de forma sistemática
torna-se um diferencial estratégico para profissionais, instituições de ensino e
organizações de recrutamento.

Embora existam plataformas comerciais de análise de mercado de trabalho, soluções abertas
e aplicadas que demonstrem, de ponta a ponta, a construção de uma plataforma de
inteligência de dados sobre o setor de tecnologia ainda são escassas na literatura
acadêmica. A maioria dos trabalhos disponíveis aborda componentes isolados do problema
— seja a extração de dados de uma única fonte, seja a construção de visualizações
descritivas — sem integrar múltiplas fontes públicas de dados em uma arquitetura de
Engenharia de Dados estruturada, governada e orientada a análises estratégicas.

A disponibilidade de APIs públicas, como a Adzuna para vagas de emprego e o IBGE para
dados geográficos e populacionais, oferece uma oportunidade concreta para a construção
de um ambiente analítico capaz de consolidar informações heterogêneas sobre o mercado
de trabalho em tecnologia. A integração dessas fontes, por meio de uma Arquitetura
Medalhão (Bronze, Silver e Gold), orquestrada com Apache Airflow e desenvolvida em
Python, permite transformar dados públicos dispersos em informações estratégicas,
acessíveis por meio de dashboards interativos no Power BI.

A relevância acadêmica do tema é reforçada pela escassez de implementações práticas
que combinem orquestração de pipelines com Airflow, Arquitetura Medalhão e integração
de APIs heterogêneas no contexto específico do mercado de trabalho em tecnologia —
lacuna que este trabalho se propõe a preencher
---

### 1.2 Problema de Pesquisa

Como projetar e implementar uma plataforma de Engenharia de Dados capaz de coletar,
integrar e disponibilizar informações de múltiplas APIs públicas sobre o mercado de
trabalho em tecnologia, aplicando a Arquitetura Medalhão (Bronze, Silver e Gold) com
orquestração via Apache Airflow, de forma a produzir análises estratégicas confiáveis
e auditáveis sobre vagas de emprego, competências demandadas e distribuição geográfica
das oportunidades?

---

### 1.3 Hipótese

A hipótese deste trabalho é que uma plataforma de Engenharia de Dados estruturada com
a Arquitetura Medalhão, orquestrada por Apache Airflow e desenvolvida em Python, é
capaz de integrar de forma confiável dados das APIs da Adzuna e do IBGE, produzindo
indicadores analíticos consistentes e auditáveis sobre o mercado de trabalho em
tecnologia. Para fins de verificação, a hipótese é considerada confirmada se, ao final
da implementação, forem atendidos simultaneamente os seguintes critérios:

- **Completude dos dados** na camada Gold igual ou superior a **95%**, calculada como
  proporção de campos obrigatórios preenchidos sobre o total esperado após a integração
  das fontes.
- **Consistência entre camadas** igual ou superior a **98%**, medida como proporção de
  registros da camada Bronze que chegam íntegros à camada Gold após as transformações
  Silver, sem perda não justificada.
- **Automação completa do pipeline**, definida como a execução bem-sucedida de todas as
  DAGs no Apache Airflow sem intervenção manual, incluindo reprocessamentos em caso
  de falha.
- **Capacidade analítica completa**, definida como a geração bem-sucedida de, no mínimo,
  cinco indicadores estratégicos sobre o mercado de trabalho em tecnologia, disponíveis
  em dashboards interativos no Power BI com dados coerentes e auditáveis.

---

### 1.4 Objetivos

O objetivo geral deste trabalho é **projetar e implementar uma plataforma de inteligência
de mercado de trabalho para profissionais de tecnologia**, utilizando a Arquitetura
Medalhão (Bronze, Silver e Gold), orquestração com Apache Airflow, processamento em
Python e visualização no Power BI.

Para alcançar o objetivo geral, definem-se os seguintes objetivos específicos:

- **Analisar** as principais características do mercado de trabalho em tecnologia e
  identificar as fontes de dados públicas disponíveis — especialmente as APIs da Adzuna
  e do IBGE — para suporte às análises estratégicas propostas.

- **Projetar** a arquitetura da solução em camadas Bronze, Silver e Gold, definindo
  os pipelines de ingestão, transformação e disponibilização dos dados, bem como o
  modelo analítico da camada Gold orientado aos indicadores de mercado.

- **Implementar** os pipelines de dados em Python, com ingestão das APIs da Adzuna e
  do IBGE na camada Bronze, tratamento e enriquecimento na camada Silver, e
  estruturação analítica na camada Gold, garantindo rastreabilidade e qualidade em
  cada etapa.

- **Orquestrar** toda a execução dos pipelines por meio do Apache Airflow, automatizando
  o agendamento, o controle de dependências, o monitoramento e o gerenciamento de
  falhas e reprocessamentos.

- **Avaliar** a solução por meio de métricas de completude (≥ 95%), consistência entre
  camadas (≥ 98%) e capacidade analítica, verificando a geração dos indicadores
  estratégicos propostos nos dashboards do Power BI.

---

### 1.5 Organização do Trabalho

Este trabalho está estruturado em cinco capítulos, organizados de forma a conduzir o leitor
desde a fundamentação teórica até os resultados e conclusões da pesquisa.

O **Capítulo 1** apresenta a introdução, compreendendo a motivação do trabalho, o problema
de pesquisa, a hipótese formulada com critérios mensuráveis, os objetivos geral e específicos
e a organização do documento.

O **Capítulo 2** desenvolve o referencial teórico, abordando os fundamentos de Big Data,
as arquiteturas de armazenamento e processamento de dados (Data Lake, Data Warehouse e
Arquitetura Medalhão), os princípios de Engenharia de Dados, orquestração de pipelines
com Apache Airflow, qualidade e governança de dados, além das principais ferramentas
tecnológicas utilizadas no projeto.

O **Capítulo 3** descreve a metodologia adotada, incluindo a classificação da pesquisa,
o ambiente de desenvolvimento, as fontes de dados utilizadas (Adzuna e IBGE), a
arquitetura do pipeline de dados nas camadas Bronze, Silver e Gold, o modelo analítico
da camada Gold, a orquestração com Airflow e o protocolo de avaliação com métricas e
critérios de aceitação.

O **Capítulo 4** apresenta os resultados obtidos com a implementação da plataforma,
incluindo a análise do pipeline de dados, os valores das métricas de qualidade, a
validação dos indicadores estratégicos gerados no Power BI e a avaliação da solução
de orquestração implementada.

O **Capítulo 5** apresenta as conclusões do trabalho, respondendo à hipótese formulada
com base nos critérios mensuráveis definidos, discutindo as limitações da pesquisa e
apontando direções para trabalhos futuros.

---

---

## CAPÍTULO 2 — REFERENCIAL TEÓRICO

### 2.1 Big Data: Conceito e Características

O termo Big Data designa conjuntos de dados cuja dimensão, complexidade e velocidade de
geração superam a capacidade dos sistemas de gerenciamento de dados convencionais para
captura, armazenamento, gestão e análise (CHEN; MAO; LIU, 2014). A popularização do
conceito remonta ao trabalho de Laney (2001), que caracterizou o fenômeno por três
dimensões fundamentais — volume, velocidade e variedade —, modelo posteriormente
expandido para incluir veracidade e valor, compondo o que a literatura denomina os
cinco Vs do Big Data.

O **volume** refere-se à quantidade massiva de dados gerados continuamente por dispositivos,
transações e interações digitais. A **velocidade** diz respeito à taxa de geração e ao
tempo exigido para processamento e resposta. A **variedade** abrange a multiplicidade de
formatos e fontes, incluindo dados estruturados, semiestruturados (JSON, XML) e não
estruturados (imagens, vídeos, texto livre). A **veracidade** concerne à incerteza e à
qualidade inerente aos dados em grande escala, enquanto o **valor** refere-se à capacidade
de extrair inteligência útil para a tomada de decisão organizacional (CHEN; MAO; LIU,
2014).

No contexto do mercado de trabalho em tecnologia, todas essas dimensões se manifestam de
forma intensa: plataformas de vagas geram grandes volumes de anúncios, descrições de
cargos, dados salariais e localizações provenientes de múltiplas fontes heterogêneas,
exigindo infraestruturas de dados capazes de ingerir, armazenar e processar esse fluxo
contínuo com confiabilidade e rastreabilidade (LANEY, 2001; CHEN; MAO; LIU, 2014).

---

### 2.2 Arquiteturas de Armazenamento e Processamento de Dados

#### 2.2.1 Data Warehouse

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

#### 2.2.2 Data Lake

O Data Lake (Lago de Dados) surgiu como resposta às limitações dos Data Warehouses
tradicionais diante da explosão de volumes e variedades de dados. Conceitualmente, é um
repositório centralizado que armazena dados em seu formato nativo e bruto — estruturados,
semiestruturados e não estruturados —, sem a necessidade de definição de esquema no
momento da ingestão. Essa abordagem, denominada schema-on-read, posterga a definição
da estrutura para o momento do consumo, conferindo máxima flexibilidade (FANG, 2015).

As principais vantagens do Data Lake incluem o custo reduzido de armazenamento em
sistemas de arquivos distribuídos, a capacidade de preservar dados brutos para
reprocessamento futuro e a flexibilidade para acomodar diferentes tipos de carga analítica.
Entretanto, sem governança, processos de qualidade e controle de acesso adequados, os
Data Lakes tendem a se degradar em repositórios de dados desorganizados, sem catalogação
e de difícil consumo analítico — fenômeno conhecido como pântano de dados. Essa
deterioração decorre da ausência de garantias transacionais, da falta de versionamento
e da dificuldade em aplicar atualizações e exclusões em arquivos imutáveis
(FANG, 2015; ZAHARIA et al., 2021).

#### 2.2.3 Arquitetura Medalhão

A Arquitetura Medalhão, amplamente adotada em implementações modernas de Engenharia de
Dados e descrita pela Databricks (2023), representa um padrão de refinamento progressivo
dos dados organizado em três camadas — Bronze, Silver e Gold —, cada uma com um nível
crescente de qualidade, estruturação e prontidão para consumo analítico.

Diferentemente da arquitetura Lakehouse, que enfatiza os mecanismos de armazenamento
transacional (como o Delta Lake), a Arquitetura Medalhão é um **padrão de design de
pipeline de dados**, agnóstico quanto à tecnologia de armazenamento, e pode ser
implementada com formatos como JSON, Parquet e CSV, orquestrada por ferramentas como
o Apache Airflow. A separação clara entre camadas permite rastreabilidade completa,
reprocessamento controlado e governança granular dos dados.

Essa arquitetura possibilita a unificação do ciclo de vida dos dados — desde a ingestão
bruta até a análise estratégica — reduzindo redundâncias, custos operacionais e
inconsistências decorrentes da movimentação não controlada entre sistemas distintos
(DATABRICKS, 2023).

#### 2.2.4 Quadro Comparativo das Arquiteturas

O Quadro 1 sintetiza as principais características das três arquiteturas discutidas,
permitindo a visualização objetiva das diferenças e complementaridades entre elas.

#### Quadro 1 — Comparativo entre Data Warehouse, Data Lake e Arq. Medalhão

| Característica | Data Warehouse | Data Lake | Arq. Medalhão |
|---|---|---|---|
| Definição de esquema | Na ingestão (schema-on-write) | No consumo (schema-on-read) | Na ingestão com evolução controlada |
| Tipos de dados suportados | Estruturados | Todos | Todos |
| Garantias ACID | Sim (banco relacional) | Não | Opcional (por tecnologia) |
| Custo de armazenamento | Alto | Baixo | Baixo |
| Escalabilidade | Vertical | Horizontal | Horizontal |
| Desempenho analítico | Alto | Variável | Alto |
| Transformações progressivas | Não | Não | Sim (Bronze→Silver→Gold) |
| Rastreabilidade | Limitada | Baixa | Total (por camada) |
| Orquestração | Processo ETL externo | Nenhuma | Airflow/DAGs |

Fonte: elaborado pelo autor com base em Databricks (2023), Fang (2015) e Vassiliadis (2009).

---

### 2.3 Arquitetura em Camadas: Bronze, Silver e Gold

A organização dos dados em camadas é um padrão arquitetural amplamente adotado em
implementações de Lakehouse e Engenharia de Dados moderna. O modelo de três camadas —
Bronze, Silver e Gold —, descrito por Databricks (2023) e amplamente adotado em
implementações de Engenharia de Dados moderna, estrutura o fluxo de dados de acordo com
seu grau de refinamento e propósito de uso.

A **camada Bronze** recebe os dados em seu estado bruto, diretamente das fontes de origem,
sem transformações. Seu propósito é preservar o histórico completo dos dados ingeridos,
garantindo rastreabilidade e a possibilidade de reprocessamento a partir do ponto de
origem. No contexto deste projeto, os dados são provenientes das APIs Adzuna e IBGE,
armazenados em formato JSON com metadados de ingestão.

A **camada Silver** representa a fase de refinamento dos dados. Nela são aplicados processos
de limpeza, padronização de formatos, remoção de duplicatas, validação de integridade
referencial, integração entre fontes e enriquecimento com informações complementares.
O resultado é um conjunto de dados confiável, consistente e pronto para consumo por
diferentes fluxos analíticos.

A **camada Gold** é a camada analítica da arquitetura. Os dados, já tratados e validados,
são organizados em tabelas otimizadas para geração de indicadores de mercado de trabalho
e alimentação de ferramentas de visualização como o Power BI (DATABRICKS, 2023;
VASSILIADIS, 2009). Essa separação em camadas promove isolamento de falhas, controle
de qualidade progressivo, rastreabilidade completa do ciclo de vida do dado e
flexibilidade para que diferentes equipes consumam os dados no nível adequado às suas
necessidades.

---

### 2.4 Engenharia de Dados e Pipelines de Transformação

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
do próprio ambiente analítico (VASSILIADIS, 2009). Esse modelo é natural na
Arquitetura Medalhão, onde a camada Bronze recebe os dados brutos das APIs e as
transformações são aplicadas progressivamente nas camadas Silver e Gold.

---

### 2.5 Orquestração de Pipelines com Apache Airflow

A orquestração de pipelines de dados é a prática de automatizar e coordenar a execução
de múltiplas tarefas interdependentes de processamento de dados, garantindo que cada
etapa seja executada na ordem correta, no momento certo e com os mecanismos adequados
de monitoramento e recuperação de falhas (HARENSLAK; RUITER, 2021).

O Apache Airflow, criado pela Airbnb em 2014 e incubado pela Apache Software Foundation
a partir de 2016, tornou-se a ferramenta de orquestração de pipelines mais adotada no
ecossistema de Engenharia de Dados. Seu principal conceito é o de **DAG** (Directed
Acyclic Graph — Grafo Acíclico Dirigido): uma estrutura que define as tarefas do pipeline
e suas dependências de forma explícita, garantindo ordem de execução determinística.

As principais características do Airflow relevantes para este trabalho são:

- **Agendamento:** as DAGs podem ser agendadas para execução periódica (diária, semanal
  etc.), automatizando a atualização dos dados sem intervenção manual.
- **Controle de dependências:** cada tarefa só é executada após o sucesso de suas
  predecessoras, garantindo integridade do pipeline.
- **Monitoramento:** o Airflow Web UI fornece visibilidade em tempo real sobre o
  estado de cada execução e logs detalhados por tarefa.
- **Retry automático e alertas:** em caso de falha, o Airflow pode retornar
  automáticamente e enviar notificações por e-mail (APACHE AIRFLOW, 2024).

---

### 2.6 Qualidade e Governança de Dados

A qualidade de dados é um atributo multidimensional que reflete o grau em que um conjunto
de dados atende aos requisitos de uso para os quais foi coletado ou produzido. Vassiliadis
(2009) identifica as principais dimensões de qualidade relevantes para sistemas analíticos:

- **Completude:** proporção de valores preenchidos em relação aos esperados.
- **Consistência:** ausência de contradições entre registros de uma mesma tabela ou
  entre tabelas relacionadas.
- **Acurácia:** conformidade dos valores registrados com os valores reais que representam.
- **Unicidade:** ausência de registros duplicados que possam distorcer análises.
- **Pontualidade:** disponibilidade dos dados no momento em que são necessários.

Na Arquitetura Medalão, a qualidade de dados é gerenciada progressivamente entre as
camadas: na camada Bronze os dados são ingeridos sem filtros; na Silver são aplicadas
regras de validação e limpeza; e na Gold os dados atendem a um padrão de qualidade
estabelecido para consumo analítico (DATABRICKS, 2023). A **governança de dados** nesse
contexto inclui: controle de versões dos scripts de transformação, logs de execução
registrados pelo Airflow, documentação das regras de transformação por camada e
monitoramento de KPIs de qualidade do pipeline.

---

### 2.7 Ferramentas e Tecnologias

#### 2.7.1 Python

Python é uma linguagem de programação de alto nível, interpretada e de propósito geral,
que se tornou a linguagem dominante nos domínios de Engenharia de Dados, Ciência de Dados
e Inteligência Artificial (RAMALHO, 2022). Sua sintaxe expressiva, vasto ecossistema de
bibliotecas e ampla adopção comunitária tornam-na a escolha preferencial para construção
de pipelines de dados modernos.

Neste trabalho, Python é utilizado como linguagem única em todo o pipeline:

- Biblioteca **`requests`** para consumo das APIs Adzuna e IBGE via HTTP
- Biblioteca **`pandas`** para manipulação, limpeza e transformação dos dados
- Biblioteca **`json`** para serialização e desserialização dos dados da camada Bronze
- Definição das **DAGs do Airflow** como scripts Python

#### 2.7.2 Apache Airflow

O Apache Airflow é a principal ferramenta de orquestração de pipelines de dados de
código aberto da atualidade, com ampla adoção em ambientes corporativos e acadêmicos.
Seu design baseado em DAGs Python permite que os engenheiros de dados descrevam
pipelines complexos como código, versionando, testando e documentando os fluxos
de trabalho com as mesmas práticas de desenvolvimento de software (HARENSLAK; RUITER,
2021). Neste projeto, o Airflow é executado via Docker Compose e respónsável pelo
agendamento e monitoramento de todas as DAGs do pipeline.

#### 2.7.3 Microsoft Power BI

O Microsoft Power BI é uma plataforma de Inteligência de Negócios voltada para a
criação de relatórios e painéis interativos. Utilizado como camada de consumo da
camada Gold da Arquitetura Medalão, o Power BI transforma os dados analíticos sobre
o mercado de trabalho em tecnologia em visualizações acessíveis a usuários de
negócio. Sua integração nativa com arquivos Parquet e conexão direta a pastas de
dados torna-o adequado para validar os indicadores do pipeline proposto (MICROSOFT, 2023).

#### 2.7.4 APIs Públicas: Adzuna e IBGE

As APIs públicas são interfaces que permitem o acesso programático a dados e
funcionalidades de terceiros por meio do protocolo HTTP. A **API da Adzuna** é uma fonte
de dados de vagas de emprego global, que exposta dados estruturados sobre títulos de
cargos, empresas, localizações, descrições e salários (ADZUNA, 2024). A **API do IBGE**
oferece acesso a dados geográficos, populacionais e econômicos do Brasil, permitindo
enriquecer as análises de vagas com contexto regional (IBGE, 2024). A integração dessas
fontes heterogêneas constitui o núcleo da proposta deste trabalho.

---

---

## CAPÍTULO 3 — METODOLOGIA

### 3.1 Classificação da Pesquisa

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

### 3.2 Ambiente de Desenvolvimento

A implementação deste trabalho é realizada em ambiente local com as seguintes
especificações:

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

### 3.3 Fontes de Dados

O projeto utiliza APIs públicas como fontes primárias de dados, permitindo a integração
de diferentes contextos de informação sobre o mercado de trabalho em tecnologia.

#### 3.3.1 API Adzuna — Vagas de Emprego

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

#### 3.3.2 API Jooble — Vagas de Emprego Complementares

A API da Jooble é a segunda fonte de vagas do projeto, agregando anúncios de
múltiplos portais de emprego (ziprecruiter.com, appcast.io, lensa.com, entre
outros). O parâmetro de localização da API não filtra corretamente por Brasil, então
a coleta é feita sem filtro geográfico, e cada vaga é classificada como nacional ou
internacional na camada Silver — por correspondência de UF/município (IBGE) ou, na
ausência desta, pela menção a "Brasil"/"Brazil" no título ou na descrição da vaga.

#### Quadro 3.1 — Endpoint da API Jooble utilizado

| Método | Endpoint | Retorno |
|---|---|---|
| POST | `/api/{chave}` | Lista de vagas por palavra-chave, paginada |

Fonte: Jooble (2026).

#### 3.3.3 APIs de Vagas Remotas Complementares

Três fontes adicionais, com acesso público, gratuito e sem cadastro, ampliam a
cobertura de vagas remotas: **RemoteOK** (`/api`, lista completa sem paginação),
**Remotive** (`/api/remote-jobs?category=software-dev`) e **Arbeitnow**
(`/api/job-board-api`, paginada, com sinalizador estruturado `remote`). As três são
majoritariamente vagas remotas/globais, contribuindo sobretudo para os indicadores
de tecnologias, cargos e modalidade de trabalho.

Fonte: RemoteOK, Remotive e Arbeitnow (2026).

#### 3.3.4 API IBGE — Dados Geográficos e Populacionais

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

### 3.4 Arquitetura do Pipeline de Dados

O pipeline de dados é implementado seguindo o padrão de três camadas da Arquitetura
Medalhão, orquestrado pelo Apache Airflow por meio de DAGs dedicadas para cada fonte
de dados.

#### 3.4.1 Camada Bronze — Ingestão Bruta

A camada Bronze realiza a ingestão dos dados diretamente das APIs Adzuna, Jooble,
RemoteOK, Remotive, Arbeitnow e IBGE, sem nenhuma transformação. Os dados são
armazenados em formato JSON particionado por data de ingestão, com metadados de
rastreabilidade (`_data_ingestao`, `_origem`), em `dados/bronze/{fonte}/`.

#### 3.4.2 Camada Silver — Refinamento e Qualidade

A camada Silver aplica regras de qualidade e padronização sobre os dados da camada
Bronze, unificando as cinco fontes de vagas em um esquema comum com chave de negócio
prefixada por fonte (`adzuna_{id}`, `jooble_{id}`, `remoteok_{id}`, `remotive_{id}`,
`arbeitnow_{slug}`). As transformações incluem: remoção de duplicatas por chave de
negócio; preenchimento ou exclusão de registros com campos obrigatórios nulos;
validação de domínio (salários não negativos; datas válidas em formatos distintos
entre as fontes, incluindo a conversão de timestamp Unix da Arbeitnow e o descarte
de datas-sentinela implausíveis); normalização de strings e remoção de marcações
HTML; extração de mais de 100 habilidades técnicas catalogadas a partir das
descrições das vagas, de forma insensível a acentuação; classificação do cargo/área
de atuação, da senioridade (estágio a especialista) e da modalidade de trabalho
(remoto/híbrido/presencial) a partir de palavras-chave, com sinalizadores
estruturados da fonte tendo prioridade quando disponíveis; extração do número
mínimo de anos de experiência exigido, quando mencionado; e integração com dados
geográficos do IBGE (município, UF, região e população), incluindo a classificação
de cada vaga como nacional ou internacional. Saída em formato Parquet em
`dados/silver/{fonte}/`.

#### 3.4.3 Camada Gold — Modelo Dimensional

A camada Gold organiza os dados refinados em um modelo dimensional (Star Schema)
otimizado para consumo pelo Power BI, respondendo diretamente aos indicadores de
mercado de trabalho definidos na hipótese. Ao final, calcula automaticamente as
métricas de qualidade (seção 3.7.1). Gravação em formato Parquet em
`dados/gold/{tabela}/`.

---

### 3.5 Modelo Dimensional — Camada Gold

O modelo implementado na camada Gold segue o padrão Star Schema (KIMBALL; ROSS, 2013):
uma tabela fato central (grão "uma vaga de TI publicada em uma das cinco fontes")
circundada por tabelas dimensão, mais uma tabela ponte e uma tabela de referência.

#### Quadro 5 — Tabela fato: fato_vagas

| Coluna | Tipo | Descrição |
|---|---|---|
| id_vaga | STRING | Identificador único da vaga, prefixado por fonte — grão da fato |
| id_tempo | INT | FK → dim_tempo |
| id_localizacao | INT | FK → dim_localizacao |
| id_empresa | INT | FK → dim_empresa |
| id_categoria | INT | FK → dim_categoria |
| id_fonte | INT | FK → dim_fonte |
| id_senioridade | INT | FK → dim_senioridade |
| id_modalidade | INT | FK → dim_modalidade |
| titulo | STRING | Título do cargo |
| salario_min | DECIMAL(10,2) | Salário mínimo anunciado (apenas Adzuna) |
| salario_max | DECIMAL(10,2) | Salário máximo anunciado (apenas Adzuna) |
| salario_medio | DECIMAL(10,2) | Média entre salario_min e salario_max |
| anos_experiencia_min | INT | Anos mínimos de experiência exigidos, quando extraível da descrição |
| quantidade | INT | Medida aditiva de contagem (valor fixo 1) |

As dimensões do modelo são: **dim_tempo** (id_tempo, data, ano, mes, nome_mes,
trimestre, ano_mes), **dim_localizacao** (id_localizacao, municipio, uf, nome_estado,
regiao, pais, populacao, total_vagas, vagas_por_100k_hab), **dim_empresa**
(id_empresa, nome_empresa, empresa_identificada, cnpj, razao_social,
situacao_cadastral, porte, cnae_principal, cnpj_verificado — nomes quase-idênticos
são agrupados por remoção de sufixo societário, e as principais empresas têm CNPJ
validado manualmente junto à Receita Federal via BrasilAPI), **dim_categoria**
(id_categoria, categoria), **dim_habilidade** (id_habilidade, habilidade,
categoria_skill), **dim_fonte** (id_fonte, fonte, portal_origem), **dim_senioridade**
(id_senioridade, senioridade, ordem) e **dim_modalidade** (id_modalidade,
modalidade). A relação N:N entre vagas e habilidades é resolvida pela tabela ponte
**ponte_vaga_habilidade** (id_vaga, id_habilidade), e a tabela de referência
**benchmark_salarial_categoria** (categoria, faixa_salarial_min, quantidade_vagas)
traz a distribuição salarial agregada da própria Adzuna — única fonte usada nas
medidas salariais, por ser 100% brasileira e em uma
moeda única (BRL); as demais fontes misturam vagas de múltiplos países e moedas em um
campo de texto livre, então suas vagas ficam com salário nulo para não corromper as
médias.

---

### 3.6 Orquestração com Apache Airflow

O Apache Airflow é responsável por automatizar, agendar e monitorar todos os pipelines
da plataforma. Cada camada da Arquitetura Medalhão possui uma DAG dedicada.

#### Quadro 6 — DAGs implementadas

| DAG | Fonte | Periodicidade | Descrição |
|---|---|---|---|
| `dag_bronze_adzuna` | Adzuna API | Diária | Coleta de vagas |
| `dag_bronze_jooble` | Jooble API | Semanal | Coleta de vagas complementares (cota limitada) |
| `dag_bronze_fontes_remotas` | RemoteOK, Remotive, Arbeitnow | Semanal | Coleta de vagas remotas complementares |
| `dag_bronze_ibge` | IBGE API | Semanal | Coleta de dados geográficos |
| `dag_silver_tratamento` | Bronze | Diária | Limpeza e integração |
| `dag_gold_analitico` | Silver | Diária | Geração do modelo dimensional e cálculo das métricas de qualidade |

Mecanismos de controle incluem: retentativas automáticas (até 3), alertas por e-mail,
logs detalhados no Airflow Web UI e dependências explícitas entre DAGs.

---

### 3.7 Protocolo de Avaliação

#### 3.7.1 Métricas de Qualidade de Dados

### 3.7 Protocolo de Avaliação

A avaliação da plataforma proposta será conduzida por meio de métricas objetivas,
aplicadas em duas dimensões: qualidade dos dados e capacidade analítica.

#### 3.7.1 Métricas de Qualidade de Dados

#### Quadro 7 — Métricas de qualidade e critérios de aceitação

| Métrica | Fórmula | Critério |
|---|---|---|
| Completude | registros_completos / total_esperado × 100 | ≥ 95% |
| Consistência | (total_bronze − perda_não_justificada) / total_bronze × 100 | ≥ 98% |
| Aproveitamento bruto | total_gold / total_bronze × 100 | ≥ 85% (auxiliar) |
| Unicidade | (total − duplicatas) / total × 100 | = 100% |
| Acurácia de tipos | campos_tipados_corretamente / total × 100 | = 100% |
| Validade de empresa | vagas_com_empresa_identificada / total × 100 | ≥ 95% |

A consistência opera literalmente a definição do Capítulo 3 ("sem perda não
justificada"): perda por regra de validação de domínio documentada (duplicata,
campo obrigatório vazio, data implausível) não conta contra a métrica; a camada
Silver decompõe toda perda por causa em `dados/silver/vagas/relatorio_limpeza.json`.
O aproveitamento bruto complementa isso como indicador auxiliar de volume, sem
distinguir a causa da perda.

Fonte: elaborado pelo autor.

As quatro métricas são calculadas automaticamente pelo módulo `src/qualidade/metricas.py`,
executado como última tarefa da DAG `dag_gold_analitico` sobre a tabela `fato_vagas`.
O resultado é gravado como tabela Gold (`metricas_qualidade`), permitindo tanto a
auditoria pelo Airflow Web UI quanto o acompanhamento histórico no próprio Power BI.

#### 3.7.2 Indicadores de Mercado de Trabalho Avaliados

1. Evolução do volume de vagas ao longo do tempo (mensal/trimestral)
2. Distribuição geográfica das oportunidades por UF e região
3. Empresas com maior volume de vagas publicadas
4. Tecnologias e habilidades mais demandadas
5. Indicadores salariais por cargo e região

Cada indicador é considerado **válido** quando: (a) atualiza automaticamente após
execução do pipeline; (b) os valores são coerentes com os dados originais das APIs
(verificação por amostragem); e (c) o painel produz resultado em tempo adequado para
uso interativo no Power BI Desktop.

---

### 3.8 Cronograma de Execução

#### Quadro 8 — Cronograma do projeto

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

Fonte: elaborado pelo autor.

---

---

## REFERÊNCIAS BIBLIOGRÁFICAS

ADZUNA. **API Documentation**. Disponível em: <https://developer.adzuna.com>. Acesso em:
2024.

APACHE AIRFLOW. **Apache Airflow Documentation**. Disponível em:
<https://airflow.apache.org/docs/>. Acesso em: 2024.

ARBEITNOW. **Job Board API**. Disponível em: <https://www.arbeitnow.com/api/job-board-api>.
Acesso em: 2026.

BRASILAPI. **API de CNPJ**. Disponível em: <https://brasilapi.com.br/docs#tag/CNPJ>.
Acesso em: 2026.

CHEN, Min; MAO, Shiwen; LIU, Yunhao. **Big Data: A Survey**. Mobile Networks and
Applications, v. 19, n. 2, p. 171–209, 2014.

DATABRICKS. **Medallion Architecture**. Databricks Documentation, 2023.

FANG, Hu. **Managing Data Lakes in Big Data Era: What's a Data Lake and Why Has It
Became Popular in Data Management Ecosystem**. In: IEEE International Conference on
Cyber Technology in Automation, Control, and Intelligent Systems (CYBER), 2015.

FÓRUM ECONÔMICO MUNDIAL. **The Future of Jobs Report 2023**. Genebra: World Economic
Forum, 2023.

GIL, Antonio Carlos. **Como elaborar projetos de pesquisa**. 6. ed. São Paulo: Atlas,
2002.

HARENSLAK, Bas; RUITER, Julian de. **Data Pipelines with Apache Airflow**. Manning
Publications, 2021.

IBGE — INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. **API IBGE Serviços**.
Disponível em: <https://servicodados.ibge.gov.br/api/docs>. Acesso em: 2024.

INMON, William H. **Building the Data Warehouse**. 4. ed. Nova York: John Wiley & Sons,
2002.

JOOBLE. **REST API Documentation**. Disponível em: <https://jooble.org/api/about>.
Acesso em: 2026.

KIMBALL, Ralph; ROSS, Margy. **The Data Warehouse Toolkit**. 3. ed. Indianapolis:
Wiley, 2013.

LANEY, Doug. **3D Data Management: Controlling Data Volume, Velocity, and Variety**.
META Group Research Note, 2001.

MICROSOFT. **Power BI Documentation**. Microsoft Docs, 2023.

RAMALHO, Luciano. **Python Fluente**. 2. ed. São Paulo: O'Reilly / Novatec, 2022.

REMOTEOK. **RemoteOK API**. Disponível em: <https://remoteok.com/api>. Acesso em: 2026.

REMOTIVE. **Remote Jobs API**. Disponível em: <https://remotive.com/remote-jobs/api>.
Acesso em: 2026.

VASSILIADIS, Panos. **A Survey of Extract-Transform-Load Technology**. International
Journal of Data Warehousing and Mining, v. 5, n. 3, p. 1–27, 2009.

YIN, Robert K. **Estudo de caso: planejamento e métodos**. 5. ed. Porto Alegre:
Bookman, 2015.
