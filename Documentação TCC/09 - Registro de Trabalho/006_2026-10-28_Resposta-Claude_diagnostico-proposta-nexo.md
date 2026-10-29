---
tipo: resposta
autor: Claude
numero: "006"
data: 2026-10-28
assunto: "Diagnóstico da proposta e da apresentação (Forja → Nexo): Fase 1"
pergunta: "[[006_2026-10-28_Pergunta-Nathan_diagnostico-proposta-nexo]]"
tags: [tcc, registro, resposta]
---

# 006 · Resposta do Claude — Diagnóstico da proposta e da apresentação (Forja → Nexo): Fase 1

**Pergunta:** [[006_2026-10-28_Pergunta-Nathan_diagnostico-proposta-nexo]]
**Tipo:** diagnóstico, sem alterar a proposta, a apresentação nem o código.
**Status:** **aguardando aprovação** das decisões B1 a B12 (seção 8 da resposta).
**Nenhum arquivo foi alterado.** Por isso também não criei a entrada do registro de trabalho nem atualizei o vault: farei isso na Fase 2, depois da sua aprovação.
**O que li:**
**Divergências de caminho e de estado encontradas:**
**Estado real do projeto:**
**Principal risco:** a apresentação descreve, no **presente**, um sistema completo (7 etapas, motor, layout, entrega, roda no PC da loja) que **não existe**.
**Problema** (como **hipótese a investigar**):
**Justificativa:**
**Lacuna** (a confirmar na revisão; hoje é hipótese):
**Pergunta de pesquisa.** Ajustes em relação à formulação do autor:
**Objetivo geral:** desenvolver e avaliar uma abordagem híbrida (IA generativa + mapa estruturado + validação determinística) para transformar requisitos de pequenos negócios, descritos em linguagem natural, em especificações de software completas, consistentes e rastreáveis.
**Método: o que cada comparação permite concluir**
**Limites de cada comparação:**
**Métricas operacionais:**
**Proteções contra viés:**
**A apresentação atual** (22 slides), e o destino de cada um:
**Estrutura recomendada (19 slides, cerca de 20 a 25 minutos):**
**Identidade visual:**
**No slide:**
**Fragilidades a preparar** (fora do slide):
**Observação sobre o nome:** "Nexo" já é usado por outras marcas (por exemplo, um veículo de jornalismo brasileiro). Para um TCC não é impedimento, mas evite apresentar como produto comercial.

## Resposta enviada (texto integral)

Escrito para: você e o seu orientador, como diagnóstico para decidir a revisão da proposta Nexo.

# Fase 1: diagnóstico da proposta e da apresentação (Nexo)

**Nenhum arquivo foi alterado.** Por isso também não criei a entrada do registro de trabalho nem atualizei o vault: farei isso na Fase 2, depois da sua aprovação.

**O que li:**
- a apresentação `thesis/apresentacao/proposta-v2-forja.pptx` inteira: 22 slides, com as notas do apresentador;
- a proposta `docs/proposta-v2-gerador-de-sistemas.md` (revisão 3);
- `docs/forja/`: README, `validacao.md`, `plano-marco-1.md` e o exemplo da padaria;
- os registros 001 a 005;
- `pesquisa/referencias-verificadas.md`.

**Divergências de caminho e de estado encontradas:**
- Os caminhos indicados no seu pedido existem.
- `thesis/apresentacao/proposta-v2-forja-rev3.pptx` é uma versão obsoleta que continua na pasta.
- `thesis/apresentacao/roteiro-defesa.md` ainda descreve o projeto antigo (experimento N-de-1).
- **A Etapa 2 (validador semântico) está implementada, mas sem commit.** Ela existe só na sua máquina, na branch `forja-marco-1`.
- O nome "Forja" aparece em 22 pontos da proposta, em 12 da nota do vault, nos documentos de `docs/forja/`, no código (`src/forja`, `python -m forja`), nos testes e no `pyproject.toml`.

---

### 1. Diagnóstico geral
A proposta atual (revisão 3) foi escrita como **"um sistema que cria sistemas para pequenos negócios"**, com a comparação "IA × modo guiado sem IA" como experimento central. O novo enquadramento é outro:
- **o foco passa a ser a especificação verificável**: transformar a necessidade em especificação;
- **a comparação principal passa a ser abordagem híbrida × geração direta por IA**.

