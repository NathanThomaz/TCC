# Plano de execução do TCC — versão 0.1 (proposta, aguardando aprovação)

Data: 2026-10-27. Status: **recomendações adotadas provisoriamente** (D1, D4, D5, D6), em 2026-10-27, a pedido do autor, que solicitou a montagem completa do projeto. Elas ainda precisam ser validadas pelo orientador. Situação de cada decisão: [decisoes-metodologicas.md](decisoes-metodologicas.md).

> Atualização: a seção 11 (estrutura) foi implementada. O protocolo operacional está em [protocolo-experimental.md](protocolo-experimental.md).

Convenção usada no texto:
- **[LIT]**: fato publicado. As referências estão em [../pesquisa/referencias-verificadas.md](../pesquisa/referencias-verificadas.md), por enquanto verificadas apenas no nível de metadados e resumo.
- **[PROPOSTA]**: decisão recomendada por mim, ainda pendente de aprovação.
- **[NÃO VALIDADO]**: suposição que o piloto ou a revisão bibliográfica precisa confirmar.

---

## 0. Diagnóstico do ambiente

- A pasta contém `Tema TCC.txt`, `Título do TCC.txt` e uma `Nova pasta/` vazia. Não há código, dados ou manual institucional. Antes deste plano, não era um repositório git.
- Ferramentas disponíveis: Python 3.11.9, pip, git 2.49, Node 22. Já estão instalados pandas, numpy, scipy, matplotlib e pytest. Não estão instalados ruff, radon e statsmodels, que só serão instalados quando justificados.
- Busca web disponível. O acesso a textos integrais pagos (IEEE, ACM, Springer) **não está garantido**. Preprints arXiv são acessíveis. O acesso institucional da faculdade será necessário para alguns textos integrais.
- Ainda não sabemos: o prazo de entrega, o manual da instituição, quem orienta o trabalho, o perfil técnico de quem executará as tarefas e qual ferramenta de IA está disponível.

---

## 1. Avaliação crítica da viabilidade

**O tema é viável, mas a contribuição precisa ser delimitada com cuidado, porque o núcleo do tema já foi bastante estudado.**

O que a busca inicial mostrou [LIT]:
- Já existem experimentos controlados sobre IA × tempo × qualidade, com resultados **contraditórios**: 55,8% mais rápido (Peng et al., 2023), nenhum ganho confiável (Vaithilingam et al., 2022), **19% mais lento** em desenvolvedores experientes (Becker et al., 2025), +26% de tarefas concluídas em campo (Cui et al., 2026), ausência de efeito sobre a manutenibilidade posterior (Borg et al., Echoes of AI) e tempo inconclusivo com completude maior (Martin-Lopez et al., TSE 2026).
- Becker et al. (2025) usam exatamente a lógica que o prompt sugere: o mesmo desenvolvedor faz várias tarefas, e cada tarefa é sorteada para "com IA" ou "sem IA". Martin-Lopez et al. (2026) usam duas tarefas por participante, uma em cada condição.

Consequências:
1. **Não é defensável alegar originalidade** em "medir se a IA acelera o desenvolvimento". A pergunta genérica já tem respostas, embora contraditórias.
2. A contradição na literatura é, por si só, uma justificativa: os efeitos parecem depender do **tipo de tarefa, da experiência do desenvolvedor, da ferramenta e da forma de medir**. Um TCC pode contribuir com evidência **delimitada e bem instrumentada** em um contexto específico. Ele não pode resolver a controvérsia.
3. A maioria dos estudos citados mede **tempo até a conclusão** e **uma** medida de qualidade. Ao que parece, poucos medem o **ciclo completo entrega → avaliação independente → retrabalho**, com testes ocultos e tempo de correção depois da devolutiva. Essa lacuna é **[NÃO VALIDADO]**: precisa ser confirmada na revisão sistemática da Etapa 2. Se não se confirmar, a delimitação será revista.
4. Com um único executor, o estudo **não generaliza para desenvolvedores**. Ele produz evidência causal válida apenas **para aquele executor, aquelas tarefas e aquela ferramenta**. Isso é aceitável em um TCC se for dito claramente desde o título.

