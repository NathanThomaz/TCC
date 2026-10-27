# 3 TRABALHOS RELACIONADOS

> Rascunho parcial v0.1 (2026-10-27). As descrições abaixo vêm dos **resumos** dos trabalhos. Cada parágrafo precisa ser revisto após a leitura integral (ficha em `pesquisa/fichas/`).

## 3.1 Estudos sobre tempo e produtividade

**Peng et al. (2023)** conduziram um experimento controlado em que desenvolvedores implementaram um servidor HTTP em JavaScript. O grupo com GitHub Copilot terminou 55,8% mais rápido. O estudo mede uma única tarefa de desenvolvimento a partir do zero e foi publicado como preprint.

**Vaithilingam, Zhang e Glassman (2022)**, em estudo intraparticipante com 24 participantes, não encontraram redução confiável de tempo nem aumento da taxa de sucesso com o Copilot. Os participantes relataram dificuldades para compreender e depurar as sugestões.

**Becker et al. (2025)** randomizaram 246 tarefas reais de 16 desenvolvedores experientes de projetos de código aberto entre as condições "IA permitida" e "IA proibida". O tempo de conclusão foi 19% maior com IA, ao passo que os desenvolvedores estimavam um ganho de cerca de 20%. A **randomização no nível da tarefa, com o mesmo desenvolvedor nas duas condições**, é o precedente mais próximo do desenho deste trabalho.

**Cui et al. (2026)** reuniram três experimentos de campo (4.867 desenvolvedores) e estimaram 26,08% mais tarefas concluídas com o Copilot. Os ganhos foram maiores entre os menos experientes.

**Martin-Lopez et al. (2026)**, com 69 participantes que fizeram uma tarefa com IA e outra sem, encontraram efeito inconclusivo sobre o tempo e uma completude da tarefa muito maior com IA. O estudo também investigou a capacidade de explicar o próprio código [VERIFICAR os resultados de *ownership*].

## 3.2 Estudos sobre qualidade, segurança e manutenibilidade

**Perry et al. (2023):** participantes com assistente de IA produziram código menos seguro e confiavam mais na sua segurança.

**Pearce et al. (2022)** avaliaram o código sugerido pelo Copilot em 89 cenários baseados em fraquezas do catálogo CWE [VERIFICAR os percentuais no texto integral].

**Moradi Dakhel et al. (2023)** compararam soluções do Copilot com soluções humanas em problemas algorítmicos e concluíram que a ferramenta pode ser um ativo para especialistas e um passivo para iniciantes.

**Borg et al. (2025)**, em experimento pré-registrado de duas fases com 151 participantes, não encontraram diferença significativa no tempo nem na qualidade quando novos desenvolvedores evoluíram código produzido com ou sem IA.

## 3.3 Síntese e posicionamento deste trabalho

> A completar após a Etapa 2. Esboço do quadro comparativo:

| Estudo | Desenho | Tarefas | Tempo | Qualidade | Retrabalho pós-avaliação | Testes ocultos |
|---|---|---|---|---|---|---|
| Peng et al. (2023) | Entre grupos | 1, *greenfield* | ✔ | parcial [VERIFICAR] | — [VERIFICAR] | [VERIFICAR] |
| Vaithilingam et al. (2022) | Intraparticipante | 3 [VERIFICAR] | ✔ | sucesso | — [VERIFICAR] | — |
| Becker et al. (2025) | Randomização por tarefa | *Issues* reais | ✔ | [VERIFICAR] | [VERIFICAR] | — |
| Borg et al. (2025) | 2 fases, ECR | Evolução Java | ✔ | ✔ (manutenibilidade) | — | [VERIFICAR] |
| Martin-Lopez et al. (2026) | 2 tarefas/participante | [VERIFICAR] | ✔ | completude | — | [VERIFICAR] |
| **Este trabalho** | N-de-1 randomizado por pares | 4 tipos de manutenção | ✔ | ✔ (ocultos, severidade, estática) | ✔ | ✔ |

O posicionamento pretendido é um **ciclo completo de medição** (entrega, avaliação oculta, devolutiva e retrabalho) em tarefas de manutenção com tipos distintos. A lacuna precisa ser **confirmada** pela revisão. Se estudos já cobrirem esse ciclo, a contribuição será reformulada como replicação em outro contexto.