É uma mudança de foco, não só de nome. Ela deixa o TCC mais defensável e mais viável: o que já está implementado (contrato + validação) vira o núcleo da contribuição, e não um passo intermediário rumo a um motor inexistente.

**Estado real do projeto:**

| Situação | O que é |
|---|---|
| **Implementado e testado** | Contrato do mapa v0.2 (JSON Schema) e exemplo da padaria (com commit). Validador estrutural e semântico com 48 códigos e o comando `validar` (**sem commit**). 111 testes da Forja e 156 na suíte completa, todos passando |
| **Em desenvolvimento** | Documentação do Marco 1 (`ciclo-de-vida.md`, README de `docs/forja`) |
| **Planejado, sem nenhum código** | IA local (Ollama), interpretação da linguagem natural, modo guiado, motor de geração, telas, documentação gerada, empacotamento, prova offline |
| **Sem dados** | Necessidade dos pequenos negócios (nenhuma fonte levantada), viabilidade de hardware (meta de 16 GB não medida), qualquer resultado experimental |

**Principal risco:** a apresentação descreve, no **presente**, um sistema completo (7 etapas, motor, layout, entrega, roda no PC da loja) que **não existe**.

### 2. Principais problemas da narrativa acadêmica

| # | Problema | Onde aparece |
|---|---|---|
| 1 | **Promessas como fatos.** "Sistema rodando no balcão", "Sem programar · Sem mensalidade · Sem depender de internet · Dados ficam na loja", "A IA entende, o motor **garante**", "Confiável: o mesmo mapa gera sempre o mesmo sistema", "Qualquer PC comum com Windows", "R$ 0", "Você personaliza tudo". Nada disso foi verificado, e o motor não existe | Slides 1, 4, 6, 8–10, 12, 14; proposta §3–4 |
| 2 | **Problema afirmado como verdade universal.** "As opções de hoje não cabem no bolso nem nas regras do pequeno negócio" e as afirmações dos 3 cartões não têm fonte. O slide avisa que os dados "serão levantados", mas o texto afirma antes | Slide 2; proposta §1 |
| 3 | **Fala fictícia que pode ser lida como entrevista.** A citação da "Ana" está marcada como "persona ilustrativa", mas aparece entre aspas, como depoimento | Slide 3 |
| 4 | **Lacuna não formulada.** Não há slide nem seção sobre "o que ainda não se sabe". A proposta não tem seção de lacuna, nem de fundamentação teórica, nem de referências | Toda a apresentação; proposta |
| 5 | **Construir × demonstrar × avaliar não aparecem separados.** A contribuição soa como "construir a Forja" | Slides 4, 6–15 |
| 6 | **Pergunta e hipóteses desalinhadas com o novo foco.** A pergunta mede usuários criando sistemas funcionais (IA × guiado). Não fala de completude, consistência e rastreabilidade, nem compara com geração direta | Slides 5, 17–19; proposta §2, §5 |
| 7 | **Rastreabilidade não existe no contrato.** O mapa v0.2 só guarda a `frase_original` nas regras. Sem requisitos numerados nem vínculos, a métrica não pode ser medida | Contrato v0.2 |
| 8 | **Risco de avaliação circular.** Medir a "consistência" com o mesmo validador que faz parte da abordagem híbrida favorece a abordagem por construção | Ainda não tratado |
| 9 | **Validação vendida além do que faz.** O validador confere propriedades do contrato (referências, tipos, ciclos, coerência do ciclo de vida). **Ele não sabe se a regra de negócio está certa** | Slides 10–11 |
| 10 | **Notas desatualizadas.** A nota do slide 11 diz que "a validação semântica ainda não existe", e ela já existe. O slide 19 testa IA × guiado, que deixa de ser o eixo principal | Slides 11, 19 |
| 11 | **Escopo ainda grande para o prazo.** Motor + layout + empacotamento + duas frentes de avaliação + CEP | Slides 6, 17, 21 |

### 3. Formulações propostas

**Problema** (como **hipótese a investigar**):
> Pequenos negócios precisam controlar operações como estoque, vendas, clientes e contas, com regras próprias. As alternativas comuns parecem ter limitações: sistemas prontos podem não contemplar regras específicas; o desenvolvimento sob medida pode exigir custo, tempo e conhecimento técnico; planilhas e controles manuais podem dificultar a consistência e a integração dos dados. **A extensão desse problema será caracterizada com fontes verificáveis e com um levantamento exploratório.** Parte do esforço de construir um sistema sob medida está em transformar a descrição do negócio numa especificação correta e completa, e é essa etapa que o trabalho investiga.

