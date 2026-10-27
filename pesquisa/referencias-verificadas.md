# Referências — registro de verificação

Última atualização: 2026-10-27.

**Como esta lista foi verificada:** metadados (título, autores, veículo, DOI/URL) foram confirmados por buscas web em 2026-10-27, com resultados de ACM DL, IEEE Xplore, arXiv, Springer, INFORMS e Semantic Scholar. **Nenhum texto integral foi lido ainda.** As descrições de método e resultado vêm do **resumo** ou da página do artigo. A leitura integral é tarefa da Etapa 2, e cada ficha deve ser atualizada depois dela.

Legenda de status:
- `V-meta`: metadados e resumo confirmados na fonte primária ou indexador; texto integral não lido.
- `V-parcial`: o artigo existe, mas algum metadado (autores completos, versão final) ainda não foi conferido.
- `NÃO verificado`: apenas fontes secundárias. **Não citar números.**

---

## A. Estudos empíricos sobre IA generativa no desenvolvimento

| # | Referência | Status | Desenho / amostra (segundo o resumo) | Resultado principal (segundo o resumo) | Relação com o TCC |
|---|---|---|---|---|---|
| A1 | PENG, S.; KALLIAMVAKOU, E.; CIHON, P.; DEMIRER, M. *The Impact of AI on Developer Productivity: Evidence from GitHub Copilot*. arXiv:2302.06590, 2023. https://arxiv.org/abs/2302.06590 | V-meta (preprint, **não revisado por pares**) | Experimento controlado entre grupos. Tarefa única: implementar um servidor HTTP em JavaScript | Grupo com Copilot 55,8% mais rápido | Referência clássica para ganho de **velocidade**. Mede uma única tarefa *greenfield* e não mede qualidade em profundidade |
| A2 | VAITHILINGAM, P.; ZHANG, T.; GLASSMAN, E. L. *Expectation vs. Experience: Evaluating the Usability of Code Generation Tools Powered by Large Language Models*. CHI EA '22, art. 332. DOI 10.1145/3491101.3519665 | V-meta | Intraparticipante, n = 24, Copilot | Não reduziu o tempo nem aumentou a taxa de sucesso de forma confiável. Houve dificuldade para entender e depurar as sugestões | Precedente de **desenho intraparticipante** e evidência de custo de validação |
| A3 | BECKER, J.; RUSH, N.; BARNES, E.; REIN, D. *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity*. arXiv:2507.09089, 2025. https://arxiv.org/abs/2507.09089 | V-meta (preprint) | ECR com 16 desenvolvedores experientes e 246 *issues* reais. **Randomização por tarefa** (IA permitida ou proibida) | Tempo de conclusão **19% maior** com IA. Os participantes acreditavam ter ficado ~20% mais rápidos | **O precedente mais próximo do desenho recomendado** (randomização no nível da tarefa, mesmo executor nas duas condições). Também mostra a divergência entre percepção e medição |
| A4 | METR. Estudo de acompanhamento (2025–2026) do A3 | **NÃO verificado** | Apenas blogs secundários | — (não citar) | Localizar a publicação oficial do METR na Etapa 2 |
| A5 | CUI, Z.; DEMIRER, M.; JAFFE, S.; MUSOLFF, L.; PENG, S.; SALZ, T. *The Effects of Generative AI on High-Skilled Work: Evidence from Three Field Experiments with Software Developers*. Management Science, 2026. DOI 10.1287/mnsc.2025.00535 | V-meta | Três ECRs de campo (Microsoft, Accenture e uma terceira empresa), 4.867 desenvolvedores | +26,08% de tarefas concluídas (EP 10,3%). Ganho maior entre os menos experientes | Evidência de campo em larga escala. Mede volume, não qualidade da entrega |
| A6 | BORG, M. et al. *Echoes of AI: Investigating the Downstream Effects of AI Assistants on Software Maintainability*. arXiv:2507.00788 (Registered Report, ICSME 2025). Possível versão em periódico: Empirical Software Engineering, DOI 10.1007/s10664-026-10889-1 | V-parcial (versão EMSE a confirmar) | 2 fases, 151 participantes (95% profissionais), Java. A fase 2 é um ECR sobre a evolução do código produzido na fase 1 | Fase 1: mediana de tempo 30,7% menor com IA (observacional). Fase 2: sem diferença significativa em tempo ou qualidade da manutenção | Trata **manutenibilidade** com pré-registro. É um modelo metodológico para o protocolo |
| A7 | MARTIN-LOPEZ, A.; TUFANO, R.; BAVOTA, G. et al. *More Code, Less Understanding? On the Impact of AI Assistants on Developers' Productivity and Code Ownership*. IEEE TSE, v. 52, n. 7, p. 2173–2187, 2026. DOI 10.1109/TSE.2026.3679627 | V-parcial (lista completa de autores a conferir) | 69 participantes, duas tarefas (uma com IA e outra sem) | Tempo inconclusivo. Completude da tarefa muito maior com IA | Muito próximo do tema (intraparticipante, tempo e completude) |
| A8 | MOZANNAR, H.; BANSAL, G.; FOURNEY, A.; HORVITZ, E. *Reading Between the Lines: Modeling User Behavior and Costs in AI-Assisted Programming*. CHI '24, art. 142. DOI 10.1145/3613904.3641936 | V-meta | 21 programadores. Taxonomia CUPS dos estados de interação | Parte relevante do tempo vai para verificar e editar sugestões | Fundamenta a medição do **esforço de validação** |
| A9 | PERRY, N.; SRIVASTAVA, M.; KUMAR, D.; BONEH, D. *Do Users Write More Insecure Code with AI Assistants?* CCS '23, p. 2785–2799. DOI 10.1145/3576915.3623157 | V-meta | Estudo com usuários, entre grupos (codex-davinci-002) | Código menos seguro com IA, junto com maior confiança na segurança | Risco de qualidade e excesso de confiança |
| A10 | PEARCE, H. et al. *Asleep at the Keyboard? Assessing the Security of GitHub Copilot's Code Contributions*. IEEE S&P 2022, p. 754–768. DOI 10.1109/SP46214.2022.9833571 | V-meta | 89 cenários baseados em CWE. Sem participantes humanos | — (ver texto integral para os percentuais) | Qualidade e segurança do código gerado |
| A11 | MORADI DAKHEL, A. et al. *GitHub Copilot AI pair programmer: Asset or Liability?* Journal of Systems and Software, v. 203, 111734, 2023. DOI 10.1016/j.jss.2023.111734 | V-meta | Copilot × soluções humanas em problemas algorítmicos | "Ativo" para especialistas, "passivo" para iniciantes | Qualidade varia conforme quem revisa a saída |
| A12 | LIU, J.; XIA, C. S.; WANG, Y.; ZHANG, L. *Is Your Code Generated by ChatGPT Really Correct?* NeurIPS 2023. arXiv:2305.01210 | V-meta | Benchmark HumanEval+ (testes ampliados em 80×) | Testes insuficientes deixam passar código incorreto (pass@k cai até 28,9%) | Justifica o uso de **testes ocultos de avaliação**, separados dos testes públicos |

