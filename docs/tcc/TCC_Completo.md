# Implementação de uma Arquitetura Lakehouse com Camadas Bronze, Silver e Gold para Análise de Dados de E-commerce

**Autor:** Nathan Thomaz
**Instituição:** Centro Universitário La Salle — Unilasalle
**Curso:** Sistemas de Informação
**Trabalho de Conclusão de Curso**
**Ano:** 2026

---

## Resumo

Este trabalho propõe a implementação de uma arquitetura Lakehouse estruturada em camadas
Bronze, Silver e Gold, utilizando tecnologias abertas como Apache Spark e Delta Lake,
aplicada a dados simulados de e-commerce. O objetivo é avaliar se essa abordagem constitui
uma alternativa viável, escalável e de baixo custo ao Data Warehouse tradicional, mantendo
qualidade analítica equivalente para geração de indicadores de negócio. A hipótese é
operacionalizada por critérios mensuráveis: completude dos dados superior a 95%,
consistência entre camadas superior a 98% e latência de consulta analítica inferior ou
igual a 1,5 vezes a do modelo de referência PostgreSQL. A camada Gold implementa um modelo
dimensional Star Schema alimentando painéis interativos no Power BI como instrumento de
validação analítica. A metodologia classifica-se como pesquisa aplicada de natureza
mista, com estudo de caso experimental. O trabalho contribui para preencher a lacuna de
estudos aplicados que demonstrem pipelines completos de Engenharia de Dados com validação
empírica em cenários de comércio eletrônico.

**Palavras-chave:** Lakehouse. Big Data. Engenharia de Dados. Data Warehouse. Delta Lake.
Apache Spark. Modelagem Dimensional. Qualidade de Dados.

---

---

## CAPÍTULO 1 — INTRODUÇÃO

### 1.1 Motivação

O crescimento acelerado do comércio eletrônico nas últimas décadas tem produzido volumes
massivos de dados transacionais — pedidos, clientes, produtos, pagamentos e interações —
que representam um ativo estratégico para a tomada de decisão empresarial. De acordo com
Armbrust et al. (2021), a capacidade de armazenar, processar e analisar grandes volumes de
dados de forma eficiente tornou-se um diferencial competitivo fundamental para organizações
orientadas a dados. Nesse contexto, arquiteturas de dados modernas surgem como resposta à
crescente demanda por análises ágeis e de baixo custo operacional.

Historicamente, os Data Warehouses (DW) tradicionais, fundamentados nas propostas de
Inmon (2002) e Kimball e Ross (2013), consolidaram-se como a principal solução para
armazenamento e análise de dados estruturados em ambientes corporativos. Essas
arquiteturas, no entanto, foram concebidas em um contexto tecnológico distinto do atual,
no qual o volume, a variedade e a velocidade dos dados eram substancialmente menores.
Com o advento do Big Data, caracterizado por Laney (2001) pelas dimensões de volume,
velocidade e variedade, os DWs tradicionais passaram a apresentar limitações estruturais
significativas: dependência de infraestrutura proprietária de alto custo, esquemas de
dados rígidos definidos no momento da ingestão (schema-on-write) e escalabilidade
predominantemente vertical (INMON, 2002).

Embora soluções modernas de Data Warehouse em nuvem, como Snowflake, Google BigQuery
e Amazon Redshift, tenham mitigado parte dessas limitações — especialmente no que se
refere à escalabilidade elástica e ao modelo de custo por uso —, elas introduzem novas
dependências de fornecedores (vendor lock-in), custos elevados para armazenamento de
dados brutos e semiestruturados, e dificuldades de integração com fluxos de aprendizado
de máquina e processamento em tempo real (STONEBRAKER; ÇETINTEMEL, 2005; ZAHARIA
et al., 2016). Drechsler e Sauer (2023) observam que, mesmo em ambientes de nuvem, o
custo total de propriedade de soluções de Data Warehouse tende a ser elevado para
organizações de pequeno e médio porte quando os dados crescem exponencialmente.