**Justificativa:**
1. **Prática:** se a especificação puder ser obtida a partir da linguagem do próprio dono, com garantias verificáveis, isso reduz uma barreira para sistemas sob medida. É uma hipótese.
2. **Técnica:** a IA generativa produz saídas plausíveis, mas sem garantia de consistência; formulários garantem a forma, mas exigem saber modelar. A combinação ainda precisa ser avaliada **neste contexto** (a confirmar na revisão).
3. **Metodológica:** o trabalho entrega um contrato formal, um validador aberto e um protocolo de avaliação reproduzível.

**Lacuna** (a confirmar na revisão; hoje é hipótese):
> Ainda não se sabe, **no contexto de especificações para pequenos negócios e com um modelo executado localmente**, se interpretar com IA + estruturar num contrato formal + validar de forma determinística produz especificações mais completas, consistentes e rastreáveis do que pedi-las diretamente à IA, nem quais classes de erro a validação deixa passar.

**Pergunta de pesquisa.** Ajustes em relação à formulação do autor:
- explicitar a **comparação**;
- **delimitar o contexto**;
- incluir a **análise de erros**.

> **Em cenários de controle operacional de pequenos negócios, em que medida uma abordagem híbrida — IA generativa para interpretar requisitos em linguagem natural, um mapa estruturado como representação formal e validação determinística — produz especificações de software mais completas, consistentes e rastreáveis do que a geração direta por IA, e quais classes de erro a validação detecta ou deixa escapar?**

Subperguntas:
- **SQ1:** completude, consistência, rastreabilidade e critérios de aceitação: híbrida × direta.
- **SQ2:** erros detectados × erros que escapam ao validador, por classe.
- **SQ3:** esforço (tempo, número e gravidade das correções) com revisão humana.
- **SQ4** (exploratória): comparação com o modo guiado sem IA.

**Objetivo geral:** desenvolver e avaliar uma abordagem híbrida (IA generativa + mapa estruturado + validação determinística) para transformar requisitos de pequenos negócios, descritos em linguagem natural, em especificações de software completas, consistentes e rastreáveis.

| # | Objetivo específico | Situação hoje |
|---|---|---|
| 1 | Caracterizar a necessidade e as alternativas com fontes verificáveis e levantamento exploratório | Não iniciado |
| 2 | Definir a representação estruturada (contrato do mapa) **com rastreabilidade de requisitos** | Parcial: v0.2 implementada, sem rastreabilidade |
| 3 | Implementar a validação estrutural e semântica | **Implementado** (Etapa 2, sem commit) |
| 4 | Integrar a interpretação por IA local à construção do mapa, com ciclo de correção guiado pelo validador | Planejado |
| 5 | Avaliar experimentalmente completude, consistência, rastreabilidade, critérios de aceitação, tempo e correções, comparando com a geração direta | Planejado |
| 6 | Identificar limitações e classes de requisitos não suportadas | Planejado (a matriz de suporte já existe) |

**Método: o que cada comparação permite concluir**

| Condição | Como funciona | Comparações que a usam | O que se conclui |
|---|---|---|---|
| **A0 Direta** | A mesma IA recebe a descrição e o formato do mapa e devolve a especificação **numa única etapa**, sem validação | A1 × A0 | O efeito de **acrescentar contrato e validação** ao uso da IA (efeito principal, totalmente automatizável) |
| **A1 Híbrida automática** | IA propõe → validador acusa erros → IA corrige (até N rodadas) | A1 × A0; A2 × A1 | A1 × A0: acima. A2 × A1: o efeito da revisão humana |
| **A2 Híbrida com revisão** | A1 + um operador revisa e aprova | A2 × A1; A2 × A3 | A2 × A1: o que a pessoa ainda precisa corrigir. A2 × A3: o efeito da IA com a mesma ferramenta e validação |
| **A3 Guiada sem IA** (opcional) | O operador preenche o mapa nos formulários, com a mesma validação | A2 × A3 | Acima. Só é útil se houver operador |

**Limites de cada comparação:**
- A0 × A1 **não diz nada sobre usuários reais**, só sobre a qualidade das especificações.
- A2 e A3 dependem de operador: o autor conhece os cenários, então isso é uma ameaça a declarar, ou exige um terceiro.

