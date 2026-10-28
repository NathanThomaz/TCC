---
tipo: referencia
fonte: src/tcc_exp/cli.py; README.md
atualizado: 2026-10-28
tags: [tcc, instrumento, cli]
---

# Comandos da CLI `exp`

Fonte: [cli.py](https://github.com/NathanThomaz/TCC/blob/main/src/tcc_exp/cli.py) · roteiro de uso: [[Guia de Sessão]]

## Preparação e administração

| Comando | O que faz |
|---|---|
| `exp verificar-ambiente` | Mostra ferramentas, caminhos, fase e se a ferramenta de IA está configurada |
| `exp sortear --pares <toml> --semente <N> [--sobrescrever]` | Gera o plano de randomização |
| `exp validar-tarefa [IDs...]` | Confere estado inicial (falha em ≥ 1 oculto) e referência (100%) |
| `exp selar` | Registra os hashes dos pacotes da fase (`selos-principal.json`) |

## Sessão (sempre com `<exec_id>`, ex.: X01)

| Comando | Evento | Observação |
|---|---|---|
| `exp abrir X01 --confirmo-sem-ia` | `abertura` | Condição A |
| `exp abrir X01 --modelo "<modelo>"` | `abertura` | Condição B; recusa se a ferramenta não estiver configurada |
| `exp iniciar X01` | `inicio` | Começa o tempo ativo |
| `exp pausar X01 --motivo "..."` | `pausa` | Só interrupção externa |
| `exp retomar X01` | `retomada` | — |
| `exp testar X01` | `teste_publico` | Roda os testes públicos |
| `exp entregar X01 --confianca <1-5>` | `entrega` → `avaliacao` → `devolutiva` ou `fim` | Avaliação oculta automática |
| `exp encerrar-limite X01` | `fim` (limite) | Aos 90 min ativos |
| `exp abortar X01 --motivo "..."` | `aborto` | Falha de ambiente/IA |
| `exp nota X01 "texto"` | `nota` | Observação livre |
| `exp status X01` | — | Estado, tempo ativo e restante |
| `exp percepcao X01 <minutos>` | `percepcao` | Estimativa do executor |
| `exp questionario X01 --dificuldade N --esforco N [--utilidade-ia N] [--comentario "..."]` | `questionario` | Escalas 1–5 |
| `exp anexar X01 <arquivo> [--descricao "..."]` | `anexo` | Copia para `data/raw/<fase>/anexos/X01/` com SHA-256 |

O instrumento também registra `analise_estatica` (inicial e final) automaticamente.

## Análise

| Comando | Saída |
|---|---|
| `exp processar` | `data/processed/<fase>/execucoes.csv` + `integridade.json` |
| `exp analisar [--saida DIR]` | `reports/<fase>/` (tabelas, figuras, `relatorio-experimento.md`) |
| `exp dashboard [--saida DIR]` | `reports/<fase>/dashboard.html` (dados reais) |
| `exp demo-dashboard --saida ../tcc-demo [--semente 7]` | Dashboard **sintético** de efeito nulo; recusa `reports/` e `data/` |

Relacionadas: [[Instrumento tcc_exp]] · [[Dados, Pipeline e Dashboard]]