Diante dessas limitações, o conceito de Data Lake emergiu como alternativa, propondo o
armazenamento de dados em formato bruto e em escala massiva a baixo custo. Contudo,
estudos demonstram que Data Lakes sem governança adequada degeneram em repositórios de
dados não gerenciados, sem qualidade garantida e de difícil consumo analítico — fenômeno
conhecido como pântano de dados (FANG, 2015). A arquitetura Lakehouse, proposta por
Armbrust et al. (2021), surge precisamente para endereçar essa dualidade, combinando a
flexibilidade e o baixo custo de armazenamento dos Data Lakes com as garantias de
qualidade, transacionalidade e desempenho analítico dos Data Warehouses.

A relevância acadêmica do tema é reforçada pela escassez de estudos aplicados que
demonstrem, de forma prática e mensurável, a implementação de arquiteturas Lakehouse
voltadas ao domínio do comércio eletrônico. Embora trabalhos teóricos e implementações
corporativas sejam documentados na literatura técnica (ZAHARIA et al., 2021), poucos
trabalhos acadêmicos apresentam pipelines completos com validação empírica da qualidade
analítica em cenários de e-commerce — lacuna que este trabalho se propõe a preencher.

Diante desse cenário, o presente trabalho propõe a implementação de uma arquitetura
Lakehouse estruturada em camadas Bronze, Silver e Gold, utilizando tecnologias abertas
como Apache Spark e Delta Lake, aplicada a dados simulados de e-commerce. A proposta
visa demonstrar que essa abordagem constitui uma alternativa viável, escalável e de baixo
custo frente às soluções tradicionais de Data Warehouse, mantendo qualidade analítica
adequada para a geração de indicadores de negócio. Os principais beneficiados são
estudantes, pesquisadores e profissionais da área de Sistemas de Informação que buscam
referências práticas sobre arquiteturas modernas de dados.

---

### 1.2 Problema de Pesquisa

Em que medida uma arquitetura Lakehouse com camadas Bronze, Silver e Gold, implementada
com tecnologias abertas, é capaz de atender às demandas de escalabilidade e
custo-benefício para análise de dados de e-commerce, mantendo nível de qualidade
analítica comparável ao oferecido por soluções de Data Warehouse para a geração de
indicadores de negócio?

---

### 1.3 Hipótese

A hipótese deste trabalho é que a arquitetura Lakehouse, implementada com Apache Spark
e Delta Lake em camadas Bronze, Silver e Gold, oferece melhor relação custo-benefício
e escalabilidade horizontal em comparação ao modelo tradicional de Data Warehouse,
mantendo qualidade analítica equivalente para a geração de indicadores de negócio em
cenários de e-commerce. Para fins de verificação empírica, a hipótese é considerada
confirmada se, ao final da implementação, forem atendidos simultaneamente os seguintes
critérios mensuráveis:

- **Completude dos dados** na camada Gold igual ou superior a **95%**, calculada como
  proporção de campos obrigatórios preenchidos sobre o total esperado.
- **Consistência entre camadas** igual ou superior a **98%**, medida como proporção de
  registros da camada Bronze que chegam íntegros à camada Gold, sem perda não justificada.
- **Latência de consulta analítica** na camada Gold inferior ou igual a **1,5 vezes** a
  latência das mesmas queries executadas no Data Warehouse de referência (PostgreSQL com
  Star Schema equivalente), para os cinco indicadores de negócio definidos no protocolo
  de avaliação.
- **Capacidade analítica completa**, definida como a geração bem-sucedida dos cinco
  indicadores de negócio propostos no Power BI, com resultados coerentes com o dataset
  simulado e idênticos aos produzidos pelo DW de referência.

---

### 1.4 Objetivos

O objetivo geral deste trabalho é **implementar uma arquitetura Lakehouse com camadas
Bronze, Silver e Gold para análise de dados de e-commerce**, avaliando sua viabilidade
como alternativa escalável e de baixo custo frente ao Data Warehouse tradicional.

Para alcançar o objetivo geral, definem-se os seguintes objetivos específicos:

- **Analisar** as limitações dos Data Warehouses tradicionais e modernos no contexto de
  e-commerce, considerando aspectos de custo, escalabilidade, flexibilidade de esquema e
  dependência de fornecedor, com base em revisão teórica comparativa.