**Métricas operacionais:**

| Métrica | Definição | Quem mede |
|---|---|---|
| Completude | % dos requisitos numerados do gabarito (R1…Rn) representados corretamente (rubrica: correto / parcial / ausente), mais os elementos **espúrios** | Avaliador independente, **cego à condição** |
| Consistência | Nº de violações estruturais e semânticas no mapa final | Validador, aplicado **depois** a todas as condições, + auditoria manual numa amostra |
| Rastreabilidade | % de elementos ligados a um requisito válido, e % de requisitos com ao menos um elemento | Automática (depende do contrato v0.3, decisão B4) |
| Critérios de aceitação | % dos critérios ocultos do cenário atendidos pelo mapa | Avaliador, com checklist; executável só se houver motor |
| Tempo | Tempo de execução (A0, A1); tempo do operador (A2, A3) | Registro automático |
| Correções | Nº e gravidade (crítica / maior / menor) das edições até o mapa ficar igual ao gabarito | Avaliador |
| Erros detectados × escapados | Erros achados pelo avaliador que o validador não acusou, por classe; alarmes falsos do validador | Avaliador + validador |
| Mapas válidos | % de saídas que passam no contrato | Validador |

**Proteções contra viés:**
- cenários e gabarito escritos **por terceiro**, com requisitos numerados e critérios definidos **antes**, selados;
- cenários de desenvolvimento separados dos de avaliação;
- mesmo modelo e mesmo texto de instrução em A0 e A1 (só muda a validação em ciclo);
- avaliador cego, com as saídas normalizadas para o mesmo formato;
- **5 repetições** por cenário nas condições automáticas;
- análise pareada por cenário (estimativas com IC + Wilcoxon com correção de Holm);
- **nenhuma superioridade é prometida**: resultados positivos, negativos ou inconclusivos são todos válidos.

### 4. Estrutura recomendada para a apresentação

**A apresentação atual** (22 slides), e o destino de cada um:

| Slides atuais | Destino |
|---|---|
| 1 Capa | Reescrever (Nexo) |
| 2 Problema | Reescrever como **hipótese** + slide de evidências |
| 3 Persona Ana | Manter como **exemplo ilustrativo**, com a fala marcada como fictícia; juntar ao exemplo concreto |
| 4 Proposta | Reescrever (fluxo + "o que é e o que não é") |
| 5 Pergunta | Reescrever |
| 6–10 Etapas, regras, ER, layout, arquitetura | Condensar em **arquitetura híbrida** + **exemplo concreto**; motor, layout e entrega viram "planejado / futuro" |
| 11 Contrato | Manter, atualizado, com um **erro real** detectado pelo validador |
| 12–15 Roda local, prova offline, personalização, matriz | Condensar em **escopo do MVP** + **viabilidade** |
| 16–19 DSR, avaliação, isolamento, hipóteses | Substituir por **método**, **cenários e gabarito** e **métricas** |
| 20–22 Escopo, cronograma, riscos | Revisar |

**Estrutura recomendada (19 slides, cerca de 20 a 25 minutos):**

| # | Slide | Conteúdo-chave |
|---|---|---|
| 1 | Capa | Nexo + título acadêmico + autor, curso, orientador |
| 2 | Nexo em uma frase | "A IA interpreta, o modelo estrutura e a validação verifica." |
| 3 | O problema (hipótese) | 3 alternativas e o que precisa ser verificado em cada uma; selo **HIPÓTESE** |
| 4 | Evidências: o que temos e o que falta | Fontes a consultar, levantamento exploratório, estado: **a levantar** |
| 5 | Lacuna investigada | O que ainda não se sabe, a confirmar na revisão |
| 6 | Construir × demonstrar × avaliar | A contribuição em três níveis, com a avaliação como contribuição científica |
| 7 | Pergunta de pesquisa | Pergunta + SQ1 a SQ4 |
| 8 | Objetivos | Geral + 6 específicos, com o status de cada um |
| 9 | Arquitetura híbrida | Necessidade → IA → mapa → validação → especificação verificável. **A IA pode errar; o usuário revisa; o validador confere propriedades, não a correção do negócio** |
| 10 | Exemplo concreto | Frase da Ana (ilustrativa) → regra estruturada → **erro real detectado** (saída verdadeira do `validar`) |
| 11 | O que já existe | Implementado / em desenvolvimento / planejado / futuro, com evidência (testes) |
| 12 | Método e condições | A0, A1, A2, (A3) e o que cada comparação conclui |
| 13 | Cenários e gabarito | Terceiro, requisitos numerados, selagem, avaliador cego, repetições |
| 14 | Métricas | Tabela de métricas com definição operacional |
| 15 | Escopo do MVP e limitações | O que entra, o que é trabalho futuro, matriz de suporte resumida |
| 16 | Riscos e viabilidade | IA local em PC comum, prazo, CEP, avaliação circular |
| 17 | Pontos de debate para a banca | Seção 5 |
| 18 | Cronograma | Fases revisadas (sem motor completo no caminho crítico) |
| 19 | Contribuições esperadas | Contrato, validador, protocolo e evidência, **como expectativa, não como resultado** |

