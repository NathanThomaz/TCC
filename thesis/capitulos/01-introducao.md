# 1 INTRODUÇÃO

> Rascunho v0.1 (2026-10-27). Citações verificadas apenas no nível de resumo; ver `pesquisa/referencias-verificadas.md`.

## 1.1 Contextualização

Ferramentas de inteligência artificial (IA) generativa voltadas à programação passaram a integrar o cotidiano do desenvolvimento de software. As primeiras eram assistentes de autocompletar código. As mais recentes são agentes capazes de editar vários arquivos e executar testes. A expectativa de que essas ferramentas aumentem a produtividade dos desenvolvedores é difundida [CITAÇÃO NECESSÁRIA], mas a evidência empírica disponível é heterogênea.

Experimentos controlados chegaram a resultados divergentes. Em um experimento com uma única tarefa de implementação de um servidor HTTP em JavaScript, o grupo com acesso ao GitHub Copilot concluiu a tarefa 55,8% mais rápido que o grupo de controle (PENG et al., 2023). Em um estudo intraparticipante com 24 pessoas, Vaithilingam, Zhang e Glassman (2022) não observaram redução confiável do tempo de conclusão nem aumento da taxa de sucesso, e relataram dificuldades dos participantes para compreender e depurar as sugestões. Em um ensaio randomizado com 16 desenvolvedores experientes trabalhando em seus próprios projetos de código aberto, permitir o uso de ferramentas de IA aumentou o tempo de conclusão das tarefas em 19%, embora os participantes acreditassem ter ficado mais rápidos (BECKER et al., 2025). Em escala de campo, três experimentos com 4.867 desenvolvedores estimaram um aumento de 26,08% no número de tarefas concluídas (CUI et al., 2026).

Quanto à qualidade, os resultados também não convergem. Há evidência de que participantes com assistente de IA escreveram código menos seguro e, ainda assim, confiavam mais na segurança desse código (PERRY et al., 2023). Por outro lado, um experimento pré-registrado com 151 participantes não encontrou diferença significativa no esforço de evoluir código produzido com ou sem IA (BORG et al., 2025). Liu et al. (2023) mostraram que conjuntos de testes insuficientes podem fazer código incorreto parecer correto. Isso indica que a forma de *medir* a qualidade influencia as conclusões.

## 1.2 Problema de pesquisa

Essa heterogeneidade sugere que o efeito da IA generativa depende do tipo de tarefa, da ferramenta, da experiência de quem a utiliza e, sobretudo, de como agilidade e qualidade são operacionalizadas. Um ganho de velocidade na primeira entrega pode ser anulado por defeitos que só aparecem na validação e exigem retrabalho. Medir apenas o tempo até a primeira solução pode, portanto, confundir rapidez com produtividade (FORSGREN et al., 2021).

Diante disso, este trabalho investiga a seguinte questão:

> **Em tarefas de manutenção e evolução de uma aplicação de pequeno porte em Python e SQL, executadas sob protocolo controlado, como o uso de um assistente de IA generativa altera (a) o tempo até uma entrega aceita, (b) a qualidade funcional da entrega, medida por testes de avaliação ocultos, e (c) o retrabalho necessário após a devolutiva da avaliação, em comparação com a execução sem esse assistente?**

## 1.3 Hipóteses

As hipóteses são bilaterais e não pressupõem a direção do efeito:

- **H1:** o uso do assistente de IA altera o tempo até a entrega aceita;
- **H2:** o uso do assistente de IA altera a qualidade funcional da primeira entrega;
- **H3:** o uso do assistente de IA altera o tempo de retrabalho após a devolutiva;
- **H4 (exploratória):** a relação entre tempo e qualidade varia conforme o tipo de tarefa.

## 1.4 Objetivos

### 1.4.1 Objetivo geral

Avaliar experimentalmente, em tarefas controladas de manutenção e evolução de software, como o uso de um assistente de IA generativa altera o tempo até a entrega aceita, a qualidade funcional e o retrabalho após a devolutiva, em comparação com a execução sem assistência.

### 1.4.2 Objetivos específicos

a) sintetizar a evidência empírica publicada sobre os efeitos de assistentes de IA generativa no tempo, na qualidade e no esforço de validação, identificando divergências e suas possíveis causas;
b) elaborar e pré-registrar um protocolo experimental com randomização das tarefas entre as condições;
c) construir um conjunto de tarefas pareadas com critérios de aceitação objetivos e testes de avaliação ocultos;
d) implementar e testar um instrumento de registro de eventos, versões de código e resultados de testes;
e) executar um estudo piloto e ajustar o protocolo antes da coleta principal;
f) executar a coleta principal e analisar os dados com estatística descritiva e inferência compatível com o desenho;
g) analisar, de forma exploratória, se a relação entre tempo e qualidade difere por tipo de tarefa;
h) documentar as ameaças à validade e os limites de generalização dos resultados.

## 1.5 Justificativa

A justificativa tem três dimensões.

**Prática.** Organizações e profissionais decidem adotar ferramentas de IA com base em percepções de ganho que podem não corresponder ao efeito medido: Becker et al. (2025) observaram justamente essa divergência. Evidências sobre *quando* a IA melhora o processo e *quando* a velocidade vem acompanhada de defeitos e retrabalho ajudam a orientar o uso dessas ferramentas.

**Metodológica.** O trabalho propõe medir o ciclo completo de entrega, avaliação independente e retrabalho, com testes de avaliação separados dos testes visíveis ao executor, em um instrumento aberto e reprodutível. [VERIFICAR: confirmar na revisão da literatura que esse ciclo é pouco medido nos experimentos existentes.]

**Acadêmica.** Para a área de Sistemas de Informação, o trabalho aplica métodos de Engenharia de Software Experimental (WOHLIN et al., 2012) a uma tecnologia de adoção recente, com transparência sobre limitações.

## 1.6 Delimitação

O estudo **não** pretende generalizar para todos os desenvolvedores, linguagens ou ferramentas. As conclusões valem para um executor, um conjunto definido de tarefas de manutenção em Python/SQL, uma ferramenta de IA específica (com modelo e versão registrados) e o período da coleta. O trabalho também não trata de mercado de trabalho, empregabilidade ou substituição de profissionais.

## 1.7 Estrutura do trabalho

O Capítulo 2 apresenta a fundamentação teórica sobre IA generativa aplicada à programação, produtividade, qualidade e experimentação em Engenharia de Software. O Capítulo 3 discute os trabalhos relacionados. O Capítulo 4 descreve a metodologia, o desenho experimental, as tarefas, as métricas e o instrumento. Os Capítulos 5 e 6 apresentam e discutem os resultados. O Capítulo 7 conclui o trabalho e indica pesquisas futuras.
