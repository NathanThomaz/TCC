# Capítulo 1 — Introdução

## 1.1 Motivação

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
arquiteturas, no entanto, foram concebidas em um contexto tecnológico distinto do atual, no
qual o volume, a variedade e a velocidade dos dados eram substancialmente menores. Com o
advento do Big Data, caracterizado por Laney (2001) pelas dimensões de volume, velocidade e
variedade, os DWs tradicionais passaram a apresentar limitações estruturais significativas:
dependência de infraestrutura proprietária de alto custo, esquemas de dados rígidos definidos
no momento da ingestão (schema-on-write) e escalabilidade predominantemente vertical
(INMON, 2002).

Embora soluções modernas de Data Warehouse em nuvem, como Snowflake, Google BigQuery
e Amazon Redshift, tenham mitigado parte dessas limitações — especialmente no que se refere
à escalabilidade elástica e ao modelo de custo por uso —, elas introduzem novas dependências
de fornecedores (vendor lock-in), custos elevados para armazenamento de dados brutos e
semiestruturados, e dificuldades de integração com fluxos de aprendizado de máquina e
processamento em tempo real (STONEBRAKER; ÇETINTEMEL, 2005; ZAHARIA et al., 2016).
Drechsler e Sauer (2023) observam que, mesmo em ambientes de nuvem, o custo total de
propriedade de soluções de DW tende a ser elevado para organizações de pequeno e médio
porte quando os dados crescem exponencialmente.

Diante dessas limitações, o conceito de Data Lake emergiu como alternativa, propondo o
armazenamento de dados em formato bruto e em escala massiva a baixo custo. Contudo,
estudos demonstram que Data Lakes sem governança adequada degeneram em repositórios de
dados não gerenciados, sem qualidade garantida e de difícil consumo analítico — fenômeno
conhecido como pântano de dados (data swamp) (FANG, 2015). A arquitetura Lakehouse,
proposta por Armbrust et al. (2021), surge precisamente para endereçar essa dualidade,
combinando a flexibilidade e o baixo custo de armazenamento dos Data Lakes com as
garantias de qualidade, transacionalidade e desempenho analítico dos Data Warehouses.

A relevância acadêmica do tema é reforçada pela escassez de estudos aplicados que
demonstrem, de forma prática e mensurável, a implementação de arquiteturas Lakehouse
voltadas ao domínio do comércio eletrônico. Embora trabalhos teóricos e implementações
corporativas sejam documentados na literatura técnica (ZAHARIA et al., 2021), poucos
trabalhos acadêmicos apresentam pipelines completos com validação empírica da qualidade
analítica em cenários de e-commerce — lacuna que este trabalho se propõe a preencher.

Diante desse cenário, o presente trabalho propõe a implementação de uma arquitetura
Lakehouse estruturada em camadas Bronze, Silver e Gold, utilizando tecnologias abertas como
Apache Spark e Delta Lake, aplicada a dados simulados de e-commerce. A proposta visa
demonstrar que essa abordagem constitui uma alternativa viável, escalável e de baixo custo
frente às soluções tradicionais de Data Warehouse, mantendo qualidade analítica adequada
para a geração de indicadores de negócio. Os principais beneficiados são estudantes,
pesquisadores e profissionais da área de Sistemas de Informação que buscam referências
práticas sobre arquiteturas modernas de dados.

---

## 1.2 Problema de Pesquisa

Em que medida uma arquitetura Lakehouse com camadas Bronze, Silver e Gold, implementada
com tecnologias abertas, é capaz de atender às demandas de escalabilidade e custo-benefício
para análise de dados de e-commerce, mantendo nível de qualidade analítica comparável ao
oferecido por soluções de Data Warehouse para a geração de indicadores de negócio?

---

## 1.3 Hipótese

A hipótese deste trabalho é que a arquitetura Lakehouse, implementada com Apache Spark e
Delta Lake em camadas Bronze, Silver e Gold, oferece melhor relação custo-benefício e
escalabilidade horizontal em comparação ao modelo tradicional de Data Warehouse,
mantendo qualidade analítica equivalente para a geração de indicadores de negócio em
cenários de e-commerce. Para fins de verificação empírica, a hipótese é considerada
confirmada se, ao final da implementação, forem atendidos simultaneamente os seguintes
critérios mensuráveis:

- **Completude dos dados** na camada Gold igual ou superior a **95%**, calculada como
  proporção de campos obrigatórios preenchidos sobre o total esperado.
- **Consistência entre camadas** igual ou superior a **98%**, medida como proporção de
  registros da camada Bronze que chegam íntegros à camada Gold após as transformações
  Silver, sem perda não justificada de registros.
- **Latência de consulta analítica** na camada Gold inferior ou igual a **1,5 vezes** a
  latência das mesmas queries executadas no modelo de Data Warehouse de referência
  (PostgreSQL com Star Schema equivalente), para os cinco indicadores de negócio
  definidos no protocolo de avaliação.
- **Capacidade analítica completa**, definida como a geração bem-sucedida dos cinco
  indicadores de negócio propostos no Power BI, com resultados coerentes com o dataset
  simulado e idênticos aos produzidos pelo DW de referência.

---

## 1.4 Objetivos

O objetivo geral deste trabalho é **implementar uma arquitetura Lakehouse com camadas
Bronze, Silver e Gold para análise de dados de e-commerce**, avaliando sua viabilidade como
alternativa escalável e de baixo custo frente ao Data Warehouse tradicional.

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
  PostgreSQL, utilizando painéis interativos no Power BI como instrumento de validação
  analítica.

---

## 1.5 Organização do Trabalho

Este trabalho está estruturado em cinco capítulos, organizados de forma a conduzir o leitor
desde a fundamentação teórica até os resultados e conclusões da pesquisa.

O **Capítulo 1** apresenta a introdução, compreendendo a motivação do trabalho, o problema
de pesquisa, a hipótese formulada com critérios mensuráveis, os objetivos geral e específicos
e a organização do documento.

O **Capítulo 2** desenvolve o referencial teórico, abordando os fundamentos de Big Data,
as arquiteturas de armazenamento e processamento de dados (Data Warehouse, Data Lake e
Lakehouse), os princípios de Engenharia de Dados, a modelagem dimensional e a qualidade
de dados, além das principais ferramentas tecnológicas utilizadas no projeto.

O **Capítulo 3** descreve a metodologia adotada, incluindo a classificação da pesquisa,
o ambiente de desenvolvimento, a especificação do dataset simulado, a arquitetura do
pipeline, o modelo dimensional Star Schema, o Data Warehouse de referência e o protocolo
de avaliação com métricas e critérios de aceitação.

O **Capítulo 4** apresenta os resultados obtidos com a implementação da arquitetura
Lakehouse, incluindo a análise do pipeline de dados, os valores das métricas de qualidade
e desempenho, a validação dos indicadores de negócio gerados no Power BI e a comparação
com o DW de referência PostgreSQL.

O **Capítulo 5** apresenta as conclusões do trabalho, respondendo à hipótese formulada
com base nos critérios mensuráveis definidos, discutindo as limitações da pesquisa e
apontando direções para trabalhos futuros.

---

## Referências

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

STONEBRAKER, Michael; ÇETINTEMEL, Ugur. **One Size Fits All: An Idea Whose Time
Has Come and Gone**. In: Proceedings of the 21st International Conference on Data
Engineering (ICDE), 2005.

VASSILIADIS, Panos. **A Survey of Extract-Transform-Load Technology**. International
Journal of Data Warehousing and Mining, v. 5, n. 3, p. 1–27, 2009.

ZAHARIA, Matei et al. **Apache Spark: A Unified Engine for Big Data Processing**.
Communications of the ACM, v. 59, n. 11, p. 56–65, 2016.

ZAHARIA, Matei et al. **Delta Lake: High-Performance ACID Table Storage over Cloud
Object Stores**. Proceedings of the VLDB Endowment, v. 13, n. 12, p. 3411–3424, 2021.

YIN, Robert K. **Estudo de caso: planejamento e métodos**. 5. ed. Porto Alegre:
Bookman, 2015.