**Identidade visual:**
- mantenho a paleta grafite/laranja e o motivo de ícones em círculos;
- o martelo (que remetia à "Forja") é trocado por um ícone de conexão/nós, coerente com "Nexo";
- uma **etiqueta de status** em cor própria nos slides: HIPÓTESE, IMPLEMENTADO, PLANEJADO, FUTURO, para separar visualmente problema, hipótese, método, evidência e resultado esperado.

### 5. Pontos de debate para a banca

**No slide:**
1. É viável converter linguagem natural em especificações consistentes?
2. A abordagem híbrida melhora a qualidade em relação à geração direta?
3. Que tipos de erro a validação detecta, e quais escapam?
4. Como medir completude, consistência e rastreabilidade de forma reproduzível?
5. A abordagem reduz o esforço para produzir sistemas sob medida?
6. Que limitações permanecem?

**Fragilidades a preparar** (fora do slide):

| Pergunta | Resposta preparada |
|---|---|
| Por que IA, e não só formulários? | A3 mede isso |
| Como se define uma especificação "correta"? | Gabarito de terceiro, com requisitos numerados e rubrica prévia |
| Os critérios não favorecem a sua abordagem? | Avaliador cego; consistência auditada também à mão; o validador é aplicado a todas as condições |
| Os cenários são representativos? | Ramos variados + validação por empreendedores; declarar como limitação |
| Dá para generalizar para todos os pequenos negócios? | Não: escopo fechado e matriz de suporte |
| Funciona local e offline? | Ainda não medido; risco declarado, medido no piloto |
| Como separar erro da IA de erro do modelo ou do validador? | A0 × A1 + classificação dos erros por origem |
| O validador garante que a regra está certa? | Não; garante propriedades do contrato |

### 6. Evidências e referências a levantar (nada inventado; tudo **a verificar**)

| Necessidade | Onde buscar | Situação no repositório |
|---|---|---|
| Uso de sistemas de gestão e digitalização em pequenos negócios | Pesquisa TIC Empresas (Cetic.br), estudos do SEBRAE, estatísticas de empresas do IBGE | Nenhuma fonte levantada |
| Custo e limites das alternativas | Páginas oficiais de preços de sistemas de gestão para MEI/ME, **com data da consulta** | Nada |
| IA generativa em engenharia de requisitos / especificação a partir de linguagem natural | Busca estruturada (ACM, IEEE, arXiv), com a string a definir | Nada. As 15 referências verificadas tratam de **IA × produtividade de programadores** e servem só como motivação |
| Desenvolvimento orientado a modelos, low-code, validação de especificações | Idem | Nada |
| Saída estruturada de modelos de linguagem e correção guiada por validador | Idem | Nada |
| Método DSR | Hevner et al. (2004); Peffers et al. (2007) | Citados como [VERIFICAR], não verificados |
| SUS (se houver estudo com usuários) | Brooke (1996) | [VERIFICAR] |
| Experimentação | Wohlin et al. (2012) | **Já verificado** (B1) |
| Necessidade real (primária) | Conversas exploratórias com 2 a 5 empreendedores. Se forem registradas e usadas no TCC, **consultar o CEP antes** | Nenhuma realizada |

**Observação sobre o nome:** "Nexo" já é usado por outras marcas (por exemplo, um veículo de jornalismo brasileiro). Para um TCC não é impedimento, mas evite apresentar como produto comercial.

### 7. Arquivos que seriam alterados na Fase 2

