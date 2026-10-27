# 2 FUNDAMENTAÇÃO TEÓRICA

> Rascunho parcial v0.1 (2026-10-27). Cada seção lista as fontes que precisam ser lidas na Etapa 2. Não incluir afirmações sem fonte verificada.

## 2.1 Inteligência artificial generativa e modelos de linguagem

**Conteúdo previsto:** conceito de IA generativa; modelos de linguagem de grande porte (LLMs); arquitetura Transformer; treinamento em código; comportamento não determinístico; limitações conhecidas (alucinação, dados de treino desatualizados, contaminação de benchmarks).

**Fontes a localizar e verificar:**
- artigo original da arquitetura Transformer [VERIFICAR];
- um modelo treinado para código, por exemplo o artigo do Codex [VERIFICAR];
- uma revisão sobre LLMs para Engenharia de Software [VERIFICAR].

## 2.2 Ferramentas de IA para programação

**Conteúdo previsto:** taxonomia por grau de autonomia (autocompletar, chat integrado ao editor, chat externo, agentes de código), conforme [../../docs/ferramentas-ia.md](../../docs/ferramentas-ia.md); como cada modalidade altera o papel do desenvolvedor, que passa de quem escreve a quem revisa e supervisiona.

Mozannar et al. (2024) modelaram os estados de interação de programadores com o Copilot. Segundo o resumo, uma parte relevante do tempo é dedicada a verificar e editar as sugestões [VERIFICAR no texto integral]. Esse achado fundamenta a inclusão do esforço de validação entre os indicadores deste trabalho.

## 2.3 Produtividade no desenvolvimento de software

A produtividade de desenvolvedores não se reduz a uma única métrica. O *framework* SPACE propõe considerar satisfação e bem-estar, desempenho, atividade, comunicação e colaboração, e eficiência e fluxo (FORSGREN et al., 2021) [VERIFICAR as dimensões no texto integral]. Este trabalho mede principalmente desempenho (qualidade da entrega) e eficiência (tempo ativo), e declara as dimensões que deixa de fora.

**A desenvolver:** a diferença entre velocidade (tempo até a primeira solução) e produtividade efetiva (tempo até uma solução aceita); o retrabalho como custo oculto.

## 2.4 Qualidade de software

**Conteúdo previsto:** o modelo de qualidade de produto da ISO/IEC 25010 [VERIFICAR as características da edição 2023]. O foco está em **adequação funcional** (completude, correção) e **manutenibilidade**, os eixos operacionalizados por testes ocultos e por métricas estáticas. Também entram os limites de métricas isoladas, como a complexidade ciclomática [CITAÇÃO NECESSÁRIA: McCabe, 1976 — VERIFICAR].

Liu et al. (2023) mostraram que ampliar os conjuntos de testes revela código incorreto antes considerado correto. Isso fundamenta o uso de testes de avaliação separados dos testes visíveis.

## 2.5 Manutenção de software

**Conteúdo previsto:** tipos de manutenção (corretiva, adaptativa, perfectiva, preventiva) [VERIFICAR: ISO/IEC/IEEE 14764]; por que tarefas de manutenção, e não apenas desenvolvimento do zero, são um contexto relevante para avaliar a IA.

## 2.6 Experimentação em Engenharia de Software

**Conteúdo previsto:**
- conceitos de Wohlin et al. (2012): fatores, tratamentos, unidade experimental, desenhos com blocos, ameaças à validade (de conclusão, interna, de constructo e externa);
- desenhos de caso único (N-de-1) e testes de randomização [VERIFICAR: Edgington e Onghena; Kazdin];
- paradigma GQM [VERIFICAR: Basili, Caldiera e Rombach, 1994];
- diretrizes de relato [VERIFICAR: Jedlitschka, Ciolkowski e Pfahl, 2008].
