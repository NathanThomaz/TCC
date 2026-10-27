# Protocolo experimental

**Versão:** 0.9-rascunho (2026-10-27). **Status:** em elaboração, NÃO congelado.

O protocolo é congelado na Etapa 5 com uma tag git (`protocolo-v1.0`). Depois disso, toda alteração entra como desvio em [desvios.md](desvios.md) e como entrada em [decisoes-metodologicas.md](decisoes-metodologicas.md).

Para relatar o experimento, este documento segue a terminologia de Wohlin et al. (2012).

---

## 1. Objetivo do experimento (formato GQM)

Analisar **o uso de um assistente de IA generativa**
com o propósito de **avaliar**
seu efeito sobre **o tempo até a entrega aceita, a qualidade funcional da primeira entrega e o retrabalho após a devolutiva**
do ponto de vista **do desenvolvedor e do processo de manutenção**
no contexto de **tarefas de manutenção de uma aplicação Python/SQL de pequeno porte, executadas por um único desenvolvedor sob protocolo controlado**.

## 2. Hipóteses

| ID | Hipótese nula (H0) | Alternativa (H1) | Variável | Escala da análise |
|---|---|---|---|---|
| H1 | A mediana de log(t_aceite_B) − log(t_aceite_A) é 0 | ≠ 0 | `t_aceite_min` | log |
| H2 | A mediana de taxa_ocultos_1a_B − taxa_ocultos_1a_A é 0 | ≠ 0 | `taxa_ocultos_1a` | proporção |
| H3 | A mediana de t_retrabalho_B − t_retrabalho_A é 0 | ≠ 0 | `t_retrabalho_min` | minutos |
| H4 | — (exploratória) | — | Diferenças de H1 e H2 por tipo de tarefa | descritiva |

Nível de significância: α = 0,05, bilateral, com correção de Holm sobre H1–H3.

## 3. Variáveis

- **Independente (fator):** condição, com dois tratamentos: A = sem IA e B = com o assistente definido em D3.
- **Dependentes:** ver [metricas.md](metricas.md).
- **Bloqueio:** par de tarefas gêmeas.
- **Controladas (fixas):** executor, linguagem (Python 3.11), banco (SQLite), editor, máquina, recursos permitidos, tempo-limite e aplicação-base.
- **Registradas como covariáveis:** posição na sequência, ordem no par, tipo de tarefa, modelo e versão da ferramenta, data e hora.

## 4. Unidade experimental e amostra

- **Unidade:** a execução de uma tarefa (tarefa × condição).
- **Amostra planejada:** 4 tipos × 3 pares = 12 pares (24 execuções).
- **Mínimo aceitável** (corte de escopo): 3 tipos × 3 pares = 9 pares. Com 9 pares, o menor p possível no teste de randomização é 2/2⁹ ≈ 0,004.
- **Tarefas reserva:** 1 par por tipo, para substituir execuções abortadas por falha de ambiente.

## 5. Tarefas

- **Tipos:** T1 correção de defeito, T2 nova funcionalidade, T3 consulta SQL incorreta, T4 robustez do pipeline de importação (ETL).
- **Formato do pacote, critérios de equivalência entre gêmeas e procedimento de selagem:** [../experiment/tasks/README.md](../experiment/tasks/README.md).
- **Critérios de inclusão de uma tarefa:**
  1. `exp validar-tarefa` aprovado (o estado inicial falha em ≥ 1 teste oculto, e a referência passa em 100% dos testes públicos e ocultos);
  2. enunciado com regras explícitas, das quais **todos** os testes ocultos derivam;
  3. solução de referência alterando entre 3 e 60 linhas;
  4. tempo estimado de 20 a 60 minutos.
- **Critérios de exclusão:** a tarefa exige conhecimento externo à aplicação e à documentação permitida; ou a gêmea compartilha o mesmo defeito, função ou solução.

## 6. Randomização

1. `exp sortear --pares <pares.toml> --semente <N>`. A semente é escolhida antes e registrada no commit.
2. O plano (`experiment/randomization/plano-principal.csv`) e o seu `.sha256` são versionados **antes** da 1ª sessão.
3. O plano não é refeito. Se uma execução for abortada, usa-se uma tarefa reserva do mesmo tipo, na mesma condição, e o caso é registrado como desvio.