| Arquivo | Alteração |
|---|---|
| `thesis/apresentacao/proposta-v2-forja.pptx` | Nova apresentação Nexo (nome do arquivo conforme a decisão B6) |
| `docs/proposta-v2-gerador-de-sistemas.md` | Proposta reescrita: contexto, justificativa, lacuna, pergunta, objetivos, fundamentação a desenvolver, arquitetura, método, cenários e métricas, escopo, riscos, cronograma, referências com status |
| `thesis/apresentacao/roteiro-defesa.md` | Atualizado para a nova apresentação (hoje descreve o projeto antigo) |
| `docs/forja/README.md`, `validacao.md` | Nome Nexo e status. O `plano-marco-1.md` fica como histórico, com uma nota |
| `pesquisa/referencias-verificadas.md` | Novas fontes, se B11 for aprovada, com status de verificação |
| Vault | Proposta, Painel, Estado Atual |
| `docs/registro-de-trabalho/006-…md` + índice | Registro desta revisão |
| Memória | Nome Nexo e o novo foco |
| **Não altero** (salvo aprovação) | O código `src/forja`, os testes e o contrato (B4, B5) |

### 8. Decisões para aprovação

| # | Decisão | Recomendação |
|---|---|---|
| B1 | Comparação principal | **A1 Híbrida × A0 Direta** (automatizável, reproduzível, sem CEP, com repetições). A2 e A3 como secundárias/exploratórias |
| B2 | MVP | **Especificação + validação** como núcleo avaliado. Motor de geração completo vira trabalho futuro; no máximo, 1 protótipo executável demonstrativo, sem avaliação |
| B3 | Estudo com usuários | Trabalho futuro. Ou exploratório mínimo, só se o CEP permitir no prazo |
| B4 | Rastreabilidade no contrato | **Sim**: contrato v0.3 com `requisitos` numerados e vínculos. É **mudança de código**, num marco separado |
| B5 | Nome no código | Nexo **nos documentos e na apresentação agora**. Renomear o pacote `forja` → `nexo` depois, num passo próprio com testes |
| B6 | Arquivos | Criar `proposta-nexo.pptx` e `docs/proposta-nexo.md`; manter os antigos como histórico (ou apagar o `-rev3`) |
| B7 | Local, offline e custo zero | Manter como **restrição de projeto e risco**, não como pergunta de pesquisa |
| B8 | Título acadêmico | Opção A: *"Da linguagem natural à especificação verificável: avaliação de uma abordagem híbrida com IA generativa, modelos estruturados e validação determinística para sistemas de pequenos negócios"*. Opção B: *"Nexo: avaliação de uma abordagem híbrida para transformar requisitos de pequenos negócios em especificações de software verificáveis"*. Recomendação: **A** no texto acadêmico e **Nexo** como nome do protótipo |
| B9 | Frase para a banca | *"O Nexo investiga se combinar IA generativa, um modelo estruturado e validação determinística produz especificações de sistemas para pequenos negócios mais completas, consistentes e rastreáveis do que pedir diretamente a uma IA."* Slogan: *"A IA interpreta, o modelo estrutura e a validação verifica."* |
| B10 | Commit da Etapa 2 | Fazer o commit da Etapa 2 **antes** da Fase 2, para separar código de documentação |
| B11 | Pesquisa de fontes na web na Fase 2 | **Sim**: registrar dados bibliográficos e links verificáveis, distinguindo o que a fonte diz da interpretação |
| B12 | Script que gera a apresentação | Versioná-lo no repositório, para os slides serem reproduzíveis |

Fico no aguardo. Pode responder "aprovo as recomendações", ou indicar o que mudar em cada item B1 a B12. Nenhum arquivo será editado antes disso.

---

## Registro técnico
- **Leitura completa:**
  - apresentação (22 slides, com notas, via `slide_text.py`);
  - proposta;
  - `docs/forja/`;
  - registros 001 a 005;
  - `pesquisa/referencias-verificadas.md`.
- **Verificações:** busca de "Forja" nos arquivos; seções e marcadores [VERIFICAR] da proposta.
- **Fidelidade:** o corpo da resposta foi reproduzido do texto enviado; a única diferença é de formatação (títulos de seção com `###` em vez de `##`).
- **Arquivos:** nenhum alterado na Fase 1. Esta entrada foi gravada depois, a pedido do autor (entrada 007), e reestruturada com a pergunta integral na entrada 008.
- **Pendências:**
  - aprovação das decisões B1 a B12, para iniciar a Fase 2;
  - commit da Etapa 2 (entrada 005).