**Riscos que inviabilizariam o estudo (detalhados na seção 10):** o próprio executor escrever as tarefas e os testes ocultos (conhece as respostas); a ferramenta de IA ter acesso ao gabarito; número de tarefas pequeno demais para qualquer inferência.

---

## 2. Problema de pesquisa

**Pergunta original:** "Em que medida o uso de IA generativa no desenvolvimento e na manutenção de software altera o tempo de entrega, a qualidade técnica e o esforço de retrabalho das soluções produzidas?"

**Problemas:** não delimita tarefas, linguagem, ferramenta nem executor. "Qualidade técnica" e "tempo de entrega" não têm definição operacional. Lida literalmente, ela pede uma resposta geral que um TCC não consegue dar.

**Formulação recomendada [PROPOSTA]:**

> Em tarefas de manutenção e evolução de uma aplicação de pequeno porte em Python e SQL, executadas sob protocolo controlado, como o uso de um assistente de IA generativa altera (a) o tempo até uma entrega aceita, (b) a qualidade funcional da entrega, medida por testes de avaliação ocultos, e (c) o retrabalho necessário após a devolutiva de avaliação, em comparação com a execução sem esse assistente?

Por que ela é metodologicamente superior:
- Cada termo vira uma variável observável (seção 4).
- O contexto de validade fica explícito: tipo de tarefa, linguagem, ferramenta e condição.
- "Como altera" admite efeito positivo, negativo ou nulo, e também o sinal oposto entre tempo e qualidade.
- Inclui o ciclo de devolutiva, que é o ponto de possível contribuição.

**Título refinado (sugestão):** "Avaliação experimental do impacto de um assistente de IA generativa no tempo, na qualidade e no retrabalho em tarefas de manutenção de software". Se o desenho N-de-1 for aprovado, acrescentar: "...: um estudo de caso único randomizado".

---

## 3. Objetivos revisados [PROPOSTA]

**Objetivo geral:** avaliar experimentalmente, em tarefas controladas de manutenção e evolução de software, como o uso de um assistente de IA generativa altera o tempo até a entrega aceita, a qualidade funcional e o retrabalho após a devolutiva, em comparação com a execução sem assistência.

**Objetivos específicos:**
1. Sintetizar a evidência empírica publicada sobre os efeitos de assistentes de IA generativa no tempo, na qualidade e no esforço de validação, identificando divergências e suas possíveis causas. *(mantido, mais preciso)*
2. Elaborar e pré-registrar um protocolo experimental com randomização das tarefas entre condições. *(une os antigos 2 e 4)*
3. Construir um conjunto de tarefas pareadas com critérios de aceitação objetivos e testes de avaliação ocultos. *(antigo 3)*
4. Implementar e testar um instrumento de registro de eventos, versões e resultados de testes. *(antigo 5)*
5. Executar um piloto e ajustar o protocolo antes da coleta principal. *(antigo 6)*
6. Executar a coleta principal e analisar os dados com estatística descritiva e inferência compatível com o desenho. *(une os antigos 7 e 8)*
7. Analisar, de forma exploratória, se a relação entre tempo e qualidade difere por tipo de tarefa. *(antigo 9, agora explicitamente exploratório)*
8. Documentar as ameaças à validade e os limites de generalização. *(antigo 10)*

Mudanças: os objetivos 4 e 8 originais foram absorvidos, porque definir métricas faz parte do protocolo. O 9 virou exploratório, porque com poucas tarefas por tipo não há poder estatístico para testá-lo de forma confirmatória.

---

## 4. Hipóteses e variáveis [PROPOSTA]

**Variável independente:** condição ∈ {A = sem IA, B = com IA}.

