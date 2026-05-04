# Capítulo 3 — Metodologia

## 3.1 Classificação da Pesquisa

Do ponto de vista de sua natureza, este trabalho configura-se como uma **pesquisa
aplicada**, pois objetiva a geração de conhecimento voltado à solução de um problema
prático e concreto: a implementação de uma arquitetura de dados funcional para análise
de e-commerce (GIL, 2002). Quanto aos seus objetivos, classifica-se como **exploratório-
descritiva**: exploratória pela relativa escassez de estudos aplicados que combinem
arquitetura Lakehouse e validação empírica de qualidade analítica no domínio de
e-commerce; descritiva por registrar sistematicamente as características do pipeline
implementado e seus resultados mensuráveis.

Em relação à abordagem do problema, a pesquisa é **mista (quali-quantitativa)**: adota
instrumentos quantitativos para coleta e análise de métricas de desempenho e qualidade
de dados, e abordagem qualitativa para análise comparativa entre a arquitetura Lakehouse
e o modelo de Data Warehouse de referência. Quanto ao procedimento técnico, enquadra-se
como **estudo de caso experimental**, pois implementa um sistema de software completo —
desde a geração de dados simulados até a camada analítica — e avalia seus resultados em
condições controladas (YIN, 2015).

---

## 3.2 Ambiente de Desenvolvimento

A implementação deste trabalho é realizada em ambiente local, com as seguintes
especificações de hardware e software:

**Hardware:**
- Sistema Operacional: Microsoft Windows 11 Pro
- Processador: compatível com execução de cargas Spark em modo local
- Memória RAM: mínimo 8 GB (recomendado 16 GB para execução do Spark)

**Software e versões:**

| Ferramenta | Versão | Finalidade |
|---|---|---|
| Python | 3.11 | Linguagem principal do projeto |
| Apache Spark | 3.5.1 | Processamento distribuído entre camadas |
| Delta Lake | 3.2.0 | Armazenamento transacional ACID |
| FastAPI | 0.115.0 | API simuladora de e-commerce |
| Pandas | 2.2.2 | Manipulação de dados tabulares |
| PyArrow | 17.0.0 | Serialização Parquet |
| Faker | 26.0.0 | Geração de dados sintéticos |
| PostgreSQL | 15+ | Banco do DW de referência para comparação |
| SQLAlchemy | 2.0+ | Conexão Python → PostgreSQL |
| Power BI Desktop | Versão atual | Camada de visualização analítica |

O Apache Spark é executado em **modo local** (`spark://local[*]`), utilizando todos os
núcleos de processamento disponíveis na máquina, o que representa um ambiente realista
para organizações de pequeno e médio porte sem infraestrutura de cluster dedicada.

---

## 3.3 Especificação do Dataset Simulado

Os dados utilizados neste trabalho são inteiramente sintéticos, gerados por uma API
desenvolvida com FastAPI e populada pela biblioteca Faker. Essa abordagem garante o
controle total sobre o volume, distribuição e qualidade dos dados, além de eliminar
questões de privacidade e conformidade com a Lei Geral de Proteção de Dados (LGPD).

### 3.3.1 Entidades e Volume

O dataset simula 24 meses de operação de uma plataforma de e-commerce fictícia, com
as seguintes entidades e volumes:

| Entidade | Volume | Descrição |
|---|---|---|
| Clientes | 1.000 registros | Dados cadastrais com cidade, estado, região e segmento |
| Categorias | 20 registros | Hierarquia de categorias de produtos |
| Produtos | 500 registros | Catálogo com preço, categoria e disponibilidade |
| Pedidos | 10.000 registros | Cabeçalho de pedidos com status e canal de venda |
| Itens de Pedido | ~30.000 registros | Linha de pedido com produto, quantidade e desconto |
| Pagamentos | 10.000 registros | Método, status e data de pagamento |

### 3.3.2 Endpoints da API

A API expõe os seguintes endpoints para ingestão na camada Bronze:

| Método | Rota | Retorno |
|---|---|---|
| GET | `/clientes` | Lista de clientes com paginação |
| GET | `/produtos` | Catálogo de produtos |
| GET | `/categorias` | Hierarquia de categorias |
| GET | `/pedidos` | Pedidos com filtro por data |
| GET | `/itens-pedido` | Itens por pedido |
| GET | `/pagamentos` | Pagamentos por período |

### 3.3.3 Distribuição e Qualidade Intencional dos Dados

Para tornar o cenário de testes realista, o dataset simulado introduz intencionalmente
imperfeições que o pipeline de transformação deverá tratar:

- **5% dos registros** de clientes com campos nulos em cidade ou estado
- **3% dos itens de pedido** com quantidade ou preço negativos (erros de digitação)
- **2% dos pedidos** duplicados (simulando falha de retry na API de origem)
- **Datas fora do intervalo** esperado em 1% dos pagamentos

Essas imperfeições permitem validar a efetividade das regras de qualidade aplicadas na
camada Silver e mensurar a completude e consistência dos dados na camada Gold.

