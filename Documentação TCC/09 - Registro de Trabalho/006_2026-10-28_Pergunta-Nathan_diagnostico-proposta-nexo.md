---
tipo: pergunta
autor: Nathan
numero: "006"
data: 2026-10-28
assunto: "Diagnóstico da proposta e da apresentação (Forja → Nexo): Fase 1"
resposta: "[[006_2026-10-28_Resposta-Claude_diagnostico-proposta-nexo]]"
tags: [tcc, registro, pergunta]
---

# 006 · Pergunta de Nathan — Diagnóstico da proposta e da apresentação (Forja → Nexo): Fase 1

**Data:** 2026-10-28 · **Resposta:** [[006_2026-10-28_Resposta-Claude_diagnostico-proposta-nexo]]

> # PROMPT PARA CLAUDE CODE — REVISÃO DA PROPOSTA DE TCC E APRESENTAÇÃO NEXO
>
> ## 1. Contexto do projeto
>
> Estou desenvolvendo meu Trabalho de Conclusão de Curso (TCC) em Sistemas de Informação. O projeto, anteriormente chamado Forja, passa a se chamar **Nexo**.
>
> A proposta é desenvolver e avaliar uma plataforma capaz de transformar necessidades e regras de negócio descritas em linguagem natural em especificações estruturadas de sistemas personalizados.
>
> A abordagem técnica combina três elementos:
>
> 1. **IA generativa:** interpreta as necessidades descritas pelo usuário e propõe estruturas e regras de negócio.
> 2. **Modelos estruturados:** representam entidades, atributos, relacionamentos, regras, telas, permissões e critérios de aceitação em um mapa formal do sistema.
> 3. **Validação determinística:** verifica a consistência estrutural e semântica das especificações, impedindo que referências inexistentes, tipos incompatíveis e outras inconsistências passem despercebidas.
>
> O princípio central do projeto é:
>
> **“A IA interpreta, o modelo estrutura e a validação verifica.”**
>
> O objetivo não é simplesmente criar mais um aplicativo de gestão, nem afirmar que a IA consegue desenvolver qualquer sistema automaticamente. A contribuição pretendida é investigar até que ponto essa abordagem híbrida consegue transformar necessidades de pequenos negócios em especificações de software completas, consistentes e rastreáveis.
>
> A proposta deve deixar claro o problema que motiva o desenvolvimento, a lacuna investigada, a contribuição técnica, o método experimental e os limites do protótipo.
>
> ## 2. Arquivos que devem ser analisados
>
> Antes de qualquer alteração, localize e leia integralmente os arquivos disponíveis no repositório:
>
> - A apresentação atual do TCC: `thesis/apresentacao/proposta-v2-forja.pptx`, ou o caminho equivalente existente.
> - O documento da proposta: `docs/proposta-v2-gerador-de-sistemas.md`, ou o arquivo equivalente existente.
> - A documentação da arquitetura, do contrato do mapa e da validação em `docs/forja/`.
> - Os registros de trabalho relevantes em `docs/registro-de-trabalho/`, se disponíveis.
>
> Considere também o estado atual do projeto e os registros anteriores para não descrever como implementadas funcionalidades que ainda estão planejadas.
>
> Não presuma que os caminhos acima continuam corretos. Verifique os caminhos reais e registre eventuais divergências.
>
> ## 3. Primeira fase obrigatória: diagnóstico sem alterações
>
> **Não edite arquivos nesta primeira fase.**
>
> Leia a apresentação e a proposta por inteiro. Avalie o argumento acadêmico, a sequência dos slides, a coerência entre problema, objetivos, pergunta de pesquisa, método, implementação e avaliação.
>
> Apresente um diagnóstico contendo:
>
> ### 3.1 Identidade e posicionamento
>
> - Substituições necessárias de Forja para Nexo.
> - Sugestões de título, subtítulo e slogan.
> - Como explicar a proposta em uma frase para a banca.
> - Como diferenciar o nome comercial do título acadêmico do TCC.
>
> ### 3.2 Problema e justificativa
>
> Verifique se a apresentação demonstra adequadamente por que o sistema é necessário.
>
> Analise a discussão sobre as alternativas disponíveis para pequenos negócios:
>
> - Sistemas prontos que podem não contemplar regras específicas.
> - Desenvolvimento personalizado que pode exigir custo, tempo e conhecimento técnico.
> - Planilhas e controles manuais que podem dificultar a consistência e a integração das informações.
>
> Esses pontos devem ser tratados como problemas a investigar e fundamentar, não como verdades universais já comprovadas.
>
> Proponha como fortalecer a justificativa por meio de fontes confiáveis, dados verificáveis e, se viável, levantamento exploratório de necessidades reais.
>
> Identifique afirmações que atualmente não possuem evidência suficiente. Não invente estatísticas, referências, entrevistas, resultados ou dados de mercado.
>
> ### 3.3 Lacuna e contribuição científica
>
> Verifique se está explícito o que o trabalho pretende descobrir que ainda não foi demonstrado no próprio projeto.
>
> A contribuição central deve ser a avaliação de uma abordagem híbrida que combina IA generativa, representação estruturada e validação determinística.
>
> Diferencie claramente:
>
> - Construir uma ferramenta.
> - Demonstrar que ela funciona em cenários definidos.
> - Avaliar cientificamente a qualidade dos resultados produzidos.
>
> Não apresente a simples implementação do sistema como se fosse, por si só, a contribuição científica completa.
>
> ### 3.4 Pergunta de pesquisa
>
> Avalie a seguinte formulação inicial:
>
> “Em que medida uma abordagem híbrida, que combina IA generativa, modelos estruturados e validação determinística, consegue transformar requisitos de negócio descritos em linguagem natural em especificações de software completas, consistentes e rastreáveis para pequenos negócios?”
>
> Proponha ajustes caso necessário, preservando o foco técnico e experimental.
>
> A pergunta precisa ser respondida por métricas observáveis, e não apenas por opiniões sobre a ferramenta.
>
> ### 3.5 Objetivos
>
> Verifique se o objetivo geral e os objetivos específicos estão alinhados à pergunta de pesquisa.
>
> Considere como objetivos possíveis:
>
> - Definir uma representação estruturada dos requisitos de negócio.
> - Implementar mecanismos de validação estrutural e semântica.
> - Integrar a interpretação por IA ao processo de construção do mapa do sistema.
> - Avaliar completude, consistência, rastreabilidade, tempo e necessidade de correções.
> - Identificar limitações e classes de requisitos não suportadas.
>
> Não amplie o escopo sem justificativa.
>
> ### 3.6 Método experimental
>
> Analise se o método permite separar o efeito da IA do efeito do modelo estruturado e das validações.
>
> Considere alternativas de comparação, explicitando seus limites:
>
> - Geração direta por IA a partir da descrição do negócio.
> - Abordagem híbrida com IA, mapa estruturado e validação determinística.
> - Opcionalmente, um modo guiado sem IA como referência adicional.
>
> Não trate essas alternativas como equivalentes. Explique o que cada comparação permite concluir.
>
> Proponha métricas operacionais, por exemplo:
>
> - Completude dos requisitos representados.
> - Consistência estrutural e semântica.
> - Rastreabilidade entre requisito original e artefato gerado.
> - Proporção de critérios de aceitação atendidos.
> - Tempo de execução.
> - Número e gravidade das correções manuais.
> - Taxa de erros detectados e erros que escapam à validação.
>
> Sugira cenários controlados, critérios de avaliação previamente definidos e repetições suficientes para comparar os métodos.
>
> Não invente resultados nem apresente hipóteses como conclusões.
>
> ### 3.7 Escopo e viabilidade
>
> Verifique se a apresentação promete mais do que é viável implementar e avaliar no prazo do TCC.
>
> Diferencie expressamente:
>
> - Funcionalidades já implementadas.
> - Funcionalidades em desenvolvimento.
> - Funcionalidades planejadas.
> - Trabalhos futuros.
>
> O validador semântico e o contrato estruturado não devem ser confundidos com um motor de geração de sistemas já funcional.
>
> Se a geração de uma aplicação completa for um risco de prazo, proponha um MVP experimental menor e mensurável, sem perder a contribuição científica.
>
> ### 3.8 Pontos que a banca poderá questionar
>
> Identifique perguntas difíceis e possíveis fragilidades, como:
>
> - Qual é a necessidade real que justifica o sistema?
> - Como essa necessidade será demonstrada?
> - Por que utilizar IA generativa em vez de formulários tradicionais?
> - Qual é a contribuição da validação determinística?
> - Como será definido que uma especificação está correta?
> - Como evitar que os critérios de avaliação favoreçam a abordagem proposta?
> - Como garantir que os cenários de teste sejam representativos?
> - Quais limitações impedem generalizar os resultados para todos os pequenos negócios?
> - Qual é a viabilidade da execução local e offline?
> - Como distinguir erros de interpretação da IA de erros do modelo ou do validador?
>
> ## 4. Revisão da apresentação PowerPoint
>
> Depois do diagnóstico, proponha uma nova organização dos slides.
>
> A apresentação deve construir uma narrativa lógica:
>
> 1. Nome e proposta Nexo.
> 2. Problema enfrentado pelos pequenos negócios.
> 3. Evidências e justificativa da necessidade.
> 4. Lacuna investigada.
> 5. Proposta de solução e contribuição técnica.
> 6. Pergunta de pesquisa.
> 7. Objetivo geral e objetivos específicos.
> 8. Arquitetura híbrida: IA, mapa estruturado e validação determinística.
> 9. Exemplo concreto da transformação de uma necessidade em regras estruturadas.
> 10. Método experimental e grupos de comparação.
> 11. Métricas e critérios objetivos de avaliação.
> 12. Escopo do MVP e limitações.
> 13. Riscos, viabilidade e questões para debate.
> 14. Contribuições esperadas e conclusão.
>
> Essa lista é uma referência, não uma exigência de exatamente 14 slides. Reorganize, agrupe ou divida slides conforme necessário, preservando uma apresentação clara e adequada à defesa de uma proposta de TCC.
>
> ### Slides específicos que precisam ser avaliados
>
> **A. Justificativa da necessidade**
>
> Criar ou revisar slides que respondam:
>
> - Que dificuldade concreta o projeto pretende resolver?
> - Para quem ela é relevante?
> - Quais evidências sustentam a existência do problema?
> - Por que as alternativas existentes podem ser insuficientes em determinados cenários?
> - Qual parte dessa necessidade será efetivamente investigada no TCC?
>
> **B. Diferencial técnico**
>
> Explicar visualmente o fluxo:
>
> Necessidade em linguagem natural → interpretação por IA → mapa estruturado → validação determinística → especificações verificáveis.
>
> Deixar claro que a IA pode propor informações incorretas, que o usuário revisa as propostas e que a validação verifica propriedades definidas no contrato. Não sugerir que o validador garante a correção de toda regra de negócio.
>
> **C. Pontos de debate para a banca**
>
> Adicionar um slide próprio com questões centrais:
>
> - É viável converter linguagem natural em especificações de software consistentes?
> - A abordagem híbrida melhora a qualidade em relação à geração direta por IA?
> - Quais tipos de erro a validação determinística consegue detectar?
> - Como medir completude, consistência e rastreabilidade de maneira reproduzível?
> - A abordagem pode reduzir o esforço necessário para produzir sistemas personalizados?
> - Quais limitações técnicas e de escopo permanecem?
>
> Se necessário, adicionar um segundo slide com riscos, limitações e questões metodológicas.
>
> **D. Avaliação científica**
>
> Deixar explícitos os cenários, as abordagens comparadas, as métricas e a forma de análise. Não prometer superioridade da solução antes de executar os experimentos.
>
> ### Critérios visuais
>
> - Manter uma identidade visual consistente e profissional.
> - Substituir o nome Forja por Nexo nos locais pertinentes.
> - Preservar os elementos visuais úteis, revisando-os quando a narrativa exigir.
> - Evitar slides excessivamente carregados.
> - Priorizar diagramas claros e exemplos concretos.
> - Diferenciar visualmente problema, hipótese, método, evidência e resultado esperado.
> - Garantir que títulos, rodapés, notas do apresentador e referências sejam coerentes com a nova identidade.
> - Não usar imagens meramente decorativas quando um diagrama explicativo for mais útil.
>
> ## 5. Revisão do documento da proposta
>
> A proposta escrita deve estar alinhada ao PowerPoint e conter, de forma coerente:
>
> - Contextualização e problema.
> - Justificativa fundamentada.
> - Lacuna de pesquisa.
> - Pergunta de pesquisa.
> - Objetivo geral e objetivos específicos.
> - Fundamentação teórica a desenvolver.
> - Arquitetura e abordagem proposta.
> - Método de pesquisa e desenho experimental.
> - Cenários, métricas e critérios de avaliação.
> - Escopo, limitações e riscos.
> - Cronograma viável.
> - Referências bibliográficas verificáveis.
>
> Não crie referências bibliográficas fictícias. Se for necessário pesquisar fontes externas, apresente os dados bibliográficos e links verificáveis, distinguindo o conteúdo encontrado das interpretações feitas.
>
> ## 6. Regras de integridade acadêmica
>
> Durante toda a revisão:
>
> 1. Não invente dados, resultados experimentais, entrevistas, fontes ou funcionalidades implementadas.
> 2. Não apresente metas como resultados alcançados.
> 3. Não confunda validação estrutural e semântica com garantia completa de correção.
> 4. Não afirme que a solução serve a qualquer negócio sem evidência.
> 5. Diferencie fatos observados, hipóteses, decisões de projeto e trabalhos futuros.
> 6. Não aumente o escopo apenas para tornar a proposta mais impressionante.
> 7. Preserve o caráter investigativo: resultados positivos, negativos ou inconclusivos devem ser possíveis.
> 8. Mantenha a rastreabilidade entre problema, objetivos, método e critérios de avaliação.
>
> ## 7. Fluxo obrigatório de trabalho
>
> Execute o trabalho em duas fases.
>
> ### Fase 1 — Diagnóstico e proposta de alterações
>
> Sem modificar arquivos:
>
> 1. Leia integralmente a apresentação, a proposta e a documentação relevante.
> 2. Produza um diagnóstico das inconsistências e lacunas.
> 3. Apresente a estrutura atual e a estrutura recomendada dos slides.
> 4. Mostre a nova formulação proposta para o problema, a justificativa, a pergunta de pesquisa e os objetivos.
> 5. Liste as evidências e referências que precisam ser levantadas.
> 6. Identifique as afirmações que devem ser corrigidas por não terem sustentação suficiente.
> 7. Indique os arquivos que seriam alterados.
> 8. Destaque decisões que dependam da minha aprovação.
>
> Ao concluir, **pare e aguarde minha aprovação explícita antes de editar qualquer arquivo**.
>
> ### Fase 2 — Execução, após aprovação
>
> Somente após a minha aprovação:
>
> 1. Atualize o PowerPoint.
> 2. Atualize o documento da proposta.
> 3. Atualize notas do apresentador, referências e documentação complementar quando necessário.
> 4. Gere os arquivos finais em formatos adequados.
> 5. Valide a apresentação, confira a renderização dos slides e revise a sequência completa.
> 6. Compare a proposta e o PowerPoint para identificar divergências.
> 7. Registre o trabalho em um novo documento Markdown, seguindo o padrão existente em `docs/registro-de-trabalho/`.
> 8. Apresente os arquivos alterados, as verificações executadas e as pendências.
>
> Não faça commits nem push sem autorização explícita.
>
> ## 8. Resultado esperado da primeira resposta
>
> Sua primeira resposta deve conter exclusivamente o diagnóstico e a proposta de revisão, sem modificar arquivos.
>
> Organize-a em:
>
> 1. Diagnóstico geral.
> 2. Principais problemas da narrativa acadêmica.
> 3. Formulações propostas para problema, justificativa, pergunta e objetivos.
> 4. Estrutura recomendada para a apresentação.
> 5. Pontos de debate para a banca.
> 6. Evidências e referências que precisam ser levantadas.
> 7. Arquivos que seriam alterados.
> 8. Decisões para minha aprovação.
>
> Se alguma informação não estiver nos arquivos, declare essa ausência. Não presuma nem invente o conteúdo.
>
> **Comece agora pela Fase 1. Não edite nenhum arquivo até eu aprovar o diagnóstico.**