| Hipótese | Variável primária | H0 estatística | Natureza |
|---|---|---|---|
| H1: a IA altera o tempo até a entrega aceita | `t_aceite` (min), em escala log | A mediana da diferença pareada de log(t_aceite) entre B e A é 0 | Confirmatória |
| H2: a IA altera a qualidade funcional da primeira entrega | `taxa_ocultos_1a` (% de testes ocultos aprovados na 1ª entrega) | A mediana da diferença pareada é 0 | Confirmatória |
| H3: a IA altera o retrabalho após a devolutiva | `t_retrabalho` (min) e `ciclos` (nº de rodadas de correção) | A mediana da diferença pareada é 0 | Confirmatória (`t_retrabalho`), descritiva (`ciclos`) |
| H4: a relação tempo × qualidade varia por tipo de tarefa | Diferenças B−A de H1 e H2, estratificadas por tipo | — | **Exploratória**. Sem teste formal, porque haverá ~3 pares por tipo |

Todas as hipóteses são **bilaterais**: não pressupõem a direção do efeito.

**Variáveis de controle:** o executor (fixo), a linguagem e o ambiente (fixos), o par de tarefas (bloco), a posição na sequência (covariável de aprendizagem), a ordem dentro do par (A primeiro ou B primeiro) e a versão do modelo de IA (registrada em cada sessão).

**Correção para múltiplas comparações:** três testes confirmatórios. Recomendo Holm-Bonferroni.

---

## 5. Comparação de desenhos experimentais

| Desenho | Como funciona | Prós | Contras | Viabilidade em TCC |
|---|---|---|---|---|
| **D1. Caso único randomizado (N-de-1)** | Você executa N pares de tarefas equivalentes. Em cada par, um sorteio define qual gêmea é feita com IA, e a ordem é contrabalanceada | Sem recrutamento e sem CEP (a confirmar com a instituição). Controle total do ambiente. Inferência por **teste de randomização**, válido pelo próprio desenho (Edgington & Onghena; a verificar). Semelhante ao nível de randomização de Becker et al. | Não generaliza para outros desenvolvedores. Executor não cego, com risco de expectativa. Aprendizagem acumulada ao longo da coleta | **Alta** |
| D2. Crossover com 6–12 colegas | Cada participante faz um par (A/B) com ordem contrabalanceada | Alguma variabilidade entre pessoas. Mais próximo de Vaithilingam et al. e Martin-Lopez et al. | Exige CEP/termo de consentimento, recrutamento e agendamento. Pouco poder com n pequeno. Perfis heterogêneos | Média ou baixa, dependendo do prazo |
| D3. Entre grupos | Grupos diferentes, um com IA e outro sem | Sem efeito de transferência | Exige muitos participantes para ter poder. Inviável | Baixa |
| D4. Híbrido (D1 + replicação pequena) | D1 como estudo principal, mais 2–4 colegas fazendo 2 pares cada como replicação | Responde parcialmente à crítica "n = 1" | Acrescenta CEP e logística. Os dados da replicação servem apenas para análise descritiva | Média. Opcional |
| D5. Sem humanos (só IA em benchmark) | Rodar o modelo sozinho e medir pass@k | Barato e reprodutível | Não mede o **processo** humano, que é o foco do TCC. Descartado | — |

### Recomendação [PROPOSTA]: D1, com D4 como extensão opcional se o prazo permitir

Justificativa: o foco do TCC é o processo e a qualidade da entrega, não a variação entre pessoas. D1 permite controle rigoroso e randomização real, e o custo logístico cabe em um TCC. A limitação (n = 1 executor) é declarada no título e na seção de ameaças, e as conclusões ficam restritas ao contexto estudado. Na Engenharia de Software, randomizar no nível da tarefa com o mesmo desenvolvedor nas duas condições tem precedente direto em Becker et al. (2025) [LIT]. Lá, cada desenvolvedor contribuiu com várias tarefas randomizadas.

### Detalhamento do D1