---

## 3.4 Arquitetura do Pipeline de Dados

O pipeline de dados é implementado seguindo o padrão de três camadas da arquitetura
Lakehouse, com todas as tabelas armazenadas no formato Delta Lake.

### 3.4.1 Camada Bronze — Ingestão Bruta

A camada Bronze realiza a ingestão dos dados diretamente dos endpoints da API, sem
nenhuma transformação. Os dados são armazenados em formato Delta Lake particionado por
data de ingestão, preservando o histórico completo e garantindo rastreabilidade.

**Processo:**
1. Chamada HTTP aos endpoints da API via `requests` ou `httpx`
2. Conversão do JSON para DataFrame Spark
3. Adição de metadados de ingestão (`_data_ingestao`, `_origem`)
4. Gravação em Delta Lake no diretório `data/raw/bronze/{entidade}/`

### 3.4.2 Camada Silver — Refinamento e Qualidade

A camada Silver aplica as regras de qualidade e padronização sobre os dados da camada
Bronze. Cada regra é documentada e auditável.

**Transformações aplicadas:**
- Remoção de registros duplicados com base em chave de negócio
- Preenchimento ou exclusão de registros com campos obrigatórios nulos
- Validação de domínio (preços positivos, datas válidas, status permitidos)
- Padronização de tipos de dados (datas como `DateType`, valores como `DecimalType`)
- Normalização de strings (trim, lowercase, remoção de caracteres especiais)
- Enriquecimento com campos derivados (ex: `valor_liquido = valor_bruto - desconto`)

**Saída:** tabelas Delta Lake em `data/processed/silver/{entidade}/`

### 3.4.3 Camada Gold — Modelo Dimensional

A camada Gold organiza os dados refinados da camada Silver em um modelo dimensional
Star Schema, otimizado para consultas analíticas no Power BI.

**Processo:**
1. Leitura das tabelas Silver
2. Construção das tabelas dimensão com chaves surrogate
3. Construção da tabela fato com resolução das chaves
4. Gravação em Delta Lake em `data/analytical/gold/{tabela}/`
5. Exportação para formatos compatíveis com Power BI (Parquet ou conector Delta)

---

## 3.5 Modelo Dimensional — Star Schema

O modelo dimensional implementado na camada Gold é composto por uma tabela fato
central e quatro tabelas dimensão, conforme descrito abaixo.

### 3.5.1 Tabela Fato: fato_vendas

| Coluna | Tipo | Descrição |
|---|---|---|
| id_fato | BIGINT | Chave surrogate da linha |
| id_cliente | INT | FK → dim_cliente |
| id_produto | INT | FK → dim_produto |
| id_tempo | INT | FK → dim_tempo |
| id_categoria | INT | FK → dim_categoria |
| id_pedido | STRING | Chave de negócio do pedido |
| quantidade | INT | Quantidade de itens vendidos |
| valor_bruto | DECIMAL(10,2) | Valor sem desconto |
| desconto | DECIMAL(10,2) | Valor do desconto aplicado |
| valor_liquido | DECIMAL(10,2) | Valor final da venda |
| metodo_pagamento | STRING | Forma de pagamento utilizada |

### 3.5.2 Tabelas Dimensão

**dim_cliente**

| Coluna | Tipo | Descrição |
|---|---|---|
| id_cliente | INT | Chave surrogate |
| nome | STRING | Nome do cliente |
| cidade | STRING | Cidade de cadastro |
| estado | STRING | UF |
| regiao | STRING | Norte, Nordeste, Centro-Oeste, Sudeste, Sul |
| segmento | STRING | Pessoa Física / Pessoa Jurídica |

**dim_produto**

| Coluna | Tipo | Descrição |
|---|---|---|
| id_produto | INT | Chave surrogate |
| nome_produto | STRING | Nome do produto |
| preco_unitario | DECIMAL(10,2) | Preço de referência |
| id_categoria | INT | FK → dim_categoria |

**dim_tempo**

| Coluna | Tipo | Descrição |
|---|---|---|
| id_tempo | INT | Chave surrogate (YYYYMMDD) |
| data | DATE | Data completa |
| dia | INT | Dia do mês |
| mes | INT | Mês (1–12) |
| nome_mes | STRING | Janeiro, Fevereiro… |
| trimestre | INT | Trimestre (1–4) |
| ano | INT | Ano |
| dia_semana | STRING | Segunda, Terça… |
| flag_fim_semana | BOOLEAN | Sábado ou domingo |

**dim_categoria**

| Coluna | Tipo | Descrição |
|---|---|---|
| id_categoria | INT | Chave surrogate |
| nome_categoria | STRING | Nome da categoria |
| descricao | STRING | Descrição da categoria |

---

## 3.6 Modelo de Referência — Data Warehouse Convencional

Para possibilitar a comparação empírica proposta na hipótese deste trabalho, é
implementado um **Data Warehouse de referência** baseado em PostgreSQL, carregado
via processo ETL tradicional (pandas + SQLAlchemy), sem os benefícios de particionamento
Delta, otimização de arquivos ou suporte a ACID avançado.

