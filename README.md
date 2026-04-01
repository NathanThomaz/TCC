# TCC — Arquitetura Lakehouse para E-commerce

**Instituição:** UnilaSalle  
**Autor:** Nathan Thomaz  

## Pergunta de Pesquisa

Como a arquitetura Lakehouse com camadas Bronze, Silver e Gold aplicada a dados de e-commerce pode oferecer uma alternativa escalável e de baixo custo ao Data Warehouse tradicional, sem abrir mão da qualidade analítica para geração de indicadores de negócio?

## Visão Geral

Este projeto implementa uma arquitetura Lakehouse completa para análise de dados de e-commerce, com modelagem dimensional Star Schema na camada Gold, comparando a abordagem com o Data Warehouse tradicional em termos de custo, escalabilidade e qualidade analítica.

## Tecnologias

| Componente | Tecnologia |
|---|---|
| Linguagem | Python |
| Processamento | Apache Spark |
| Armazenamento | Delta Lake |
| API de dados | FastAPI |
| Visualização | Power BI |

## Arquitetura

```
E-commerce API (FastAPI)
        │
        ▼
┌───────────────┐
│    BRONZE     │  Ingestão raw → Delta Lake (data/raw/)
│   (src/bronze)│
└───────┬───────┘
        │
        ▼
┌───────────────┐
│    SILVER     │  Limpeza, validação e padronização (data/processed/)
│   (src/silver)│
└───────┬───────┘
        │
        ▼
┌───────────────┐
│     GOLD      │  Star Schema dimensional (data/analytical/)
│   (src/gold)  │
└───────┬───────┘
        │
        ▼
   Power BI Dashboard
```

## Star Schema (Modelagem Dimensional)

- **fato_pedidos** — fato principal com métricas de vendas
- **dim_cliente** — dados dos clientes
- **dim_produto** — catálogo de produtos
- **dim_tempo** — calendário analítico

## Estrutura do Repositório

```
TCC/
├── docs/               # Capítulos do TCC
├── src/
│   ├── api/            # API simuladora de e-commerce (FastAPI)
│   ├── bronze/         # Scripts de ingestão
│   ├── silver/         # Scripts de transformação e limpeza
│   └── gold/           # Modelagem Star Schema
├── data/
│   ├── raw/            # Dados brutos (camada Bronze)
│   ├── processed/      # Dados tratados (camada Silver)
│   └── analytical/     # Dados modelados (camada Gold)
├── dashboard/          # Arquivo Power BI (.pbix)
├── Exemplos/           # Material de referência do curso
├── Projeto/            # Documentos do projeto (proposta, tema)
├── Templates/          # Templates acadêmicos
├── requirements.txt
└── .gitignore
```

## Como Executar

> Em construção — instruções serão adicionadas conforme o pipeline for implementado.

## Status do Projeto

- [x] Capítulo 1 — Introdução
- [ ] Star Schema definido
- [ ] API simuladora (FastAPI)
- [ ] Pipeline Bronze
- [ ] Pipeline Silver
- [ ] Pipeline Gold
- [ ] Dashboard Power BI
- [ ] Capítulo 2 — Referencial Teórico
- [ ] Capítulo 3 — Metodologia
