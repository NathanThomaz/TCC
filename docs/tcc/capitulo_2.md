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

No contexto do comércio eletrônico, todas essas dimensões se manifestam de forma intensa:
plataformas digitais geram milhões de eventos diários — cliques, pedidos, avaliações,
interações em tempo real — provenientes de múltiplas fontes heterogêneas, exigindo
infraestruturas de dados capazes de ingerir, armazenar e processar esse fluxo contínuo
com baixa latência e alta confiabilidade (ARMBRUST et al., 2021).

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

### 2.2.3 Arquitetura Lakehouse

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

### 2.2.4 Quadro Comparativo das Arquiteturas

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
| Dependência de fornecedor | Alta (soluções proprietárias) | Baixa | Baixa (formatos abertos) |
| Governança de dados | Madura | Imatura | Em evolução |

Fonte: elaborado pelo autor com base em Armbrust et al. (2021), Fang (2015) e Zaharia
et al. (2021).

---

## 2.3 Arquitetura em Camadas: Bronze, Silver e Gold

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
arquitetura Lakehouse, onde a camada Bronze recebe os dados brutos e as transformações
são aplicadas progressivamente nas camadas Silver e Gold.

---

## 2.5 Modelagem Dimensional

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

## 2.6 Qualidade de Dados

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
dados confiáveis e auditáveis. Neste trabalho, a avaliação da qualidade analítica
utilizará métricas de completude (≥ 95%) e consistência entre camadas (≥ 98%) como
critérios mensuráveis de comparação com o DW de referência.

---

## 2.7 Ferramentas e Tecnologias

### 2.7.1 Apache Spark

O Apache Spark é um arcabouço de processamento distribuído de dados em larga escala,
originalmente desenvolvido na Universidade da Califórnia em Berkeley e posteriormente
incorporado à Apache Software Foundation. Zaharia et al. (2016) descrevem o Spark como
um motor unificado para processamento de Big Data, capaz de executar cargas de trabalho
em lote, em tempo real (streaming), consultas SQL, aprendizado de máquina e
processamento de grafos por meio de uma interface de programação unificada.

Sua principal vantagem em relação ao modelo MapReduce é o processamento em memória,
que reduz drasticamente a latência em cargas de trabalho iterativas e interativas
(ZAHARIA et al., 2016). No contexto deste trabalho, o Apache Spark é a principal
ferramenta de transformação utilizada para processar dados entre as camadas Bronze,
Silver e Gold, aproveitando sua capacidade de escalonamento horizontal e integração
nativa com o Delta Lake.

### 2.7.2 Delta Lake

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

### 2.7.3 Microsoft Power BI

O Microsoft Power BI é uma plataforma de Inteligência de Negócios voltada para a criação
de relatórios e painéis interativos. Utilizado como camada de consumo da camada Gold da
arquitetura Lakehouse, o Power BI transforma os dados modelados dimensionalmente em
visualizações acessíveis a usuários de negócio. Sua integração com fontes de dados
baseadas em Parquet e Delta Lake torna-o uma escolha adequada para validação dos
indicadores analíticos gerados pelo pipeline proposto neste trabalho. Por se tratar de
uma ferramenta de mercado amplamente utilizada, sua documentação é referenciada como
fonte técnica primária (MICROSOFT, 2023).

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

INMON, William H. **Building the Data Warehouse**. 4. ed. Nova York: John Wiley & Sons,
2002.

KIMBALL, Ralph; ROSS, Margy. **The Data Warehouse Toolkit: The Definitive Guide to
Dimensional Modeling**. 3. ed. Indianápolis: John Wiley & Sons, 2013.

LANEY, Doug. **3D Data Management: Controlling Data Volume, Velocity, and Variety**.
META Group Research Note, 2001.

MICROSOFT. **Power BI Documentation**. Microsoft Docs, 2023. Nota: referência técnica
de ferramenta de mercado, utilizada como fonte primária de documentação.

STONEBRAKER, Michael; ÇETINTEMEL, Ugur. **One Size Fits All: An Idea Whose Time Has
Come and Gone**. In: Proceedings of the 21st International Conference on Data Engineering
(ICDE), 2005.

VASSILIADIS, Panos. **A Survey of Extract-Transform-Load Technology**. International
Journal of Data Warehousing and Mining, v. 5, n. 3, p. 1–27, 2009.

ZAHARIA, Matei et al. **Apache Spark: A Unified Engine for Big Data Processing**.
Communications of the ACM, v. 59, n. 11, p. 56–65, 2016.

ZAHARIA, Matei et al. **Delta Lake: High-Performance ACID Table Storage over Cloud
Object Stores**. Proceedings of the VLDB Endowment, v. 13, n. 12, p. 3411–3424, 2021.