O DW de referência adota o **mesmo Star Schema** da camada Gold do Lakehouse, garantindo
que a comparação seja isolada sobre as diferenças arquiteturais — e não sobre diferenças
no modelo de dados. As diferenças fundamentais entre as duas abordagens são:

| Característica | Lakehouse (Delta Lake) | DW Referência (PostgreSQL) |
|---|---|---|
| Armazenamento | Parquet + Delta Log (objeto) | Tabelas relacionais em disco |
| Garantias ACID | Nativas (Delta Lake) | Nativas (PostgreSQL) |
| Esquema | Evolução controlada | Rígido (DDL explícito) |
| Particionamento | Automático por coluna | Manual (índices) |
| Integração com ML | Nativa (Spark MLlib) | Via exportação externa |
| Custo de escala | Linear (objeto store) | Vertical (hardware) |
| Versionamento | Time travel nativo | Inexistente |

A comparação de desempenho será realizada com as **mesmas queries analíticas** executadas
nos dois ambientes (SQL sobre Delta Lake via Spark e SQL sobre PostgreSQL), permitindo
mensurar a diferença de latência de consulta como um dos critérios da avaliação.

---

## 3.7 Protocolo de Avaliação

A avaliação da arquitetura Lakehouse proposta será conduzida por meio de métricas
objetivas, aplicadas em três dimensões: qualidade dos dados, desempenho de processamento
e capacidade analítica.

### 3.7.1 Métricas de Qualidade de Dados

| Métrica | Fórmula | Critério de Aceitação |
|---|---|---|
| Completude | registros_completos / total_esperado × 100 | ≥ 95% |
| Consistência | registros_íntegros / total_bronze × 100 | ≥ 98% |
| Unicidade | (total − duplicatas) / total × 100 | = 100% |
| Acurácia de tipos | campos_tipados_corretamente / total_campos × 100 | = 100% |

A completude e consistência são calculadas automaticamente ao final de cada execução
do pipeline, com os resultados registrados em um log de qualidade armazenado na camada
Silver.

### 3.7.2 Métricas de Desempenho

| Métrica | Instrumento de Medição | Objetivo |
|---|---|---|
| Tempo de carga Bronze | `time.time()` Python | Referência base |
| Tempo de transformação Silver | Spark UI / `time.time()` | Referência base |
| Tempo de carga Gold | `time.time()` Python | Referência base |
| Latência de consulta — Lakehouse | Spark SQL `EXPLAIN` + tempo de execução | ≤ 1,5× DW referência |
| Latência de consulta — DW ref. | `EXPLAIN ANALYZE` PostgreSQL | Referência base |
| Tamanho de armazenamento por camada | `du -sh` nos diretórios Delta | Referência informativa |

### 3.7.3 Métricas de Capacidade Analítica

A capacidade analítica é avaliada pela capacidade do pipeline de responder a, no
mínimo, cinco indicadores de negócio padrão de e-commerce:

1. **Receita total por período** (dia, mês, trimestre, ano)
2. **Ticket médio por cliente e por região**
3. **Top 10 produtos mais vendidos por receita e por volume**
4. **Taxa de desconto médio por categoria**
5. **Distribuição de métodos de pagamento por período**

Cada indicador é implementado como uma query SQL sobre a camada Gold e validado
visualmente no painel do Power BI. Um indicador é considerado **válido** quando:
(a) produz resultado em tempo ≤ 10 segundos no ambiente local; (b) os valores gerados
são coerentes com o dataset simulado (verificação por amostragem); e (c) o resultado
no Lakehouse é idêntico ao resultado no DW de referência (para os mesmos dados).

---

## 3.8 Cronograma de Execução

O desenvolvimento do trabalho está organizado nas seguintes etapas:

| Etapa | Atividade | Período |
|---|---|---|
| 1 | Revisão bibliográfica e fundamentação teórica | Março 2026 |
| 2 | Projeto da API simuladora e do Star Schema | Abril 2026 |
| 3 | Implementação da API e camada Bronze | Abril 2026 |
| 4 | Implementação da camada Silver (regras de qualidade) | Maio 2026 |
| 5 | Implementação da camada Gold (Star Schema) | Maio 2026 |
| 6 | Implementação do DW de referência (PostgreSQL) | Maio 2026 |
| 7 | Desenvolvimento do painel Power BI | Junho 2026 |
| 8 | Coleta e análise das métricas de avaliação | Junho 2026 |
| 9 | Redação dos capítulos de resultados e conclusões | Julho 2026 |
| 10 | Revisão final e entrega do TCC | Agosto 2026 |

---

## Referências

GIL, Antonio Carlos. **Como elaborar projetos de pesquisa**. 6. ed. São Paulo: Atlas,
2002.

YIN, Robert K. **Estudo de caso: planejamento e métodos**. 5. ed. Porto Alegre:
Bookman, 2015.
