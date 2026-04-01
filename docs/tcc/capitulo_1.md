# Capítulo 1 — Introdução

## 1.1 Motivação

O crescimento acelerado do comércio eletrônico nas últimas décadas tem produzido volumes
massivos de dados transacionais — pedidos, clientes, produtos, pagamentos e interações —
que representam um ativo estratégico para a tomada de decisão empresarial. De acordo com
Armbrust et al. (2021), a capacidade de armazenar, processar e analisar grandes volumes de
dados de forma eficiente tornou-se um diferencial competitivo fundamental para organizações
orientadas a dados. Nesse contexto, arquiteturas de dados modernas surgem como resposta à
crescente demanda por análises ágeis e de baixo custo operacional.

Apesar da reconhecida importância da inteligência analítica no setor de e-commerce, as
soluções tradicionais de Data Warehouse (DW) apresentam limitações estruturais que dificultam
sua adoção em larga escala. Esses sistemas exigem infraestrutura proprietária de alto custo,
impõem esquemas de dados rígidos definidos no momento da ingestão (*schema-on-write*) e
oferecem escalabilidade predominantemente vertical, tornando-se economicamente inviáveis
para empresas de pequeno e médio porte que lidam com dados em crescimento contínuo
(INMON, 2002).

Essa dificuldade impacta diretamente três dimensões. Na dimensão tecnológica, os sistemas
de DW tradicionais não foram projetados para lidar com a heterogeneidade e o volume dos
dados gerados por plataformas digitais modernas. Na dimensão organizacional, empresas de
e-commerce perdem oportunidades analíticas relevantes — como a geração de indicadores de
vendas, comportamento de clientes e desempenho de produtos — pela falta de uma solução
acessível e escalável. Na dimensão acadêmica, verifica-se uma lacuna de estudos aplicados
que demonstrem, de forma prática, a implementação de arquiteturas Lakehouse com validação
da qualidade analítica para o domínio do comércio eletrônico.

Diante desse cenário, o presente trabalho propõe a implementação de uma arquitetura
Lakehouse estruturada em camadas Bronze, Silver e Gold, utilizando tecnologias abertas como
Apache Spark e Delta Lake, aplicada a dados simulados de e-commerce. A proposta visa
demonstrar que essa abordagem constitui uma alternativa viável, escalável e de baixo custo ao
Data Warehouse tradicional, sem abrir mão da qualidade analítica necessária para a geração
de indicadores de negócio. Os principais beneficiados são estudantes, pesquisadores e
profissionais da área de Sistemas de Informação que buscam referências práticas sobre
arquiteturas modernas de dados.

---

## 1.2 Problema de Pesquisa

Como a arquitetura Lakehouse com camadas Bronze, Silver e Gold aplicada a dados de
e-commerce pode oferecer uma alternativa escalável e de baixo custo ao Data Warehouse
tradicional, sem abrir mão da qualidade analítica para geração de indicadores de negócio?

---

## 1.4 Objetivos

O objetivo geral deste trabalho é **implementar uma arquitetura Lakehouse com camadas
Bronze, Silver e Gold para análise de dados de e-commerce**, avaliando sua viabilidade como
alternativa escalável e de baixo custo ao Data Warehouse tradicional.

Para alcançar o objetivo geral, definem-se os seguintes objetivos específicos:

- **Analisar** as limitações dos Data Warehouses tradicionais no contexto de e-commerce,
  considerando aspectos de custo, escalabilidade e flexibilidade de esquema.

- **Projetar** o modelo dimensional Star Schema para suporte à análise de indicadores de
  vendas, clientes e produtos na camada Gold da arquitetura.

- **Implementar** o pipeline de dados nas camadas Bronze, Silver e Gold utilizando Apache
  Spark e Delta Lake, com ingestão a partir de uma API simulada de e-commerce.

- **Avaliar** a qualidade analítica da arquitetura proposta por meio da geração de
  indicadores de negócio em um dashboard Power BI, comparando os resultados com os
  critérios de qualidade esperados em soluções de Data Warehouse.

---

## Referências

ARMBRUST, Michael et al. **Lakehouse: A New Generation of Open Platforms that Unify
Data Warehousing and Advanced Analytics**. In: CIDR, 2021.

INMON, William H. **Building the Data Warehouse**. 4. ed. New York: John Wiley & Sons,
2002.