- **Projetar** o modelo dimensional Star Schema para suporte à análise de indicadores de
  vendas, clientes e produtos na camada Gold da arquitetura, definindo tabelas fato e
  dimensões alinhadas aos requisitos analíticos do domínio de e-commerce.

- **Implementar** o pipeline de dados nas camadas Bronze, Silver e Gold utilizando Apache
  Spark e Delta Lake, com ingestão a partir de uma API simulada de e-commerce, garantindo
  rastreabilidade, versionamento e qualidade dos dados em cada etapa.

- **Avaliar** a arquitetura proposta por meio das métricas de completude (≥ 95%),
  consistência entre camadas (≥ 98%) e latência de consulta (≤ 1,5× o DW de referência),
  comparando os resultados com um modelo de Data Warehouse convencional baseado em
  PostgreSQL e utilizando painéis interativos no Power BI como instrumento de validação.

---

### 1.5 Organização do Trabalho

Este trabalho está estruturado em cinco capítulos, organizados de forma a conduzir o
leitor desde a fundamentação teórica até os resultados e conclusões da pesquisa.

O **Capítulo 1** apresenta a introdução, compreendendo a motivação do trabalho, o problema
de pesquisa, a hipótese formulada com critérios mensuráveis, os objetivos geral e
específicos e a organização do documento.

O **Capítulo 2** desenvolve o referencial teórico, abordando os fundamentos de Big Data,
as arquiteturas de armazenamento e processamento de dados (Data Warehouse, Data Lake e
Lakehouse), os princípios de Engenharia de Dados, a modelagem dimensional e a qualidade
de dados, além das principais ferramentas tecnológicas utilizadas no projeto.

O **Capítulo 3** descreve a metodologia adotada, incluindo a classificação da pesquisa,
o ambiente de desenvolvimento, a especificação do dataset simulado, a arquitetura do
pipeline, o modelo dimensional Star Schema, o Data Warehouse de referência e o protocolo
de avaliação com métricas e critérios de aceitação.

O **Capítulo 4** apresentará os resultados obtidos com a implementação da arquitetura
Lakehouse, incluindo os valores das métricas de qualidade e desempenho, a validação dos
indicadores de negócio no Power BI e a comparação com o DW de referência PostgreSQL.

O **Capítulo 5** apresentará as conclusões do trabalho, respondendo à hipótese formulada
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

No contexto do comércio eletrônico, todas essas dimensões se manifestam de forma intensa:
plataformas digitais geram milhões de eventos diários — cliques, pedidos, avaliações,
interações em tempo real — provenientes de múltiplas fontes heterogêneas, exigindo
infraestruturas de dados capazes de ingerir, armazenar e processar esse fluxo contínuo
com baixa latência e alta confiabilidade (ARMBRUST et al., 2021).

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

#### 2.2.3 Arquitetura Lakehouse

A arquitetura Lakehouse, formalizada por Armbrust et al. (2021) em pesquisa do grupo
Databricks, representa uma convergência das abordagens de Data Warehouse e Data Lake,
propondo um paradigma unificado que preserva as vantagens de ambos os modelos enquanto
supera suas limitações individuais.

O Lakehouse é caracterizado por três elementos fundamentais (ARMBRUST et al., 2021):
(i) armazenamento aberto e econômico, com dados em formatos abertos como Parquet
armazenados em sistemas de baixo custo, eliminando dependência de formatos proprietários;
(ii) camada de metadados transacional, que implementa suporte a transações ACID sobre os
arquivos de dados, habilitando operações de atualização e controle de concorrência; e
(iii) desempenho analítico de nível comparável ao Data Warehouse, por meio de técnicas
como indexação, compactação de arquivos, cache e estatísticas de dados.

Essa arquitetura possibilita a unificação do ciclo de vida dos dados — desde a ingestão
bruta até a análise avançada e o aprendizado de máquina —, reduzindo redundâncias,
custos operacionais e inconsistências decorrentes da movimentação de dados entre sistemas
distintos (ARMBRUST et al., 2021).

#### 2.2.4 Quadro Comparativo das Arquiteturas

O Quadro 1 sintetiza as principais características das três arquiteturas discutidas,
permitindo a visualização objetiva das diferenças e complementaridades entre elas.

#### Quadro 1 — Comparativo entre Data Warehouse, Data Lake e Lakehouse