- **Unidade experimental:** a execução de uma tarefa (tarefa × condição).
- **Bloco:** par de tarefas gêmeas (T*k*a, T*k*b), equivalentes em tipo, tamanho da mudança e número de critérios, mas com **defeito ou funcionalidade diferente** e **módulo diferente** do sistema, para que resolver uma não entregue a solução da outra.
- **Randomização (antes da coleta, com semente registrada):**
  1. Em cada par, sortear qual gêmea recebe IA. Isso neutraliza diferenças residuais de dificuldade entre gêmeas.
  2. Sortear a ordem dentro do par (A→B ou B→A), balanceada para que metade dos pares comece com IA.
  3. Sortear a ordem dos pares ao longo das semanas, intercalando os tipos.
  4. Publicar o plano de randomização com hash no git **antes** da 1ª sessão.
- **Tamanho [PROPOSTA]:** 4 tipos de tarefa × 3 pares = **12 pares, 24 execuções**. Com limite de 90 minutos por execução, são no máximo ~36 h de execução, ~6 sessões por semana durante 4 semanas. Com 12 pares, o teste de randomização tem 2¹² = 4.096 permutações possíveis, o que é suficiente para p < 0,05 se houver um efeito consistente. Mesmo assim, o estudo **só detectará efeitos grandes**. Isso será declarado, e a análise priorizará estimativas e intervalos.
- **Tempo-limite:** 90 minutos por execução [NÃO VALIDADO, calibrar no piloto]. Se o limite for atingido, a execução é registrada como **censurada** (tempo ≥ 90), e a qualidade é medida no estado em que estiver. Censura não é exclusão.
- **Regras de interrupção:** falha de ambiente (registrada como desvio, sessão repetida com outra tarefa reserva); indisponibilidade da API na condição B (sessão abortada e registrada, **sem substituição por resultado fictício**); interrupção externa acima de 10 minutos (o relógio é pausado e o evento registrado).
- **Critério de conclusão da tarefa:** todos os testes **públicos** passam e o executor declara a entrega (`submit`). A entrega então é avaliada pelos testes **ocultos**.
- **Ciclo de devolutiva (operacionaliza "devolutiva" e "retrabalho"):** após cada `submit`, o instrumento roda os testes ocultos e devolve ao executor um **relatório de defeitos padronizado** (nome do cenário que falhou e comportamento esperado, sem mostrar o teste). O executor corrige e reenvia. O ciclo para quando 100% dos ocultos passam, depois de 2 rodadas de correção, ou quando o tempo-limite total é atingido.

### Controle de contaminação e vieses

| Problema | Estratégia |
|---|---|
| Efeito de aprendizagem | Ordem contrabalanceada dentro do par, posição na sequência como covariável, tipos intercalados e familiarização com a base de código **antes** da coleta (sessão de leitura sem tarefas) |
| Familiaridade com a tarefa | **O executor não escreve as tarefas nem os testes ocultos** (ver D4 na lista de decisões) |
| Diferença de complexidade entre gêmeas | Pareamento por métricas objetivas da solução de referência (linhas alteradas, nº de critérios, complexidade) e sorteio da gêmea que recebe IA |
| Gêmea resolvida "entrega" a outra | Defeitos ou funcionalidades distintos, em módulos distintos, e verificação disso no piloto |
| Experiência com a linguagem ou a ferramenta | Registrar o perfil antes da coleta. Período de prática com a ferramenta de IA **antes** da coleta (fora dos dados) |
| Variação e versão do modelo | Uma única ferramenta e modelo fixados. Versão, data e (quando houver) parâmetros registrados em cada sessão. Transcrições salvas como dado bruto |
| Documentação consultada | Lista de recursos permitidos, igual nas duas condições (documentação oficial do Python, pandas e SQLite). **Na condição A, sem buscadores com respostas de IA** (por exemplo, resumos gerados por IA em mecanismos de busca), sem chat e sem autocompletar por IA no editor |
| Tempo de revisão | Medido, não controlado. Faz parte do efeito que interessa |
| Contaminação entre condições | Perfis separados no editor: o perfil A tem extensões de IA desativadas e o instrumento verifica isso no `start` |
| IA com acesso ao gabarito | Testes ocultos e soluções de referência **fora** do diretório de trabalho e cifrados. Ferramentas agênticas só enxergam o *workspace* da tarefa |
| Expectativa do executor (não há cegamento) | Resultados medidos automaticamente (relógio do instrumento e testes ocultos). Protocolo e análise pré-registrados. Classificação de severidade por rubrica, com uma 2ª avaliação (orientador) em uma amostra |
| Reatividade (saber que está sendo medido) | Rotina de coleta idêntica nas duas condições. Algumas sessões de prática antes da coleta |

