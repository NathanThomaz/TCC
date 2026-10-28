---
tipo: instrumento
fonte: data/README.md; README.md; src/tcc_exp/analise/
atualizado: 2026-10-28
tags: [tcc, instrumento, dados, dashboard]
---

# Dados, Pipeline e Dashboard

Fontes: [data/README.md](https://github.com/NathanThomaz/TCC/blob/main/data/README.md) · [README.md](https://github.com/NathanThomaz/TCC/blob/main/README.md) · `src/tcc_exp/analise/`

## Fluxo
```
sessão (exp ...) → data/raw/<fase>/sessoes/<exec_id>.jsonl   (somente-acréscimo, cadeia de hash)
                   data/raw/<fase>/anexos/<exec_id>/          (transcrições, SHA-256)
exp processar   → data/processed/<fase>/execucoes.csv + integridade.json
exp analisar    → reports/<fase>/ (tabelas, figuras PNG, relatorio-experimento.md)
exp dashboard   → reports/<fase>/dashboard.html
```

## Diretórios de dados

| Diretório | Conteúdo | Quem escreve | Editar à mão? |
|---|---|---|---|
| `raw/<fase>/sessoes/` | 1 JSONL por execução | `exp` | **Nunca** |
| `raw/<fase>/anexos/<exec_id>/` | Transcrições de IA e outros brutos | `exp anexar` | **Nunca** |
| `processed/<fase>/` | `execucoes.csv`, `integridade.json` | `exp processar` | Não; regenerar |

- Fase `piloto` não entra na análise principal.
- Cadeia de hash quebrada → execução excluída, com a exclusão no relatório.
- Repo público → revisar anexos antes de cada commit.

**Situação (28/10/2026):** `data/` só tem o README; não existem `data/raw/` nem `reports/`.

## Dashboard (`exp dashboard`)
HTML único, offline, temas claro e escuro, gráficos SVG sem bibliotecas externas. Todo número vem de `execucoes.csv` e das tabelas do pipeline; textos neutros (descrevem direção e incerteza, **não concluem**).

Seções:
1. **Apresentação** — título, pergunta, hipóteses, desenho, condições (de `experimento.toml` → `[apresentacao]`; `instituicao` e `orientador` ainda vazios — D7)
2. **Resumo** — indicadores e gráfico de efeitos com IC 95%
3. **Gráficos** — pares A × B de H1–H3, velocidade × qualidade, aprendizagem ao longo da sequência, H4 por tipo
4. **Análises** — comparações pareadas e descritivas
5. **Dados** — exclusões e execuções
6. **Limitações**

## Demonstração (`exp demo-dashboard`)
- Dados **sintéticos com efeito nulo**, faixa de aviso em todas as visualizações.
- Bloqueada para `reports/` e `data/`.
- Já gerada em `C:\Users\natha\Documents\tcc-demo\` (fora do repo): `dashboard.html`, `figures/`, `tables/`, `relatorio-experimento.md`, `_dados_sinteticos/`.
- Mostra **o formato**, não resultados. **Nunca** usar números dela no texto.

Relacionadas: [[Plano de Análise Estatística]] · [[Roteiro da Defesa]] · [[Princípios de Integridade]]
