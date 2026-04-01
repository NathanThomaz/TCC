# TCC — Arquitetura Lakehouse para E-commerce

**Instituição:** Centro Universitário La Salle (Unilasalle)
**Autor:** Nathan Thomaz
**Curso:** Sistemas de Informação

---

## Sobre o Projeto

Este trabalho investiga a viabilidade da arquitetura Lakehouse como alternativa ao
Data Warehouse tradicional no contexto do comércio eletrônico. A implementação
utiliza as camadas Bronze, Silver e Gold sobre Delta Lake com modelagem dimensional
Star Schema na camada analítica.

**Pergunta de pesquisa:**
Como a arquitetura Lakehouse com camadas Bronze, Silver e Gold aplicada a dados de
e-commerce pode oferecer uma alternativa escalável e de baixo custo ao Data Warehouse
tradicional, sem abrir mão da qualidade analítica para geração de indicadores de negócio?

---

## Tecnologias

- **Python** — linguagem principal
- **FastAPI** — API simuladora de dados de e-commerce
- **Apache Spark** — processamento distribuído
- **Delta Lake** — armazenamento das camadas Bronze, Silver e Gold
- **Power BI** — visualização e dashboard analítico

---

## Estrutura do Repositório

```
TCC/
├── docs/
│   ├── tcc/            Capítulos do TCC (Markdown e DOCX)
│   ├── referencias/    Material de apoio (PDFs das aulas, não versionados)
│   └── templates/      Templates institucionais
│
├── src/
│   ├── api/            API simuladora de e-commerce (FastAPI)
│   ├── bronze/         Ingestão de dados brutos para o Delta Lake
│   ├── silver/         Limpeza, validação e padronização dos dados
│   └── gold/           Modelagem dimensional Star Schema
│
├── dashboard/          Arquivo Power BI (.pbix)
│
└── data/               Dados por camada (não versionados)
    ├── raw/
    ├── processed/
    └── analytical/
```

---

## Arquitetura

```
API E-commerce (FastAPI)
        |
        v
    [ BRONZE ]   Ingestão raw — dados brutos em Delta Lake
        |
        v
    [ SILVER ]   Limpeza, padronização e validação
        |
        v
     [ GOLD ]    Modelagem Star Schema (fato + dimensões)
        |
        v
  Power BI Dashboard
```

**Star Schema — camada Gold:**
- `fato_pedidos` — métricas de vendas
- `dim_cliente` — dados dos clientes
- `dim_produto` — catálogo de produtos
- `dim_tempo` — calendário analítico

---

## Como Executar

> Em construção. As instruções serão adicionadas conforme o pipeline for implementado.

---

## Progresso do TCC

| Seção | Status |
|---|---|
| 1.1 Motivação | Concluído |
| 1.2 Problema de Pesquisa | Concluído |
| 1.4 Objetivos | Concluído |
| API simuladora (FastAPI) | Pendente |
| Pipeline Bronze | Pendente |
| Pipeline Silver | Pendente |
| Pipeline Gold / Star Schema | Pendente |
| Dashboard Power BI | Pendente |
| Cap. 2 — Referencial Teórico | Pendente |
| Cap. 3 — Metodologia | Pendente |