---

## 6. Tarefas experimentais [PROPOSTA]

**Sistema-base:** uma aplicação pequena e realista (~1.500 a 3.000 linhas) em Python com SQLite, por exemplo um sistema de pedidos e estoque com uma rotina de importação de dados (ETL). Um sistema próprio evita problemas de licença e evita **contaminação de dados de treino**: bugs de projetos públicos (BugsInPy, SWE-bench) podem ter sido memorizados pelos modelos, o que inflaria artificialmente o desempenho da condição B.

**Quatro tipos de tarefa** (subconjunto das sugestões do prompt, escolhido por cobrir correção, evolução, dados e robustez):

| Tipo | Descrição | Por que incluir |
|---|---|---|
| T1. Correção de defeito | Regra de negócio com comportamento incorreto, a partir de um relato de bug | Manutenção corretiva, a tarefa mais comum |
| T2. Nova funcionalidade | Implementar um requisito especificado com critérios de aceitação | Manutenção evolutiva |
| T3. Consulta SQL incorreta | Relatório que devolve resultados errados em certos cenários | Domínio de dados. Defeitos sutis (JOIN, NULL, agregação) |
| T4. Robustez do pipeline | Etapa de ETL que falha com entradas de borda (tratamento de exceções, validação) | Casos de borda, onde a qualidade costuma divergir |

Refatoração e "escrever testes" ficam de fora: a avaliação objetiva dessas tarefas é mais difícil e ampliaria o escopo.

**Ficha de cada tarefa** (modelo a ser criado na Etapa 3): identificador, objetivo, contexto técnico, requisitos funcionais e não funcionais, estado inicial (commit), critérios de aceitação, testes públicos, testes ocultos (quantidade, cenários e severidade de cada cenário), complexidade estimada (métricas da solução de referência), dependências, condição sorteada e pontuação.

**Separação entre testes públicos e ocultos:** os públicos cobrem o "caminho feliz" e os critérios explícitos. Os ocultos cobrem casos de borda decorrentes **dos mesmos requisitos escritos**, não requisitos escondidos. Esse cuidado evita que a tarefa seja injusta, e a separação se apoia em Liu et al. (2023) [LIT].

**Piloto:** 2 pares adicionais, **não usados** na coleta principal.

---

## 7. Matriz preliminar de métricas [PROPOSTA]

Todos os eventos são registrados automaticamente pelo instrumento (seção 9), com relógio do sistema e em arquivo apenas de acréscimo.