| Característica | Data Warehouse | Data Lake | Lakehouse |
| --- | --- | --- | --- |
| Definição de esquema | Na ingestão (schema-on-write) | No consumo (schema-on-read) | Na ingestão com evolução controlada |
| Tipos de dados suportados | Estruturados | Todos | Todos |
| Garantias ACID | Sim (banco relacional) | Não | Sim (Delta Lake) |
| Custo de armazenamento | Alto | Baixo | Baixo |
| Escalabilidade | Vertical | Horizontal | Horizontal |
| Desempenho analítico | Alto | Variável | Alto |
| Suporte a aprendizado de máquina | Limitado | Nativo | Nativo |
| Versionamento de dados | Não | Não | Sim (time travel) |
| Dependência de fornecedor | Alta | Baixa | Baixa (formatos abertos) |
| Governança de dados | Madura | Imatura | Em evolução |

Fonte: elaborado pelo autor com base em Armbrust et al. (2021), Fang (2015) e Zaharia et al. (2021).

---

### 2.3 Arquitetura em Camadas: Bronze, Silver e Gold

A organização dos dados em camadas é um padrão arquitetural amplamente adotado em
implementações de Lakehouse e Engenharia de Dados moderna. O modelo de três camadas —
Bronze, Silver e Gold —, descrito por Zaharia et al. (2021) e amplamente utilizado em
implementações industriais com Delta Lake, estrutura o fluxo de dados de acordo com seu
grau de refinamento e propósito de uso.

A **camada Bronze** recebe os dados em seu estado bruto, diretamente das fontes de origem,
sem transformações. Seu propósito é preservar o histórico completo dos dados ingeridos,
garantindo rastreabilidade e a possibilidade de reprocessamento a partir do ponto de
origem. Os dados nessa camada são armazenados no formato original ou convertidos para
formatos eficientes como Parquet, mas sem aplicação de regras de negócio ou limpeza.

A **camada Silver** representa a fase de refinamento dos dados. Nela são aplicados processos
de limpeza, padronização de formatos, remoção de duplicatas, validação de integridade
referencial e enriquecimento com informações complementares. O resultado é um conjunto
de dados confiável, consistente e pronto para consumo por diferentes fluxos analíticos
ou de aprendizado de máquina.

A **camada Gold** é a camada analítica da arquitetura. Os dados, já tratados e validados,
são organizados em modelos dimensionais otimizados para consulta — tipicamente no formato
Star Schema —, com foco na geração de indicadores de negócio e na alimentação de
ferramentas de visualização e relatórios (ZAHARIA et al., 2021; KIMBALL; ROSS, 2013).
Essa separação em camadas promove isolamento de falhas, controle de qualidade progressivo,
rastreabilidade completa do ciclo de vida do dado e flexibilidade para que diferentes
equipes consumam os dados no nível de refinamento adequado às suas necessidades.

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
distribuído do próprio ambiente analítico (VASSILIADIS, 2009). Esse modelo é natural na
arquitetura Lakehouse, onde a camada Bronze recebe os dados brutos e as transformações
são aplicadas progressivamente nas camadas Silver e Gold.

---

### 2.5 Modelagem Dimensional

A modelagem dimensional é uma técnica de projeto de banco de dados voltada para sistemas
de suporte à decisão, desenvolvida por Ralph Kimball e sistematizada em Kimball e Ross
(2013). Seu objetivo é organizar os dados de forma intuitiva para usuários de negócio e
otimizada para ferramentas de consulta analítica — denominadas OLAP (Processamento
Analítico Online).

Os dois elementos fundamentais da modelagem dimensional são:

- **Tabela Fato:** registra eventos ou transações de negócio mensuráveis — como vendas,
  pedidos e pagamentos —, contendo métricas numéricas e chaves estrangeiras que
  referenciam as tabelas dimensão.

- **Tabelas Dimensão:** fornecem o contexto descritivo para os fatos, respondendo às
  perguntas quem, o quê, quando e onde. Exemplos típicos incluem as dimensões de
  Cliente, Produto, Tempo e Localização.

