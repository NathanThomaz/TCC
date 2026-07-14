# Capítulo 1 — Introdução

## 1.1 Motivação

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
lacuna que este trabalho se propõe a preencher.

---

## 1.2 Problema de Pesquisa

Como projetar e implementar uma plataforma de Engenharia de Dados capaz de coletar,
integrar e disponibilizar informações de múltiplas APIs públicas sobre o mercado de
trabalho em tecnologia, aplicando a Arquitetura Medalhão (Bronze, Silver e Gold) com
orquestração via Apache Airflow, de forma a produzir análises estratégicas confiáveis
e auditáveis sobre vagas de emprego, competências demandadas e distribuição geográfica
das oportunidades?

---

## 1.3 Hipótese

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

## 1.4 Objetivos

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

## 1.5 Organização do Trabalho

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

## Referências

ADZUNA. **API Documentation**. Disponível em: <https://developer.adzuna.com/>. Acesso em:
jun. 2026.

FÓRUM ECONÔMICO MUNDIAL. **The Future of Jobs Report 2023**. Genebra: World Economic
Forum, 2023.

GIL, Antonio Carlos. **Como elaborar projetos de pesquisa**. 6. ed. São Paulo: Atlas,
2002.

IBGE — INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. **API IBGE**. Disponível em:
<https://servicodados.ibge.gov.br/api/docs/>. Acesso em: jun. 2026.

INMON, William H. **Building the Data Warehouse**. 4. ed. Nova York: John Wiley & Sons,
2002.

LANEY, Doug. **3D Data Management: Controlling Data Volume, Velocity, and Variety**.
META Group Research Note, 2001.

VASSILIADIS, Panos. **A Survey of Extract-Transform-Load Technology**. International
Journal of Data Warehousing and Mining, v. 5, n. 3, p. 1–27, 2009.

YIN, Robert K. **Estudo de caso: planejamento e métodos**. 5. ed. Porto Alegre:
Bookman, 2015.