| Indicador | Definição operacional | Unidade | Coleta | Ferramenta | Interpretação | Limitações |
|---|---|---|---|---|---|---|
| **t_aceite** (primário H1) | Do evento `start` (após a leitura do enunciado, cuja duração é registrada à parte) até o `submit` em que 100% dos ocultos passam, ou até o limite | min | Eventos do instrumento | CLI própria | Menor = mais ágil, **condicionado** à qualidade | Censura no limite. Pausas dependem de registro honesto |
| t_1a_entrega | `start` → 1º `submit` | min | Eventos | CLI | Velocidade bruta, separada da qualidade | Sozinha, é enganosa: quanto mais rápida, maior pode ser o retrabalho |
| **taxa_ocultos_1a** (primário H2) | % de testes ocultos aprovados na 1ª entrega | % | pytest na entrega congelada | pytest | Maior = melhor qualidade funcional | Depende da cobertura dos testes ocultos |
| defeitos_1a por severidade | Cenários ocultos que falham, classificados por rubrica pré-definida (crítico/maior/menor) | contagem | Mapeamento cenário → severidade, definido junto com a tarefa | Rubrica | Menos defeitos e menos graves = melhor | A severidade é atribuída a priori pelo autor da tarefa |
| taxa_ocultos_final | % de ocultos aprovados na última entrega | % | pytest | pytest | Qualidade final alcançada | Efeito teto provável |
| **t_retrabalho** (primário H3) | Soma dos intervalos devolutiva → reenvio | min | Eventos | CLI | Maior = mais esforço de correção | Zero quando a 1ª entrega já é perfeita |
| ciclos | Nº de rodadas de devolutiva até a aceitação | contagem (0–2) | Eventos | CLI | Mais = mais retrabalho | Escala curta e discreta |
| churn_pós_1a | Linhas adicionadas e removidas depois da 1ª entrega | linhas | git diff entre *snapshots* | git | Retrabalho em volume | Não diferencia o tipo de alteração |
| tamanho_diff | Linhas alteradas na entrega final em relação ao estado inicial | linhas | git diff | git | Aproxima a parcimônia da solução (possível "inchaço" com IA) | Mais linhas não significa necessariamente pior |
| Δ complexidade | Variação da complexidade ciclomática das funções alteradas | CC | Análise estática | radon (a instalar) | Aumento = possível perda de manutenibilidade | Métrica isolada é fraca |
| Δ alertas estáticos | Variação no nº de alertas do linter, com regras fixadas | contagem | Análise estática | ruff (a instalar) | Aumento = pior conformidade | Depende das regras escolhidas |
| n_execucoes_teste | Nº de vezes que o executor rodou os testes públicos | contagem | Wrapper de teste | CLI | Aproxima o esforço de validação | Estilo pessoal influencia |
| uso_IA (descritor, só em B) | Nº de interações com a IA e tamanho das trocas | contagem | Transcrição salva | Exportação da ferramenta | Caracteriza o tratamento. **Não é desfecho** | Depende do que a ferramenta exporta |
| Δ percepção (secundário, opcional) | Tempo estimado pelo executor ao terminar menos o tempo real | min | Questionário de 1 pergunta | CLI | Viés de percepção (cf. Becker et al.) | Autorrelato |

**Descartados por agora:** acoplamento (as tarefas são localizadas demais para isso fazer sentido), legibilidade por avaliação humana (cara e subjetiva com um único avaliador) e duplicação (pouco provável em diffs pequenos). Podem voltar se o piloto mostrar utilidade.

**Tempo por fase (revisão e depuração):** marcar fases manualmente é pouco confiável. Alternativa opcional: gravar a tela e codificar as fases depois, com um esquema inspirado no CUPS (Mozannar et al., 2024) [LIT]. O custo é alto (horas de vídeo), então recomendo **apenas em uma amostra** (por exemplo, 4 pares), como análise qualitativa complementar. Decisão D6.

---

## 8. Estratégia de revisão bibliográfica

**Tipo:** revisão *estruturada* (não uma revisão sistemática completa, que é grande demais para um TCC), seguindo os princípios de Kitchenham & Charters (a verificar): string de busca, bases, critérios de inclusão e exclusão documentados, e *snowballing* a partir dos estudos-semente.