O **Star Schema** (Esquema Estrela) é o esquema dimensional mais utilizado, no qual a
tabela fato central é diretamente conectada às tabelas dimensão por meio de chaves,
formando uma estrutura que se assemelha a uma estrela. Essa simplicidade estrutural
facilita a compreensão pelos usuários de negócio e maximiza o desempenho das consultas
analíticas (KIMBALL; ROSS, 2013). No contexto deste trabalho, a camada Gold implementará
um Star Schema com tabela fato de vendas e dimensões de cliente, produto, tempo e
categoria.

---

### 2.6 Qualidade de Dados

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

Em arquiteturas Lakehouse, a qualidade de dados é gerenciada progressivamente entre as
camadas: na camada Bronze, os dados são ingeridos sem filtros, preservando o histórico;
na camada Silver, são aplicadas regras de validação e limpeza; na camada Gold, os dados
atendem a um padrão de qualidade estabelecido para consumo analítico (ZAHARIA et al.,
2021). Essa abordagem garante que os indicadores de negócio gerados sejam baseados em
dados confiáveis e auditáveis. Neste trabalho, a avaliação utilizará métricas de
completude (≥ 95%) e consistência entre camadas (≥ 98%) como critérios mensuráveis.

---

### 2.7 Ferramentas e Tecnologias

#### 2.7.1 Apache Spark

O Apache Spark é um arcabouço de processamento distribuído de dados em larga escala,
originalmente desenvolvido na Universidade da Califórnia em Berkeley e posteriormente
incorporado à Apache Software Foundation. Zaharia et al. (2016) descrevem o Spark como
um motor unificado para processamento de Big Data, capaz de executar cargas de trabalho
em lote, em tempo real (streaming), consultas SQL, aprendizado de máquina e processamento
de grafos por meio de uma interface de programação unificada.

Sua principal vantagem em relação ao modelo MapReduce é o processamento em memória, que
reduz drasticamente a latência em cargas de trabalho iterativas e interativas (ZAHARIA
et al., 2016). No contexto deste trabalho, o Apache Spark é a principal ferramenta de
transformação utilizada para processar dados entre as camadas Bronze, Silver e Gold.

#### 2.7.2 Delta Lake

O Delta Lake é uma camada de armazenamento de código aberto desenvolvida pela Databricks
que adiciona garantias transacionais ACID ao armazenamento de dados em arquivos Parquet.
Zaharia et al. (2021) descrevem o Delta Lake como uma solução que resolve os principais
desafios do Data Lake tradicional: ausência de transações, inconsistência em leituras
concorrentes, dificuldade de atualizações e exclusões, e falta de versionamento.

As principais funcionalidades do Delta Lake incluem:

- **Transações ACID:** garantem atomicidade, consistência, isolamento e durabilidade das
  operações, mesmo em ambientes distribuídos com múltiplos escritores concorrentes.
- **Viagem no tempo (time travel):** permite acessar versões históricas dos dados por
  meio de instantâneos, habilitando auditoria, reprodutibilidade e reversão de operações.
- **Aplicação e evolução de esquema:** valida automaticamente a conformidade do esquema
  na escrita e permite sua evolução controlada ao longo do tempo (ZAHARIA et al., 2021).

#### 2.7.3 Microsoft Power BI

O Microsoft Power BI é uma plataforma de Inteligência de Negócios voltada para a criação
de relatórios e painéis interativos. Utilizado como camada de consumo da camada Gold da
arquitetura Lakehouse, o Power BI transforma os dados modelados dimensionalmente em
visualizações acessíveis a usuários de negócio. Sua integração com fontes Parquet e
Delta Lake torna-o adequado para validação dos indicadores analíticos gerados pelo
pipeline proposto (MICROSOFT, 2023).

---

---

## CAPÍTULO 3 — METODOLOGIA

### 3.1 Classificação da Pesquisa

Do ponto de vista de sua natureza, este trabalho configura-se como uma **pesquisa
aplicada**, pois objetiva a geração de conhecimento voltado à solução de um problema
prático e concreto: a implementação de uma arquitetura de dados funcional para análise
de e-commerce (GIL, 2002). Quanto aos seus objetivos, classifica-se como
**exploratório-descritiva**: exploratória pela relativa escassez de estudos aplicados
que combinem arquitetura Lakehouse e validação empírica de qualidade analítica no
domínio de e-commerce; descritiva por registrar sistematicamente as características do
pipeline implementado e seus resultados mensuráveis.

