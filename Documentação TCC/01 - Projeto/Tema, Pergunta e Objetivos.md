---
tipo: projeto
status: adotada-provisoria
decisao: D0
fonte: docs/plano-execucao.md §2–3; thesis/capitulos/01-introducao.md
atualizado: 2026-10-28
tags: [tcc, projeto]
---

# Tema, Pergunta e Objetivos

Fonte: [plano-execucao.md](https://github.com/NathanThomaz/TCC/blob/main/docs/plano-execucao.md) §2–3 · [01-introducao.md](https://github.com/NathanThomaz/TCC/blob/main/thesis/capitulos/01-introducao.md) · Decisão [[Decisões Metodológicas#D0. Tema e pergunta de pesquisa|D0]] (provisória)

## Tema e título

| Item | Texto |
|---|---|
| Tema (`Tema TCC.txt`) | Impacto da inteligência artificial generativa na agilidade e na qualidade do processo de desenvolvimento de software. |
| Título original (`Título do TCC.txt`) | Avaliação experimental do impacto da inteligência artificial generativa na agilidade e na qualidade do processo de desenvolvimento de software |
| **Título provisório (refinado)** | Avaliação experimental do impacto de um assistente de IA generativa no tempo, na qualidade e no retrabalho em tarefas de manutenção de software |
| Complemento se o N-de-1 for aprovado | "…: um estudo de caso único randomizado" |

## Pergunta de pesquisa

**Original:** "Em que medida o uso de IA generativa no desenvolvimento e na manutenção de software altera o tempo de entrega, a qualidade técnica e o esforço de retrabalho das soluções produzidas?"
→ Problema: não delimita tarefa, linguagem, ferramenta nem executor; "qualidade técnica" e "tempo de entrega" sem definição operacional.

**Adotada:**
> Em tarefas de manutenção e evolução de uma aplicação de pequeno porte em Python e SQL, executadas sob protocolo controlado, como o uso de um assistente de IA generativa altera (a) o tempo até uma entrega aceita, (b) a qualidade funcional da entrega, medida por testes ocultos, e (c) o retrabalho após a devolutiva, em comparação com a execução sem esse assistente?

Por que é melhor: cada termo vira variável observável ([[Métricas]]); contexto de validade explícito; "como altera" admite efeito positivo, negativo ou nulo; inclui o ciclo de devolutiva (ponto da possível contribuição).

## Por que o tema é viável (e qual é a contribuição)

- O núcleo já foi estudado, com resultados **contraditórios** (Peng +55,8% de velocidade; Vaithilingam sem ganho; Becker 19% mais lento; Cui +26% tarefas; Borg sem efeito na manutenibilidade; Martin-Lopez tempo inconclusivo). Ver [[Referências Verificadas]].
- **Não** é defensável alegar originalidade em "medir se a IA acelera".
- Contribuição possível: evidência **delimitada e bem instrumentada** do **ciclo completo entrega → avaliação oculta → devolutiva → retrabalho**. Essa lacuna é **[NÃO VALIDADO]** e precisa ser confirmada na revisão (E2). Se não se confirmar, vira "replicação em outro contexto".
- Com um executor, o estudo vale **para aquele executor, aquelas tarefas e aquela ferramenta**.

## Objetivo geral

Avaliar experimentalmente, em tarefas controladas de manutenção e evolução de software, como o uso de um assistente de IA generativa altera o tempo até a entrega aceita, a qualidade funcional e o retrabalho após a devolutiva, em comparação com a execução sem assistência.

## Objetivos específicos

1. Sintetizar a evidência empírica publicada (tempo, qualidade, esforço de validação), identificando divergências e causas.
2. Elaborar e pré-registrar um protocolo experimental com randomização das tarefas entre condições.
3. Construir tarefas pareadas com critérios de aceitação objetivos e testes ocultos.
4. Implementar e testar um instrumento de registro de eventos, versões e resultados de testes.
5. Executar um piloto e ajustar o protocolo.
6. Executar a coleta principal e analisar (descritiva + inferência compatível com o desenho).
7. Analisar, de forma **exploratória**, se a relação tempo × qualidade difere por tipo de tarefa.
8. Documentar ameaças à validade e limites de generalização.

## Justificativa (cap. 1)
- **Prática:** decisões de adoção baseadas em percepção que pode não bater com o efeito medido (Becker et al., 2025).
- **Metodológica:** medir o ciclo completo com testes separados dos visíveis, em instrumento aberto. [VERIFICAR na revisão]
- **Acadêmica:** Engenharia de Software Experimental (Wohlin et al., 2012) aplicada a tecnologia recente.

## Delimitação
Não generaliza para todos os desenvolvedores, linguagens ou ferramentas. Não trata de mercado de trabalho ou substituição de profissionais.

Relacionadas: [[Hipóteses e Variáveis]] · [[Desenho Experimental]] · [[Capítulos do TCC]]
