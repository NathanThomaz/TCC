# Gestão do projeto — etapas, tarefas e status

Legenda: ✅ concluída (critério verificado) · 🔄 em andamento · ⏳ não iniciada · ⛔ bloqueada.

Atualizado em: 2026-10-27.

## E1. Descoberta e planejamento — 🔄
| Tarefa | Status | Depende de | Artefato | Critério de conclusão |
|---|---|---|---|---|
| Inspecionar ambiente | ✅ | — | plano §0 | Feito |
| Avaliar viabilidade e literatura-semente | ✅ | — | plano §1, `pesquisa/referencias-verificadas.md` | Feito (metadados) |
| Refinar pergunta, objetivos e hipóteses | ✅ | — | plano §2–4 | Feito, pendente de orientador |
| Decisões D2, D7 (D3 adotada: Copilot; falta modelo) | ⛔ | Respostas do autor | `decisoes-metodologicas.md` | Todas com status ≠ PENDENTE |
| Validar o plano com o orientador | ⏳ | D7 | Registro em decisões | Aprovação registrada |

## E2. Fundamentação — ⏳
| Tarefa | Status | Depende de | Artefato | Critério |
|---|---|---|---|---|
| Executar a string de busca nas bases | ⏳ | Acesso institucional | `pesquisa/estrategia-busca.md` (registro de buscas) | Buscas registradas com data e nº de resultados |
| Triagem por título e resumo | ⏳ | busca | Planilha de triagem | Critérios aplicados |
| Fichar ≥ 15 estudos (texto integral) | ⏳ | triagem | `pesquisa/fichas/` | Fichas completas, status "integral" |
| Confirmar ou refutar a lacuna | ⏳ | fichas | `pesquisa/revisao-literatura.md` | Síntese escrita |
| Capítulos 2 e 3 (rascunho final) | ⏳ | fichas | `thesis/capitulos/` | Nenhuma citação sem ficha |

## E3. Protocolo — 🔄
| Tarefa | Status | Depende de | Artefato | Critério |
|---|---|---|---|---|
| Protocolo v0.9 | ✅ | E1 | `docs/protocolo-experimental.md` | Escrito |
| Matriz de métricas | ✅ | — | `docs/metricas.md` | Escrita e implementada |
| Aplicação-base pública (piloto) | ✅ | — | `experiment/base-system` | 16 testes passando |
| Variante selada da aplicação-base (principal) | ⏳ | D4 | fora do repo | Selo registrado |
| 12 pares + 4 reservas de tarefas principais | ⏳ | variante | fora do repo + `selos-principal.json` | `exp validar-tarefa` OK em todas |
| Revisão das tarefas pelo orientador (amostra) | ⏳ | tarefas | registro em decisões | Registrada |

## E4. Piloto — 🔄
| Tarefa | Status | Depende de | Artefato | Critério |
|---|---|---|---|---|
| Instrumento mínimo + testes | ✅ | — | `src/tcc_exp`, `tests/` | 39 testes passando (2026-10-27) |
| Tarefas-piloto P1–P4 (4 tipos) | ✅ | — | `experiment/tasks/piloto` | `validar-tarefa` OK nas 8 (2026-10-28) |
| Plano do piloto | ✅ | — | `experiment/randomization/plano-piloto.csv` | Sorteado (semente 20261028) |
| Dashboard e demonstração | ✅ | — | `src/tcc_exp/analise/dashboard.py` | 45 testes passando (2026-10-28) |
| Análise de poder | ✅ | — | `docs/analise-poder.md` | Gerada por script |
| Perfil do executor | ⏳ | D2 | `docs/perfil-executor.md` | Preenchido |
| Executar as 8 execuções-piloto | ⛔ | D3 (cond. B) | `data/raw/piloto` | 8 execuções concluídas |
| Relatório de ajustes do piloto | ⏳ | execuções | `docs/relatorio-piloto.md` | Ajustes registrados |

## E5. Congelamento — ⏳
Critério: tag `protocolo-v1.0` + `selos-principal.json` + `plano-principal.csv` commitados **antes** da 1ª sessão principal.

## E6. Execução — ⏳
Critério: 24 execuções concluídas ou registradas como desvio.

## E7. Análise — ⏳
Critério: `exp processar && exp analisar` reproduz `reports/principal/` a partir de `data/raw/principal`.

## E8. Redação — 🔄 (somente seções pré-coleta)
Critério: capítulos de resultados e discussão escritos **apenas** a partir de `reports/principal/`.

## E9. Revisão e defesa — ⏳