Em relação à abordagem do problema, a pesquisa é **mista (quali-quantitativa)**: adota
instrumentos quantitativos para coleta e análise de métricas de desempenho e qualidade
de dados, e abordagem qualitativa para análise comparativa entre a arquitetura Lakehouse
e o modelo de Data Warehouse de referência. Quanto ao procedimento técnico, enquadra-se
como **estudo de caso experimental**, pois implementa um sistema de software completo —
desde a geração de dados simulados até a camada analítica — e avalia seus resultados em
condições controladas (YIN, 2015).

---

### 3.2 Ambiente de Desenvolvimento

A implementação deste trabalho é realizada em ambiente local com as seguintes
especificações:

**Hardware:** Sistema Operacional Microsoft Windows 11 Pro, com processador compatível
com execução de cargas Spark em modo local e mínimo de 8 GB de memória RAM.

#### Quadro 2 — Ferramentas e versões utilizadas

| Ferramenta | Versão | Finalidade |
| --- | --- | --- |
| Python | 3.11 | Linguagem principal |
| Apache Spark | 3.5.1 | Processamento distribuído entre camadas |
| Delta Lake | 3.2.0 | Armazenamento transacional ACID |
| FastAPI | 0.115.0 | API simuladora de e-commerce |
| Pandas | 2.2.2 | Manipulação de dados tabulares |
| PyArrow | 17.0.0 | Serialização Parquet |
| Faker | 26.0.0 | Geração de dados sintéticos |
| PostgreSQL | 15+ | Banco do DW de referência |
| SQLAlchemy | 2.0+ | Conexão Python — PostgreSQL |
| Power BI Desktop | Versão atual | Camada de visualização analítica |

Fonte: elaborado pelo autor.

O Apache Spark é executado em **modo local** (`spark://local[*]`), utilizando todos os
núcleos de processamento disponíveis, representando um ambiente realista para
organizações de pequeno e médio porte sem infraestrutura de cluster dedicada.

---

### 3.3 Especificação do Dataset Simulado

Os dados utilizados são inteiramente sintéticos, gerados por uma API desenvolvida com
FastAPI e populada pela biblioteca Faker. Essa abordagem garante controle total sobre
volume, distribuição e qualidade dos dados, além de eliminar questões de privacidade e
conformidade com a Lei Geral de Proteção de Dados (LGPD).

#### 3.3.1 Entidades e Volume

O dataset simula 24 meses de operação de uma plataforma de e-commerce fictícia.

#### Quadro 3 — Entidades do dataset simulado

| Entidade | Volume | Descrição |
| --- | --- | --- |
| Clientes | 1.000 registros | Dados cadastrais com cidade, estado, região e segmento |
| Categorias | 20 registros | Hierarquia de categorias de produtos |
| Produtos | 500 registros | Catálogo com preço, categoria e disponibilidade |
| Pedidos | 10.000 registros | Cabeçalho com status e canal de venda |
| Itens de Pedido | ~30.000 registros | Produto, quantidade e desconto por linha |
| Pagamentos | 10.000 registros | Método, status e data de pagamento |

Fonte: elaborado pelo autor.

#### 3.3.2 Imperfeições Intencionais do Dataset

Para tornar o cenário de testes realista, o dataset introduz intencionalmente
imperfeições que o pipeline deverá tratar:

- **5%** dos registros de clientes com campos nulos em cidade ou estado
- **3%** dos itens de pedido com quantidade ou preço negativos
- **2%** dos pedidos duplicados (simulando falha de retry na API de origem)
- **1%** dos pagamentos com datas fora do intervalo esperado

Essas imperfeições permitem validar a efetividade das regras de qualidade da camada
Silver e mensurar completude e consistência dos dados na camada Gold.

---

### 3.4 Arquitetura do Pipeline de Dados

#### 3.4.1 Camada Bronze — Ingestão Bruta

A camada Bronze realiza a ingestão dos dados diretamente dos endpoints da API, sem
nenhuma transformação. Os dados são armazenados em Delta Lake particionado por data de
ingestão, com metadados de rastreabilidade (`_data_ingestao`, `_origem`), em
`data/raw/bronze/{entidade}/`.