## B. Fundamentos metodológicos e de medição

| # | Referência | Status | Uso no TCC |
|---|---|---|---|
| B1 | WOHLIN, C. et al. *Experimentation in Software Engineering*. Berlin: Springer, 2012. DOI 10.1007/978-3-642-29044-2 | V-meta | Base do desenho experimental, das ameaças à validade e do vocabulário (unidade experimental, fatores, tratamentos) |
| B2 | FORSGREN, N. et al. *The SPACE of Developer Productivity*. ACM Queue, v. 19, n. 1, 2021. DOI 10.1145/3454122.3454124 | V-meta | Argumento de que produtividade é multidimensional, logo não se reduz a velocidade |
| B3 | ISO/IEC 25010:2023 — Product quality model | V-parcial (características exatas da edição 2023 a conferir no texto oficial) | Vocabulário de qualidade funcional e manutenibilidade |

## C. A verificar na Etapa 2 (citadas de memória, **não usar ainda**)

- Ziegler et al., *Productivity assessment of neural code completion* (MAPS 2022) e versão na CACM (2024).
- Nguyen & Nadi, *An empirical evaluation of GitHub Copilot's code suggestions* (MSR 2022).
- Basili, Caldiera & Rombach, *Goal Question Metric Paradigm* (1994).
- Kitchenham & Charters, *Guidelines for performing Systematic Literature Reviews in SE* (2007).
- Jedlitschka, Ciolkowski & Pfahl, diretrizes para relatar experimentos em ES (2008).
- Edgington & Onghena, *Randomization Tests* (análise de desenhos de caso único randomizados).
- Vargha & Delaney (2000), tamanho de efeito A12.
- Falessi et al. (2018, EMSE), uso de estudantes e profissionais em experimentos.
- Widyasari et al. (2020), BugsInPy. Jimenez et al. (ICLR 2024), SWE-bench.
- Hart & Staveland (1988), NASA-TLX (somente se a carga percebida for incluída).
- Literatura cinzenta (citar como tal, se usada): relatórios DORA, GitClear.
- Normas ABNT: NBR 14724, NBR 6023, NBR 10520. **Confirmar as edições vigentes e o manual da instituição.**