- **Estudos-semente:** A1–A3 e A5–A8 de [referencias-verificadas.md](../pesquisa/referencias-verificadas.md).
- **String de busca (rascunho):** `("generative AI" OR "large language model" OR LLM OR Copilot OR "AI assistant" OR "coding assistant") AND ("developer productivity" OR "task completion time" OR "code quality" OR maintainability OR defects OR rework) AND (experiment OR "controlled study" OR "randomized" OR "user study")`.
- **Bases:** ACM DL, IEEE Xplore, Scopus (se houver acesso institucional), arXiv e Google Scholar (para *snowballing*).
- **Período:** 2021–2026, mais clássicos metodológicos sem restrição de data.
- **Inclusão:** estudo empírico com humanos ou com código gerado avaliado quanto a tempo, qualidade ou manutenção, publicado ou em preprint identificado como tal.
- **Exclusão:** opinião sem dados, material de marketing de fornecedor e estudos sem método descrito. Literatura cinzenta (DORA, GitClear) entra apenas como contexto, rotulada como tal.
- **Ficha por artigo:** os campos pedidos na seção 6 do prompt, mais "acesso: resumo/integral".
- **Entregável:** `pesquisa/revisao-literatura.md` e `pesquisa/referencias.bib`, com uma síntese que confirme ou refute a lacuna da seção 1.

---

## 9. Ferramentas e arquitetura [PROPOSTA, implementar apenas após aprovação]

Instrumento mínimo e local:
- **CLI em Python** (`exp start|pause|resume|submit|end`) que grava eventos em **JSONL apenas de acréscimo** em `data/raw/`, tira um *snapshot* git do *workspace* a cada evento, roda os testes públicos sob demanda e os ocultos no `submit`, e gera a devolutiva padronizada.
- **Sem banco de dados:** JSONL e CSV bastam para ~24 execuções, e SQLite não traria benefício metodológico.
- **Análise:** scripts pandas/scipy versionados (`data/raw` → `data/processed` → `reports/`) e matplotlib para figuras.
- **Estatística:** teste de randomização (permutação dos rótulos dentro de cada par, respeitando o plano sorteado) e Wilcoxon pareado como verificação. Estimativa de efeito pela mediana das diferenças pareadas (Hodges-Lehmann), razão de tempos em log e IC 95% por *bootstrap*. Execuções censuradas são tratadas por postos, com sensibilidade testada (imputação no limite e exclusão).
- **IA:** um adaptador apenas **registra** a condição e os metadados (ferramenta, modelo, versão, data). O instrumento **não chama a API de IA**: quem usa a IA é o executor, então não há geração automática de resultados. Se a ferramenta escolhida for via API, a falta de disponibilidade aborta a sessão, como descrito na seção 5.
- **Testes do próprio instrumento:** pytest (unitários e de integração), com **dados sintéticos rotulados como sintéticos**, em `tests/fixtures/`, nunca em `data/`.
- **Segredos:** `.env` no `.gitignore` e `.env.example` sem valores.

---

## 10. Riscos e ameaças à validade

| Ameaça | Tipo (Wohlin et al.) | Gravidade | Mitigação |
|---|---|---|---|
| n = 1 executor | Externa | Alta | Declarar e restringir as conclusões. Replicação opcional (D4) |
| Executor conhece as tarefas ou os testes | Interna | **Crítica** | Tarefas de autoria de terceiros, cifradas, abertas apenas no `start` |
| Ausência de cegamento e viés de expectativa | Interna | Alta | Desfechos automáticos e pré-registro |
| Aprendizagem ao longo da coleta | Interna | Média | Contrabalanceamento e covariável de posição |
| Gêmeas não equivalentes | Interna | Média | Pareamento por métricas, sorteio e checagem no piloto |
| Testes ocultos não representam a "qualidade" | Constructo | Média | Múltiplos indicadores, ocultos derivados dos requisitos e rubrica de severidade |
| Tarefas artificiais (sistema pequeno) | Externa | Média | Declarar. Tarefas inspiradas em defeitos típicos |
| Modelo muda durante a coleta | Interna/Conclusão | Média | Fixar a versão quando possível, registrar por sessão e concentrar a coleta em poucas semanas |
| Autor das tarefas é um modelo de IA (se D4 = Claude) | Interna | Média | Revisão humana (orientador). Preferir que a ferramenta da condição B seja de outro fornecedor, ou declarar a ameaça |
| Baixo poder estatístico | Conclusão | Alta | Priorizar estimativas com IC. Não interpretar "não significativo" como "sem efeito" |
| Escopo e prazo | Projeto | Média | Cortes previstos: 3 tipos de tarefa e 8 pares como mínimo aceitável |

