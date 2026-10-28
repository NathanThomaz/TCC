---
tipo: gestao
fonte: docs/gestao-projeto.md
atualizado: 2026-10-28
tags: [tcc, gestao, etapas]
---

# Etapas do Projeto (E1–E9)

Fonte: [gestao-projeto.md](https://github.com/NathanThomaz/TCC/blob/main/docs/gestao-projeto.md) (o cabeçalho do arquivo diz "Atualizado em: 2026-10-27", mas já contém itens de 28/10)

Legenda: ✅ concluída · 🔄 em andamento · ⏳ não iniciada · ⛔ bloqueada

| Etapa | Status | Resumo |
|---|---|---|
| E1 Descoberta e planejamento | 🔄 | Falta D2, D7 (e fechar D3) e validar com orientador |
| E2 Fundamentação | ⏳ | Nada executado |
| E3 Protocolo | 🔄 | v0.9 pronto; faltam tarefas principais |
| E4 Piloto | 🔄 | Tudo preparado; execuções ⛔ por D3 |
| E5 Congelamento | ⏳ | — |
| E6 Execução | ⏳ | — |
| E7 Análise | ⏳ | — |
| E8 Redação | 🔄 | Só seções pré-coleta |
| E9 Revisão e defesa | ⏳ | — |

## E1 — Descoberta e planejamento 🔄
| Tarefa | Status | Critério |
|---|---|---|
| Inspecionar ambiente | ✅ | Feito |
| Viabilidade e literatura-semente | ✅ | Feito (metadados) |
| Pergunta, objetivos, hipóteses | ✅ | Feito, pendente de orientador |
| Decisões D2, D7 (D3 adotada; falta modelo) | ⛔ | Todas ≠ PENDENTE — depende de respostas do autor |
| Validar o plano com o orientador | ⏳ | Aprovação registrada (depende de D7) |

## E2 — Fundamentação ⏳
| Tarefa | Status | Critério |
|---|---|---|
| Executar a string nas bases | ⏳ | Buscas registradas com data e nº (precisa de acesso institucional) |
| Triagem por título/resumo | ⏳ | Critérios aplicados |
| Fichar ≥ 15 estudos (integral) | ⏳ | Fichas completas |
| Confirmar/refutar a lacuna | ⏳ | `pesquisa/revisao-literatura.md` |
| Caps. 2 e 3 (rascunho final) | ⏳ | Nenhuma citação sem ficha |

## E3 — Protocolo 🔄
| Tarefa | Status | Critério |
|---|---|---|
| Protocolo v0.9 | ✅ | Escrito |
| Matriz de métricas | ✅ | Escrita e implementada |
| Aplicação-base pública | ✅ | 16 testes passando |
| Variante selada da base | ⏳ | Selo registrado (fora do repo) |
| 12 pares + 4 reservas | ⏳ | `validar-tarefa` OK; `selos-principal.json` |
| Revisão das tarefas pelo orientador (amostra) | ⏳ | Registrada |

## E4 — Piloto 🔄
| Tarefa | Status | Critério |
|---|---|---|
| Instrumento mínimo + testes | ✅ | 39 testes (27/10) → **45 testes (verificado 28/10)** |
| Tarefas-piloto P1–P4 | ✅ | `validar-tarefa` OK nas 8 |
| Plano do piloto | ✅ | Semente 20261028 |
| Dashboard e demonstração | ✅ | 45 testes passando |
| Análise de poder | ✅ | Gerada por script |
| Perfil do executor | ⏳ | Preenchido (D2) |
| 8 execuções-piloto | ⛔ | Depende de D3 (modelo) |
| Relatório de ajustes do piloto | ⏳ | `docs/relatorio-piloto.md` |

## E5 — Congelamento ⏳
Tag `protocolo-v1.0` + `selos-principal.json` + `plano-principal.csv` commitados **antes** da 1ª sessão principal.

## E6 — Execução ⏳
24 execuções concluídas ou registradas como desvio.

## E7 — Análise ⏳
`exp processar && exp analisar` reproduz `reports/principal/` a partir de `data/raw/principal`.

## E8 — Redação 🔄
Resultados e discussão **apenas** a partir de `reports/principal/`.

## E9 — Revisão e defesa ⏳
Coerência pergunta → hipóteses → método → resultados; referências conferidas; [[Roteiro da Defesa]].

Relacionadas: [[Backlog e Pendências]] · [[Plano de Execução]] · [[Estado Atual - Retomada]]
