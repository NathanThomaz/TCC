---
tipo: metodologia
fonte: docs/metricas.md; src/tcc_exp/metricas.py
atualizado: 2026-10-28
tags: [tcc, metodologia, metricas]
---

# Métricas — definições operacionais

Fonte: [metricas.md](https://github.com/NathanThomaz/TCC/blob/main/docs/metricas.md) · código: `src/tcc_exp/metricas.py` (documento e código mudam **juntos**).
Calculadas a partir de `data/raw/<fase>/sessoes/<exec_id>.jsonl`.

## Eventos que delimitam os intervalos

| Evento | Quando | Quem gera |
|---|---|---|
| `abertura` | Workspace montado, enunciado exibido | `exp abrir` |
| `inicio` | Fim da leitura, começo do trabalho | `exp iniciar` |
| `pausa` / `retomada` | Interrupção externa | `exp pausar` / `exp retomar` |
| `teste_publico` | Rodou os testes públicos | `exp testar` |
| `entrega` | Solução declarada pronta (commit congelado) | `exp entregar` |
| `avaliacao` | Resultado dos ocultos sobre a entrega | automático |
| `devolutiva` | Relatório padronizado de cenários não atendidos | automático (se houver falhas e rodadas) |
| `fim` | `aceita`, `rejeitada` (rodadas esgotadas) ou `limite` | automático ou `exp encerrar-limite` |
| outros | `aborto`, `nota`, `analise_estatica`, `anexo`, `percepcao`, `questionario` | comandos correspondentes |

- **Tempo ativo** = relógio entre dois eventos **menos** os intervalos `pausa`→`retomada`.
- **Devolutiva** = o evento em que o resultado da avaliação independente (ocultos) é comunicado. **Tempo de correção** vai dela até a entrega seguinte.

## Primárias (confirmatórias)

| Métrica | Definição | Hipótese |
|---|---|---|
| **`t_aceite_min`** | Tempo ativo de `inicio` ao `fim` aceito; não aceita = tempo-limite (censura) | H1 |
| **`taxa_ocultos_1a`** | Ocultos aprovados na 1ª entrega ÷ total do manifesto (não coletado = reprovado) | H2 |
| **`t_retrabalho_min`** | Soma do tempo ativo de cada `devolutiva` até a entrega seguinte (ou `fim`); 0 se a 1ª entrega for perfeita | H3 |

## Secundárias e descritivas

| Métrica | Definição | Unidade |
|---|---|---|
| `t_leitura_min` | `abertura` → `inicio` | min |
| `t_1a_entrega_min` | `inicio` → 1ª `entrega` (velocidade bruta; sozinha engana) | min |
| `t_total_min` | `inicio` → `fim`, aceita ou não | min |
| `taxa_ocultos_final` | Ocultos aprovados na última entrega (efeito teto esperado) | proporção |
| `defeitos_1a_{critico,maior,menor}` | Ocultos reprovados na 1ª entrega por severidade do manifesto | contagem |
| `ciclos` | Nº de devolutivas | 0–2 |
| `churn_pos_1a_linhas` | Linhas +/− entre o commit da 1ª entrega e o final (`git diff --numstat`) | linhas |
| `tamanho_diff_linhas` | Linhas +/− entre o estado inicial e o final | linhas |
| `delta_alertas_ruff` | Alertas ruff (E, F, W, B, C90, SIM) final − inicial; `None` sem ruff | contagem |
| `delta_cc_soma` | Complexidade ciclomática (radon) final − inicial | CC |
| `n_testes_publicos` | Nº de `exp testar` (esforço de validação) | contagem |
| `percepcao_erro_min` | Estimativa do executor − `t_total_min` (viés de percepção, cf. Becker) | min |
| `confianca_1a` | 1–5, dada **antes** de ver a 1ª avaliação; comparada com `taxa_ocultos_1a` (calibração, cf. Perry) | 1–5 |
| `dificuldade_percebida` | 1 muito fácil … 5 muito difícil (controle da equivalência das gêmeas) | 1–5 |
| `esforco_mental` | Esforço mental percebido | 1–5 |
| `utilidade_ia` (só B) | 1 atrapalhou muito … 5 ajudou muito | 1–5 |
| Uso da IA (só B) | Transcrições anexadas — **descritor, não desfecho** | — |

As medidas de percepção (confiança e questionário) são **secundárias e exploratórias** (D10).

## Regras de tratamento
- Tempo em minutos com 4 casas decimais.
- Ausência = NaN; **nunca** zero nem média.
- Abortadas: `abortada=True`, excluídas da análise com listagem.

## Descartadas por agora
Acoplamento, legibilidade por avaliação humana, duplicação. Tempo por fase só via gravação de tela numa amostra (~4 pares, esquema inspirado no CUPS — D6).

Relacionadas: [[Hipóteses e Variáveis]] · [[Plano de Análise Estatística]] · [[Dados, Pipeline e Dashboard]]