#### 3.4.2 Camada Silver — Refinamento e Qualidade

A camada Silver aplica regras de qualidade e padronização sobre os dados da camada
Bronze. As transformações incluem: remoção de duplicatas por chave de negócio;
preenchimento ou exclusão de registros com campos obrigatórios nulos; validação de
domínio (preços positivos, datas válidas, status permitidos); padronização de tipos de
dados; normalização de strings; e geração de campos derivados. Saída em
`data/processed/silver/{entidade}/`.

#### 3.4.3 Camada Gold — Modelo Dimensional

A camada Gold organiza os dados refinados em Star Schema, com chaves surrogate
geradas, gravação em Delta Lake em `data/analytical/gold/{tabela}/` e exportação
para Power BI.

---

### 3.5 Modelo Dimensional — Star Schema

#### Quadro 4 — Tabela Fato: fato_vendas

| Coluna | Tipo | Descrição |
| --- | --- | --- |
| id_fato | BIGINT | Chave surrogate |
| id_cliente | INT | FK → dim_cliente |
| id_produto | INT | FK → dim_produto |
| id_tempo | INT | FK → dim_tempo |
| id_categoria | INT | FK → dim_categoria |
| id_pedido | STRING | Chave de negócio |
| quantidade | INT | Itens vendidos |
| valor_bruto | DECIMAL(10,2) | Valor sem desconto |
| desconto | DECIMAL(10,2) | Desconto aplicado |
| valor_liquido | DECIMAL(10,2) | Valor final |
| metodo_pagamento | STRING | Forma de pagamento |

Fonte: elaborado pelo autor.

As tabelas dimensão são: **dim_cliente** (id, nome, cidade, estado, região, segmento),
**dim_produto** (id, nome, preço unitário, categoria), **dim_tempo** (id YYYYMMDD, data,
dia, mês, trimestre, ano, dia da semana, flag fim de semana) e **dim_categoria**
(id, nome, descrição).

---

### 3.6 Modelo de Referência — Data Warehouse Convencional

Para viabilizar a comparação empírica proposta na hipótese, é implementado um Data
Warehouse de referência baseado em PostgreSQL, carregado via ETL tradicional com pandas
e SQLAlchemy, sem particionamento Delta, sem otimização de arquivos e sem time travel.
O DW de referência adota o **mesmo Star Schema** da camada Gold, isolando as diferenças
arquiteturais como variável de comparação.

#### Quadro 5 — Diferenças entre Lakehouse e DW de Referência

| Característica | Lakehouse (Delta Lake) | DW Referência (PostgreSQL) |
| --- | --- | --- |
| Armazenamento | Parquet + Delta Log | Tabelas relacionais em disco |
| Garantias ACID | Nativas (Delta Lake) | Nativas (PostgreSQL) |
| Esquema | Evolução controlada | Rígido (DDL explícito) |
| Particionamento | Automático por coluna | Manual (índices) |
| Integração com ML | Nativa (Spark) | Via exportação externa |
| Versionamento | Time travel nativo | Inexistente |
| Escalabilidade | Horizontal | Vertical |

Fonte: elaborado pelo autor.

---

### 3.7 Protocolo de Avaliação

#### 3.7.1 Métricas de Qualidade de Dados

#### Quadro 6 — Métricas de qualidade e critérios de aceitação

| Métrica | Fórmula | Critério |
| --- | --- | --- |
| Completude | registros_completos / total_esperado × 100 | ≥ 95% |
| Consistência | registros_íntegros / total_bronze × 100 | ≥ 98% |
| Unicidade | (total − duplicatas) / total × 100 | = 100% |
| Acurácia de tipos | campos_tipados_corretamente / total × 100 | = 100% |

Fonte: elaborado pelo autor com base em Vassiliadis (2009).

#### 3.7.2 Métricas de Desempenho

As métricas de desempenho são coletadas com `time.time()` em Python e pelo Spark UI,
comparando tempo de carga e latência de consulta entre Lakehouse e DW de referência.
O critério de aceitação para latência é que o Lakehouse responda em tempo ≤ 1,5× o
tempo do PostgreSQL para as mesmas cinco queries analíticas padrão.