## 7. Preparação (antes da coleta principal)

1. **Familiarização com a aplicação-base:** leitura do código e da documentação, sem tarefas. Duração registrada.
2. **Prática com a ferramenta de IA:** no mínimo 3 h em tarefas **não relacionadas**, para reduzir o efeito de novidade.
3. **Piloto:** pares P1 e P2 (dados em `data/raw/piloto`, fora da análise principal).
4. **Ajustes pós-piloto** registrados, depois o congelamento (tag `protocolo-v1.0`).

## 8. Procedimento de cada sessão

Roteiro passo a passo: [guia-sessao.md](guia-sessao.md). Em resumo:

1. Checklist do ambiente para a condição sorteada.
2. `exp abrir <exec_id>` monta o workspace e exibe o enunciado.
3. Leitura do enunciado, depois `exp iniciar`.
4. Trabalho, com `exp testar` quando quiser. Pausas só para interrupções externas.
5. `exp entregar` aciona a avaliação oculta automática:
   - aceita → fim;
   - falhas → devolutiva padronizada, depois correção e nova entrega;
   - no máximo 2 rodadas de correção.
6. Tempo-limite de 90 minutos ativos: `exp encerrar-limite`, com avaliação do estado atual e censura.
7. `exp percepcao <minutos>` e, na condição B, `exp anexar <transcrição>`.

## 9. Plano de análise

1. `exp processar`: métricas por execução (`data/processed/<fase>/execucoes.csv`).
2. **Elegibilidade:** exclui execuções abortadas, com a cadeia de eventos violada ou fora do plano. Todas as exclusões são listadas no relatório.
3. **Descritivas por condição:** n, média, desvio-padrão, mediana, quartis, mínimo e máximo.
4. **Inferência (H1–H3):**
   - diferença pareada B − A (em log para o tempo);
   - estimador de Hodges-Lehmann;
   - IC 95% da mediana por *bootstrap* (10.000 reamostragens, semente fixa);
   - **teste de randomização exato por inversão de sinais** (válido pelo desenho);
   - Wilcoxon pareado como verificação;
   - correção de Holm.
5. **Censura:** na análise principal, uma execução não aceita recebe t_aceite = tempo-limite. Na análise de sensibilidade, os pares com censura são excluídos.
6. **H4:** mediana das diferenças por tipo. Análise descritiva, sem teste.
7. **Secundárias:** mesmo procedimento, sem correção, rotuladas como exploratórias.
8. **Interpretação:** "não significativo" ≠ "sem efeito". O texto prioriza estimativas e intervalos.
9. **Casos discrepantes:** investigados com as notas e transcrições e **não removidos**. Se houver justificativa de protocolo, faz-se uma análise adicional com e sem eles.

## 10. Regras de interrupção e desvios

| Situação | Ação |
|---|---|
| Falha de ambiente (máquina, git, Python) | `exp abortar`. A tarefa reserva entra na próxima sessão. Desvio registrado |
| Ferramenta de IA indisponível na condição B | `exp abortar --motivo "IA indisponível"`. Remarcar a execução. **Nunca** executar sem IA no lugar |
| Interrupção externa > 10 min | `exp pausar`/`exp retomar` e uma nota explicando |
| Violação da condição (por exemplo, uso de IA na condição A) | Execução mantida nos dados brutos, marcada como desvio, com análise com e sem ela |
| Modelo diferente do configurado | Registrado via `--modelo`. Se persistir, é um desvio e a decisão fica registrada |

## 11. Ameaças à validade

Ver a seção 10 do [plano-execucao.md](plano-execucao.md) e a [ferramentas-ia.md](ferramentas-ia.md) (ameaças específicas da IA). A versão final irá para o capítulo de metodologia.

## 12. Ética

- **Estudo com um único participante, o próprio pesquisador.** A necessidade de submissão ao CEP deve ser **confirmada com a instituição** (D7). Na replicação opcional com colegas, a submissão ao CEP e o TCLE são pré-requisitos.
- **Nenhum dado pessoal de terceiros.** As transcrições de IA contêm apenas o código da aplicação fictícia.
