# Métricas — definições operacionais

As métricas são calculadas por [src/tcc_exp/metricas.py](../src/tcc_exp/metricas.py) a partir dos eventos de `data/raw/<fase>/sessoes/<exec_id>.jsonl`. Se uma definição mudar aqui, o código muda junto, e vice-versa.

## Eventos que delimitam os intervalos

| Evento | Quando ocorre | Quem gera |
|---|---|---|
| `abertura` | O workspace é montado e o enunciado é exibido | `exp abrir` |
| `inicio` | O executor terminou de ler e começa a trabalhar | `exp iniciar` |
| `pausa` / `retomada` | Interrupção externa | `exp pausar` / `exp retomar` |
| `teste_publico` | Execução dos testes públicos | `exp testar` |
| `entrega` | O executor declara a solução pronta (o código é congelado num commit) | `exp entregar` |
| `avaliacao` | Resultado dos testes ocultos sobre a entrega | Automático, após a entrega |
| `devolutiva` | O relatório padronizado de cenários não atendidos é exibido | Automático, se houver falhas e rodadas disponíveis |
| `fim` | Execução encerrada: `aceita`, `rejeitada` (rodadas esgotadas) ou `limite` | Automático ou `exp encerrar-limite` |

**Tempo ativo** = tempo de relógio entre dois eventos **menos** os intervalos entre `pausa` e `retomada`.

**"Devolutiva"** neste trabalho é **o evento em que o resultado da avaliação independente (testes ocultos) é comunicado ao executor**. O *tempo de correção após a devolutiva* vai desse evento até a entrega seguinte.

## Matriz de indicadores

| Indicador | Definição operacional | Unidade | Coleta | Interpretação | Limitações |
|---|---|---|---|---|---|
| `t_leitura_min` | Tempo ativo de `abertura` a `inicio` | min | Eventos | Esforço de compreensão do enunciado | Depende do momento em que o executor decide começar |
| `t_1a_entrega_min` | Tempo ativo de `inicio` à 1ª `entrega` | min | Eventos | Velocidade bruta | Sozinha, recompensa entregas apressadas |
| **`t_aceite_min`** (H1) | Tempo ativo de `inicio` ao `fim` aceito. Execução não aceita = tempo-limite (censura) | min | Eventos | Agilidade condicionada à qualidade | A censura achata a cauda. Há análise de sensibilidade |
| `t_total_min` | Tempo ativo de `inicio` a `fim`, aceita ou não | min | Eventos | Esforço total | — |
| **`taxa_ocultos_1a`** (H2) | Testes ocultos aprovados na 1ª entrega ÷ total previsto no manifesto | proporção | pytest + JUnit XML | Qualidade funcional na 1ª entrega | Vale tanto quanto a cobertura dos testes ocultos. Testes não coletados (erro de importação) contam como reprovados |
| `taxa_ocultos_final` | Idem, na última entrega | proporção | pytest | Qualidade alcançada | Efeito teto esperado |
| `defeitos_1a_{critico,maior,menor}` | Testes ocultos reprovados na 1ª entrega, por severidade definida no manifesto antes da coleta | contagem | Manifesto × resultado | Gravidade dos defeitos | Severidade atribuída pelo autor da tarefa |
| `ciclos` | Número de devolutivas | 0–2 | Eventos | Retrabalho (contagem) | Escala curta |
| **`t_retrabalho_min`** (H3) | Soma do tempo ativo de cada `devolutiva` à `entrega` seguinte (ou ao `fim`) | min | Eventos | Esforço de correção pós-avaliação | Vale 0 quando a 1ª entrega é perfeita |
| `churn_pos_1a_linhas` | Linhas adicionadas + removidas entre o commit da 1ª entrega e o final | linhas | `git diff --numstat` | Retrabalho em volume | Não distingue o tipo de mudança |
| `tamanho_diff_linhas` | Linhas adicionadas + removidas entre o estado inicial e o final | linhas | `git diff --numstat` | Parcimônia da solução | Mais linhas não significa necessariamente pior |
| `delta_alertas_ruff` | Alertas do ruff (regras E, F, W, B, C90, SIM) no final menos no início | contagem | ruff | Conformidade estática | `None` se o ruff não estiver instalado |
| `delta_cc_soma` | Soma da complexidade ciclomática (radon) no final menos no início | CC | radon | Possível perda de manutenibilidade | Métrica isolada é fraca |
| `n_testes_publicos` | Número de `exp testar` | contagem | Eventos | Esforço de validação | Estilo pessoal |
| `percepcao_erro_min` | Estimativa do executor menos `t_total_min` | min | `exp percepcao` | Viés de percepção | Autorrelato |
| `confianca_1a` | Resposta 1–5 a "quão confiante você está de que a entrega atende a TODOS os cenários?", dada **antes** de ver a avaliação da 1ª entrega | 1–5 | `exp entregar --confianca` | Comparada com `taxa_ocultos_1a`, mede a calibração e o excesso de confiança (cf. Perry et al., 2023) | Escala ordinal, autorrelato |
| `dificuldade_percebida` | Dificuldade da tarefa, 1 (muito fácil) a 5 (muito difícil) | 1–5 | `exp questionario` | Controle da equivalência das gêmeas | Influenciada pela condição |
| `esforco_mental` | Esforço mental percebido, 1 a 5 | 1–5 | `exp questionario` | Custo cognitivo | Autorrelato |
| `utilidade_ia` (só B) | Utilidade percebida da IA, de 1 (atrapalhou muito) a 5 (ajudou muito) | 1–5 | `exp questionario --utilidade-ia` | Percepção × medição | Autorrelato |
| Uso da IA (descritor, só B) | Transcrições anexadas | — | `exp anexar` | Caracteriza o tratamento. **Não é desfecho** | Depende do que a ferramenta exporta |

## Regras de tratamento

- **Arredondamento:** as métricas de tempo são guardadas em minutos com 4 casas decimais.
- **Ausências:** uma métrica sem dado fica vazia (NaN). Ela **nunca** é preenchida com zero nem com médias.
- **Execuções abortadas:** permanecem nos dados brutos e processados, com `abortada=True`, e são excluídas da análise com listagem no relatório.