#### 3.7.3 Indicadores de Negócio Avaliados

1. Receita total por período (dia, mês, trimestre, ano)
2. Ticket médio por cliente e por região
3. Top 10 produtos por receita e por volume
4. Taxa de desconto médio por categoria
5. Distribuição de métodos de pagamento por período

Cada indicador é considerado **válido** quando: (a) produz resultado em ≤ 10 segundos
no ambiente local; (b) os valores são coerentes com o dataset simulado; e (c) o resultado
no Lakehouse é idêntico ao produzido pelo DW de referência para os mesmos dados.

---

### 3.8 Cronograma de Execução

#### Quadro 7 — Cronograma do projeto

| Etapa | Atividade | Período |
| --- | --- | --- |
| 1 | Revisão bibliográfica e fundamentação teórica | Março 2026 |
| 2 | Projeto da API simuladora e do Star Schema | Abril 2026 |
| 3 | Implementação da API e camada Bronze | Abril 2026 |
| 4 | Implementação da camada Silver | Maio 2026 |
| 5 | Implementação da camada Gold (Star Schema) | Maio 2026 |
| 6 | Implementação do DW de referência (PostgreSQL) | Maio 2026 |
| 7 | Desenvolvimento do painel Power BI | Junho 2026 |
| 8 | Coleta e análise das métricas de avaliação | Junho 2026 |
| 9 | Redação dos capítulos de resultados e conclusões | Julho 2026 |
| 10 | Revisão final e entrega do TCC | Agosto 2026 |

Fonte: elaborado pelo autor.

---

---

## REFERÊNCIAS BIBLIOGRÁFICAS

ARMBRUST, Michael et al. **Lakehouse: A New Generation of Open Platforms that Unify
Data Warehousing and Advanced Analytics**. In: Conference on Innovative Data Systems
Research (CIDR), 2021.

CHEN, Min; MAO, Shiwen; LIU, Yunhao. **Big Data: A Survey**. Mobile Networks and
Applications, v. 19, n. 2, p. 171–209, 2014.

DRECHSLER, Gunnar; SAUER, Stefan. **Cloud Data Warehousing: Challenges and
Opportunities**. Journal of Database Management, v. 34, n. 1, p. 1–25, 2023.

FANG, Hu. **Managing Data Lakes in Big Data Era: What's a Data Lake and Why Has It
Became Popular in Data Management Ecosystem**. In: IEEE International Conference on
Cyber Technology in Automation, Control, and Intelligent Systems (CYBER), 2015.

GIL, Antonio Carlos. **Como elaborar projetos de pesquisa**. 6. ed. São Paulo: Atlas,
2002.

INMON, William H. **Building the Data Warehouse**. 4. ed. Nova York: John Wiley & Sons,
2002.

KIMBALL, Ralph; ROSS, Margy. **The Data Warehouse Toolkit: The Definitive Guide to
Dimensional Modeling**. 3. ed. Indianápolis: John Wiley & Sons, 2013.

LANEY, Doug. **3D Data Management: Controlling Data Volume, Velocity, and Variety**.
META Group Research Note, 2001.

MICROSOFT. **Power BI Documentation**. Microsoft Docs, 2023. Nota: fonte técnica
primária de ferramenta de mercado.

STONEBRAKER, Michael; ÇETINTEMEL, Ugur. **One Size Fits All: An Idea Whose Time Has
Come and Gone**. In: Proceedings of the 21st International Conference on Data Engineering
(ICDE), 2005.

VASSILIADIS, Panos. **A Survey of Extract-Transform-Load Technology**. International
Journal of Data Warehousing and Mining, v. 5, n. 3, p. 1–27, 2009.

ZAHARIA, Matei et al. **Apache Spark: A Unified Engine for Big Data Processing**.
Communications of the ACM, v. 59, n. 11, p. 56–65, 2016.

ZAHARIA, Matei et al. **Delta Lake: High-Performance ACID Table Storage over Cloud
Object Stores**. Proceedings of the VLDB Endowment, v. 13, n. 12, p. 3411–3424, 2021.

YIN, Robert K. **Estudo de caso: planejamento e métodos**. 5. ed. Porto Alegre:
Bookman, 2015.