---

## 11. Estrutura do repositório [PROPOSTA]

Criados agora: `README.md`, `.gitignore`, `docs/plano-execucao.md`, `docs/decisoes-metodologicas.md` e `pesquisa/referencias-verificadas.md`. O restante será criado **quando houver conteúdo**.

```
TCC/
  README.md, .gitignore, pyproject.toml*, .env.example*, CHANGELOG.md*
  docs/            planejamento, protocolo (versionado), métricas, decisões
  pesquisa/        estratégia de busca, fichas, referencias.bib, revisão
  experiment/      sistema-base*, tarefas (fichas públicas)*, plano de randomização*
  sealed/          tarefas, testes ocultos e soluções cifrados* (somente hashes no git)
  src/tcc_exp/     collection/ (CLI de eventos)*, evaluation/*, analysis/*, reporting/*
  data/            raw/ (somente acréscimo), processed/, README.md*
  reports/         figures/, tables/*
  thesis/          estrutura e capítulos* (após o manual da instituição)
  tests/           unit/, integration/, fixtures/ (dados sintéticos)*
```
`*` = criar na etapa correspondente.

Os arquivos originais `Tema TCC.txt`, `Título do TCC.txt` e `Nova pasta/` foram mantidos intactos. Você decide se quer movê-los ou removê-los.

---

## 12. Cronograma (em semanas relativas; ajustar ao prazo real)

| Etapa | Semanas | Depende de | Entregáveis | Critério de conclusão |
|---|---|---|---|---|
| E1. Descoberta e planejamento | 1–2 | — | Este plano, decisões D1–D7 aprovadas | Todas as decisões registradas em `decisoes-metodologicas.md` |
| E2. Fundamentação | 2–6 | E1 | Fichas, `.bib`, revisão preliminar | ≥ 15 estudos fichados com status de acesso. Lacuna confirmada ou delimitação revista. Nenhuma referência sem verificação |
| E3. Protocolo | 4–8 | E1, E2 (parcial) | Protocolo v1.0, sistema-base, fichas das tarefas, rubrica, plano de randomização | Protocolo revisado pelo orientador. Todas as tarefas com solução de referência passando 100% dos ocultos |
| E4. Piloto | 8–10 | E3 | Instrumento mínimo testado, 2 pares-piloto, relatório de ajustes | Instrumento com testes passando. Ajustes documentados. Tempo-limite calibrado |
| E5. Congelamento | 10–11 | E4 | Protocolo v1.x congelado (tag git), hash dos dados selados | Tag criada **antes** da 1ª sessão principal |
| E6. Execução | 11–15 | E5 | 24 execuções em `data/raw` e registro de desvios | Todas as execuções planejadas feitas ou registradas como desvio |
| E7. Análise | 15–17 | E6 | Scripts, tabelas, figuras e relatório | Pipeline reproduzível do bruto ao relatório com um comando |
| E8. Redação | 12–21 | E2, E7 | Capítulos | Resultados escritos apenas a partir das saídas de E7 |
| E9. Revisão e defesa | 21–24 | E8 | Versão final e slides | Checagem de coerência pergunta → hipóteses → método → resultados. Referências conferidas |

Caminho crítico: E1 → E3 (tarefas) → E4 → E6. **A construção das tarefas (E3) é a etapa mais trabalhosa e arriscada.**

---

## 13. Critérios de conclusão por etapa

Estão na tabela da seção 12. Regra geral: nenhuma etapa é marcada como concluída sem o artefato existir no repositório e o critério ter sido verificado, seja por teste executado, revisão registrada ou commit/tag.

---

## 14. Decisões que dependem da sua aprovação

Ver [decisoes-metodologicas.md](decisoes-metodologicas.md), que traz as alternativas e a recomendação de cada uma.
