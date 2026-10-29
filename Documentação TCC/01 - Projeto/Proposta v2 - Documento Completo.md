# Proposta v2 — Forja: sistemas de controle sob medida para pequenos negócios

> **Local:** documento movido de `docs/proposta-v2-gerador-de-sistemas.md` para o vault em 28/10/2026 (entrada 010 do registro). Caminhos citados no texto que começam com `docs/forja/` são históricos: o exemplo da padaria está em `tests/forja/dados/` e o contrato em `src/forja/contrato/`.

**Data:** 2026-10-28 (revisão 3, no mesmo dia). **Status:** PROPOSTA. Ainda não adotada nem aprovada pelo orientador.

Enquanto não for aprovada, o plano v0.1 ([plano-execucao.md](../../docs/plano-execucao.md)) fica registrado, mas **suspenso**: a configuração do Copilot e o piloto N-de-1 estão parados.

**Nome de trabalho:** *Forja* (provisório).

**Apresentação:** [`thesis/apresentacao/proposta-nexo.pptx`](../../thesis/apresentacao/proposta-nexo.pptx). A versão da Forja foi apagada e continua no histórico do git.

Convenções usadas no texto:
- **[PROPOSTA]:** recomendação ainda não aprovada;
- **[VERIFICAR]:** depende de confirmação na literatura, em dados ou no piloto;
- **[NÃO VALIDADO]:** suposição.

> **Revisão 2.** O autor definiu três pontos:
> 1. **Foco:** pequenos negócios que não podem contratar o desenvolvimento de um sistema de controle.
> 2. **O sistema principal precisa ser completo:** mapeamento, regras de negócio definidas pelo usuário, relacionamentos, modelos, documentação e layout final.
> 3. **Execução local**, em qualquer máquina, **sem custo**.
>
> A revisão 1 (gerador avaliado só por configurações de melhorias) foi substituída por esta. Ela não chegou a ser commitada.

> **Revisão 3 (2026-10-28).** Incorpora quatro ajustes recebidos numa revisão crítica:
> 1. **O mapa do sistema tem contrato formal:** JSON Schema e fonte única da verdade. Rascunho pronto e validado em [forja/](<../10 - Nexo - Contrato e Validação/Contrato do Mapa do Sistema.md>).
> 2. **A personalização foi separada da geração livre:** templates + metadados, com uma **matriz de suporte** que declara o que o MVP cobre (seção 4.3).
> 3. **O funcionamento offline precisa ser comprovado** numa máquina limpa e sem internet, **antes** de construir as partes com IA: portão G1 (seção 4.4).
> 4. **O experimento isola o efeito da IA:**
>    - mesmo fluxo, mesmos templates e mesmos critérios nos dois modos;
>    - a IA atua só na **interpretação dos requisitos** (seção 5.1);
>    - documentação e layout passam a ser gerados pelo motor nos dois modos.

---

## 1. A necessidade

**Situação típica [VERIFICAR com dados do SEBRAE e do IBGE na revisão bibliográfica].** Padarias, salões, oficinas, pet shops e pequenas lojas controlam estoque, vendas, clientes e contas com caderno, planilha ou memória. Elas têm três saídas, todas com problemas:

| Alternativa | Problema |
|---|---|
| Sistema pronto (assinatura) | Mensalidade contínua. Não se adapta às regras do negócio. Dados ficam fora da empresa. Depende de internet |
| Contratar um desenvolvedor | Caro e demorado para o porte do negócio. Cada mudança gera um custo novo |
| Planilhas | Frágeis: sem regras, sem relacionamentos, fáceis de corromper. Exigem conhecimento técnico para crescer |

**Lacuna que o TCC ataca:** uma pessoa **sem conhecimento de programação** consegue criar, **sozinha, sem custo e no próprio computador**, um sistema de controle que respeite as **regras do seu negócio**? A IA generativa é o que pode tornar isso viável: ela entende a descrição em linguagem comum e a transforma numa especificação técnica.

**Ligação com o tema original.** O tema *"impacto da IA generativa na agilidade e na qualidade do processo de desenvolvimento de software"* continua no centro. O "processo de desenvolvimento" passa a ser conduzido pelo próprio dono do negócio, com a Forja. A agilidade é o tempo da necessidade até o sistema funcionando. A qualidade é a aderência do sistema às regras do negócio.

**Cuidado de integridade:** o trabalho não parte da resposta. A avaliação precisa admitir que a Forja não resolva a necessidade, ou só resolva em parte. As hipóteses são bilaterais.

---

## 2. Pergunta, objetivos e hipóteses [PROPOSTA]

**Título provisório:** *Forja: um gerador de sistemas de controle baseado em IA generativa local para pequenos negócios — desenvolvimento e avaliação*

**Pergunta de pesquisa:**
> Em que medida um sistema gerador baseado em IA generativa executada localmente permite que pessoas sem conhecimento de programação criem sistemas de controle funcionais e aderentes às regras do seu negócio, e qual é o efeito da IA sobre o tempo, a qualidade e o retrabalho desse processo, em comparação com um processo guiado sem IA?

**Objetivo geral:** desenvolver e avaliar a Forja, um sistema gerador que conduz pequenos empreendedores do mapeamento do negócio até um sistema de controle funcionando localmente, e medir o efeito da IA generativa nesse processo.

**Objetivos específicos:**
1. Caracterizar a necessidade de sistemas de controle em pequenos negócios e as alternativas existentes (dados setoriais e literatura).
2. Sintetizar a evidência sobre IA generativa no desenvolvimento de software e sobre geração de sistemas a partir de especificações (*low-code*, desenvolvimento orientado a modelos, LLMs) [VERIFICAR literatura].
3. Projetar o **mapa do sistema**: uma especificação estruturada com negócio, entidades, relacionamentos, regras, telas e documentação.
4. Implementar a Forja com as 7 etapas (seção 3), usando apenas ferramentas gratuitas e IA local, com um **modo guiado sem IA** para comparação e para máquinas mais fracas.
5. Avaliar tecnicamente os sistemas gerados a partir de cenários de pequenos negócios (aderência às regras, modelo de dados, funcionamento, tempo).
6. Avaliar com usuários reais (donos ou funcionários de pequenos negócios): sucesso, tempo, usabilidade e utilidade percebida.
7. Documentar o escopo, as limitações e as ameaças à validade.

**Hipóteses** (bilaterais):

| ID | Hipótese | Medida principal | Natureza |
|---|---|---|---|
| H1 | O modo com IA altera o tempo para criar um sistema funcionando, em comparação com o modo guiado | `t_criacao_min` | Confirmatória (avaliação técnica) |
| H2 | O modo com IA altera a aderência do sistema às regras do negócio | `taxa_aceitacao` (% de testes de aceitação ocultos aprovados) | Confirmatória |
| H3 | O modo com IA altera o retrabalho do usuário | `n_correcoes` (ajustes feitos pelo usuário até aprovar cada etapa) | Confirmatória |
| H4 | Usuários sem conhecimento de programação conseguem criar um sistema utilizável | Sucesso na tarefa, SUS, utilidade percebida | Exploratória e descritiva (estudo com usuários) |

---

## 3. A Forja: o processo completo em 7 etapas [PROPOSTA]

Em **todas** as etapas, a IA propõe e **o usuário decide**. Nada avança sem aprovação. O resultado de cada etapa é gravado no **mapa do sistema** (seção 4).

| # | Etapa | O que a IA faz | O que o usuário faz | Saída |
|---|---|---|---|---|
| 1 | **Mapeamento do negócio** | Conduz uma conversa em linguagem simples ("o que você vende?", "o que precisa controlar?", "quem usa?") e identifica processos, pessoas e objetos | Responde, corrige e completa | Mapa do negócio: processos, atores e módulos (estoque, vendas, clientes, agenda, financeiro, fornecedores…) |
| 2 | **Regras de negócio** | Transforma frases do usuário em regras formais e **confirma com exemplos** ("se tentar vender 5 e tiver 3 em estoque, o sistema bloqueia. Correto?"). Sugere regras comuns do ramo | **Define**, aprova, edita ou recusa cada regra | Lista de regras (validações, cálculos, restrições, ações automáticas) |
| 3 | **Entidades e relacionamentos** | Propõe as entidades, os campos e os relacionamentos (1:N, N:N) e desenha o diagrama | Ajusta campos, nomes e ligações no diagrama | Modelo entidade-relacionamento |
| 4 | **Modelos** | — (etapa determinística: o **motor de geração** cria o banco, as validações e a lógica das regras a partir do mapa) | Revisa o resumo | Banco SQLite, modelos de dados e regras em código, com testes automáticos gerados do próprio mapa |
| 5 | **Documentação** | — (o **motor** gera a partir do mapa: manual em linguagem simples, cada regra explicada com os exemplos confirmados) | Revisa | Manual, dicionário de dados, lista de regras, diagrama, guia de backup |
| 6 | **Layout final** | — (o **motor** monta as telas padrão a partir do mapa: menu, listas, formulários, painel com indicadores) | Escolhe estilo, cores, logo e nome; reorganiza menu e campos com **prévia ao vivo** | Telas de cadastro, listas, formulários, painel e relatórios |
| 7 | **Entrega** | — (motor) | Abre o sistema | Sistema rodando localmente, atalho "Abrir sistema", backup automático, exportação para planilha |

**Papel da IA (revisão 3):** a IA atua **só nas etapas 1 a 3**, interpretando a linguagem do usuário e propondo alterações no mapa: módulos, entidades, campos, relacionamentos e regras. As etapas 4 a 7 são **determinísticas**: o mesmo mapa produz sempre o mesmo resultado, nos dois modos.

Os **exemplos de confirmação** das regras também são gerados de forma determinística a partir da regra, então existem nos dois modos.

**Customização:** o usuário escolhe os módulos, define as regras, ajusta o modelo, decide o layout e pode **voltar a qualquer etapa** (o mapa é versionado, com histórico e desfazer). Ela vale dentro da matriz de suporte (seção 4.3). A IA pode ser **ligada ou desligada**: no modo guiado, as mesmas etapas 1 a 3 são feitas nos **mesmos formulários**, preenchidos pelo próprio usuário.

---

## 4. Arquitetura: "a IA entende, o motor garante" [PROPOSTA]

```
 Conversa com o dono ─▶ IA local (Ollama) ─▶ MAPA DO SISTEMA ─▶ Motor de geração ─▶ Sistema de controle
   (linguagem comum)    entende, propõe,      (especificação      (templates,          (roda em qualquer
                        documenta, sugere     estruturada,        determinístico)       PC, sem IA e
                        layout                revisada pelo                             sem internet)
                                              usuário)
```

**Decisão central:** a IA **não escreve o código livremente**. Ela transforma a linguagem do usuário em alterações no **mapa do sistema**. Um **motor de geração por templates** converte o mapa em código de forma determinística.

### 4.0 O mapa do sistema: contrato formal e fonte única da verdade

O mapa é um **JSON validado por um JSON Schema** (rascunho v0.1 em [forja/mapa-do-sistema.schema.json](../../src/forja/contrato/mapa-do-sistema.schema.json), com o exemplo completo [forja/exemplo-padaria.mapa.json](../../tests/forja/dados/exemplo-padaria.mapa.json)). Ele contém:
- metadados (incluindo o **modo**: `ia` ou `guiado`);
- negócio e módulos;
- entidades e campos;
- relacionamentos;
- regras (restrição, cálculo, ação), com **expressões estruturadas** em árvore, nunca texto livre, e os exemplos confirmados;
- telas e indicadores;
- **perfis e permissões**;
- **testes de aceitação** do próprio sistema;
- tema.

Regras:
1. **Todo artefato é derivado do mapa:** banco, regras em código, telas, permissões, documentação e testes. Nada é escrito à mão para um negócio específico.
2. **Qualquer saída da IA que não passe no schema é rejeitada** e devolvida para correção. A IA nunca grava fora do formato.
3. Além do schema (forma), um **validador semântico** (fase F2) confere referências, caminhos, tipos, ciclos de cálculo e permissões.
4. **Os exemplos confirmados viram testes de aceitação** do próprio sistema. Os testes ocultos da avaliação do TCC são outra coisa e ficam fora do mapa.

**Verificado em 2026-10-28:**
- o schema é válido e o exemplo da padaria passa;
- 8 mapas propositalmente errados foram recusados (detalhes e questões em aberto em [forja/README.md](<../10 - Nexo - Contrato e Validação/Contrato do Mapa do Sistema.md>)).

**Por quê:**
1. **Confiabilidade:** o mesmo mapa gera sempre o mesmo sistema, e o código dos templates é testado uma vez. Isso importa porque o usuário não sabe programar para corrigir defeitos.
2. **Rodar em qualquer máquina:** o sistema gerado não depende de IA.
3. **Avaliação limpa:** separa o erro de **entendimento** (mapa errado, atribuível à IA) do erro de **geração** (atribuível ao motor).

**Alternativa considerada:** deixar a IA gerar o código diretamente. Ela é mais flexível, mas um modelo local pequeno produziria defeitos que o usuário não conseguiria corrigir. Pode entrar como trabalho futuro.

### 4.1 Tecnologia — custo zero

| Peça | Escolha |
|---|---|
| IA local | **Ollama** + modelo de pesos abertos (escolha no piloto, conferindo a licença) [VERIFICAR] |
| Forja | Python, servidor web local (FastAPI), interface no navegador |
| Diagrama ER | Biblioteca de diagramas que funcione offline (ex.: Mermaid) [VERIFICAR] |
| Sistemas gerados | Python + SQLite + páginas web por templates (Jinja2) |
| Distribuição | Empacotamento em executável, para rodar sem instalar Python [VERIFICAR viabilidade no Windows] |
| Avaliação | pytest, testes de aceitação ocultos, análise estática (reaproveitados do instrumento atual) |

### 4.2 "Em qualquer máquina"

| Parte | Requisito |
|---|---|
| **Sistema gerado** | Leve: qualquer PC comum com Windows, sem internet e sem IA. Banco SQLite local, backup em arquivo |
| **Forja no modo guiado (sem IA)** | Qualquer PC comum |
| **Forja no modo com IA** | Precisa de memória suficiente para o modelo. A GPU acelera, mas não deve ser obrigatória. **O requisito mínimo será medido no piloto** (meta: PC de escritório com 16 GB de RAM [NÃO VALIDADO]). O modelo é baixado uma única vez |

**Máquina de desenvolvimento** (verificada em 2026-10-28): RTX 3060 12 GB, 24 GB de RAM, i7-7700. O piloto também precisa testar a Forja **sem GPU**, para medir o desempenho numa máquina comum.

### 4.3 Personalização × geração livre: matriz de suporte

A personalização é feita por **templates para os componentes executáveis**, combinados com **metadados e regras configuráveis** do mapa. O usuário pode criar quantas entidades, campos, relacionamentos e regras quiser, **desde que dentro das combinações suportadas**. Os templates cobrem essas combinações sem código novo para cada negócio.

A **matriz de suporte do MVP** está em [forja/README.md](<../10 - Nexo - Contrato e Validação/Contrato do Mapa do Sistema.md#matriz-de-suporte-do-mvp-o-que-a-personalização-cobre>). Em resumo:

| Suportado | Fora do MVP |
|---|---|
| 11 tipos de campo; 1:N e N:N; restrições, cálculos e ações com expressões estruturadas e agregações; painel, lista, formulário, mestre-detalhe, relatório; perfis por entidade; 3 estilos de layout | Arquivos e imagens, hierarquias, regras temporais complexas, fluxos de várias etapas, telas e CSS livres, permissão por campo, integrações |

**Na avaliação:** quando um cenário pedir algo fora da matriz, isso é **registrado e contado** como "requisito não suportado". Não é contornado à mão. Essa contagem também é um resultado (cobertura da necessidade).

### 4.4 Prova offline: portão de decisão G1

"Funciona sem IA e sem internet" precisa ser **comprovado**, não suposto. Antes de construir as etapas com IA (F3), a F2 termina com um **portão**:

1. Gerar um sistema a partir do mapa de exemplo (padaria), **sem usar IA**.
2. Empacotar com tudo o que ele precisa:
   - runtime Python embutido ou executável;
   - dependências;
   - banco SQLite;
   - arquivos estáticos, **sem fontes ou scripts de CDN**.
3. Rodar numa **máquina limpa e sem rede**: Windows Sandbox (gratuito no Windows 11 Pro; precisa ser ativado como administrador, rede desligada na configuração `.wsb`) ou um segundo PC sem Python instalado.
4. Checklist de aceite:
   - instalar ou abrir;
   - cadastrar;
   - editar;
   - excluir com bloqueio por relacionamento;
   - relacionamentos (mestre-detalhe);
   - cada regra do exemplo (estoque, fiado, cálculo, ação);
   - painel;
   - relatório;
   - permissões de perfil;
   - backup e restauração;
   - exportação para planilha;
   - reiniciar a máquina e conferir que os dados persistem.
5. **Resultado registrado** em `docs/forja/prova-offline.md`, com data, ambiente e cada item OK ou falhou.

**Se o portão falhar**, a arquitetura de execução é revista **antes** de seguir. Isso evita investir nas partes com IA sobre uma base que não roda offline.

---

## 5. Método e avaliação [PROPOSTA]

**Método:** *Design Science Research*, seguindo as 6 atividades de Peffers et al. (2007) [VERIFICAR]:
1. identificar o problema (seção 1);
2. definir os objetivos da solução (seção 2);
3. projetar e desenvolver (seções 3 e 4);
4. demonstrar (cenários);
5. avaliar (5.1 e 5.2);
6. comunicar (TCC e defesa).

### 5.1 Avaliação técnica (com cenários, sem participantes humanos)
- **Cenários:** cerca de 10 pequenos negócios fictícios e realistas: padaria, salão de beleza, oficina mecânica, pet shop, loja de roupas, papelaria, assistência técnica, distribuidora de bebidas, ateliê de costura e mercadinho. Cada cenário tem:
  - um **roteiro do dono** (as respostas que ele daria na conversa);
  - as **regras do negócio**;
  - o **gabarito** do modelo de dados (entidades, campos, relacionamentos);
  - **testes de aceitação ocultos**, que verificam se o sistema gerado aplica as regras, se as telas abrem, se os cadastros salvam e se os relatórios batem.
- **Integridade:** os cenários de avaliação são escritos **por um terceiro** (orientador ou colega), **selados por hash** e mantidos fora do repositório público até o fim. Há cenários de desenvolvimento separados, usados para construir a Forja.
- **Comparação:** cada cenário é executado no **modo com IA** e no **modo guiado sem IA**, por um operador que segue o roteiro do dono.
  - A ordem é sorteada.
  - No modo com IA há 3 repetições, por causa do não determinismo.
  - Usar um operador diferente do autor é o ideal; se não for possível, a ameaça é declarada.

**Isolamento do efeito da IA (revisão 3).** A única diferença entre os modos é **quem traduz a descrição do negócio em alterações no mapa** (etapas 1 a 3).

| Igual nos dois modos | Diferente |
|---|---|
| Fluxo de 7 etapas, telas e formulários de revisão | **Modo com IA:** o operador descreve o negócio em linguagem comum; a IA propõe as alterações no mapa; o operador revisa e aprova nos formulários |
| Catálogo de módulos e de tipos de regra | **Modo guiado:** o operador preenche os mesmos formulários diretamente, sem sugestões |
| Exemplos de confirmação (gerados de forma determinística a partir da regra) | |
| Schema, validador semântico, motor, templates, documentação e layout gerados | |
| Roteiro do dono, critérios de aceite, testes ocultos, tempo-limite, instruções ao operador | |

Cuidados adicionais:
- **Efeito de ordem:** fazer o mesmo cenário duas vezes ensina o operador. Por isso, metade dos cenários começa pelo modo com IA e metade pelo guiado (contrabalanceamento sorteado). Com dois operadores, cada um faz um modo por cenário.
- **Sem "ajudas" exclusivas:** nenhuma dica, modelo pronto ou atalho existe só num dos modos.
- **Tempo por etapa:** o tempo das etapas 1 a 3 (onde a IA atua) é medido à parte do tempo total.
- **A IA nunca escreve fora do contrato:** propostas inválidas são rejeitadas pelo schema, e cada rejeição é registrada (métrica `rejeicoes_schema`).
- **Métricas:**

| Dimensão | Métrica |
|---|---|
| Agilidade | `t_criacao_min`: do início da conversa ao sistema rodando (H1); tempo por etapa |
| Qualidade do sistema | `taxa_aceitacao`: % de testes ocultos aprovados (H2); `sistema_executa`; telas que abrem e salvam |
| Qualidade do entendimento | Precisão e revocação de entidades, campos, relacionamentos e regras em relação ao gabarito |
| Retrabalho | `n_correcoes`: ajustes feitos pelo operador até aprovar cada etapa (H3) |
| Documentação | Completude por rubrica (manual, dicionário, regras, diagrama) |

- **Análise:**
  - comparações pareadas por cenário (IA × guiado);
  - estimador de Hodges-Lehmann;
  - IC 95% por *bootstrap*;
  - teste de permutação / Wilcoxon;
  - correção de Holm sobre H1–H3.

  Tudo isso reaproveita `estatistica.py`.

### 5.2 Avaliação com usuários (pequenos empreendedores)
- **Participantes:** 6 a 10 donos ou funcionários de pequenos negócios, sem experiência em programação.
- **Tarefa:** criar com a Forja (modo com IA) um sistema para um cenário entregue (ou, opcionalmente, para o próprio negócio) e depois usar o sistema gerado em tarefas do dia a dia (cadastrar, vender, consultar estoque).
- **Medidas:**
  - sucesso na tarefa;
  - tempo;
  - pedidos de ajuda;
  - **SUS** (*System Usability Scale*) [VERIFICAR Brooke, 1996];
  - utilidade percebida;
  - entrevista curta: "isso resolveria a sua necessidade?".
- **Natureza:** exploratória e descritiva (H4).
- **Ética:** há participantes humanos, então a **submissão ao CEP e o TCLE provavelmente são exigidos**. Confirmar com a instituição **logo no início** (D7), porque o prazo de aprovação pode ser longo. **Plano B** se o CEP não couber no prazo: o estudo com usuários vira trabalho futuro, e a avaliação fica técnica, com uma demonstração.

### 5.3 Ameaças à validade (principais)

| Ameaça | Mitigação |
|---|---|
| Cenários fictícios não representam negócios reais | Cenários inspirados em ramos comuns; validação por 1–2 empreendedores reais; estudo com usuários |
| Forja ajustada para os cenários de avaliação | Cenários de avaliação escritos por terceiro, selados, usados só após o congelamento da Forja |
| Operador conhece os cenários | Operador terceiro, ou declaração da ameaça; roteiro do dono fixo |
| IA local pequena entende mal | Confirmação por exemplos; o usuário aprova cada etapa; o motor determinístico isola os erros de entendimento |
| Regras complexas fora do alcance da linguagem de regras | Escopo declarado; regras não suportadas são registradas e contadas |
| Poucos usuários | Estudo descritivo; limitação declarada |
| Desenvolvido com auxílio de IA (Claude) | Declarado em `docs/uso-de-ia-no-tcc.md`; os cenários de avaliação não são escritos pela mesma ferramenta |

---

## 6. Escopo

**Dentro:**
- módulos de controle: estoque, vendas, clientes, fornecedores, agenda/serviços, contas a pagar e receber;
- regras de negócio definidas pelo usuário;
- relatórios e painel simples;
- backup;
- exportação para planilha;
- uso num único computador.

**Fora** (declarado como limite e trabalho futuro):
- emissão de nota fiscal e obrigações fiscais;
- integração bancária, Pix e pagamentos;
- vários computadores em rede ou nuvem;
- aplicativo de celular;
- integração com marketplaces.

---

## 7. O que se aproveita do projeto atual

| Peça atual | Destino |
|---|---|
| `avaliacao.py` (testes públicos e ocultos) | Avaliação dos sistemas gerados |
| `eventos.py` (log com cadeia de hash) | Registro de cada etapa e de cada execução da avaliação |
| `tarefas.py` (pacotes e selagem) | Pacotes de cenário (roteiro, regras, gabarito, testes ocultos) |
| `sorteio.py` | Ordem das execuções (modo × cenário) |
| `estatistica.py`, `pipeline.py`, `dashboard.py` | Análise e dashboard, adaptados |
| `analise_estatica.py` | Qualidade do código dos templates |
| Aplicação `loja` | Referência para o primeiro cenário de desenvolvimento e para os templates |
| Regras de integridade, referências verificadas, vault | Mantidos |
| Sessões N-de-1, guia de sessão, Copilot (D3) | Saem (ficam no histórico do git) |

---

## 8. Cronograma (semanas relativas; ajustar ao prazo real, D7)

| Fase | Semanas | Entregável | Critério |
|---|---|---|---|
| F0 Aprovação e CEP | 1–2 | Proposta aprovada; consulta sobre o CEP | Aval registrado em `decisoes-metodologicas.md` |
| F1 Necessidade e fundamentação | 2–7 | Dados setoriais, literatura, 2–3 conversas exploratórias com empreendedores | Necessidade documentada com fontes verificadas |
| F2 Mapa do sistema + motor + **portão offline G1** | 3–7 | Schema (rascunho v0.1 pronto), validador semântico, templates, empacotamento | Mapa da padaria gera um sistema que **passa no checklist offline numa máquina limpa** (seção 4.4) |
| F3 Etapas com IA | 6–10 | Mapeamento, regras e ER com IA local + modo guiado | Um cenário de desenvolvimento percorre as etapas 1–3 nos dois modos |
| F4 Documentação, layout, entrega | 9–12 | Etapas 5–7, prévia, empacotamento | Sistema gerado abre num PC sem Python |
| F5 Cenários de avaliação | 4–11 (em paralelo) | ~10 cenários selados (terceiro) | Selos registrados |
| F6 Piloto | 12–13 | Ajustes; requisito mínimo de hardware medido | Relatório do piloto |
| F7 Avaliação técnica | 13–15 | Execuções IA × guiado | Todas feitas ou registradas como desvio |
| F8 Avaliação com usuários | 14–16 | Sessões com 6–10 empreendedores | Depende do CEP |
| F9 Análise | 16–17 | Relatório e dashboard | Reproduzível com um comando |
| F10 Redação e defesa | 14–24 | Texto e slides | Resultados só a partir de `reports/` |

**Plano mínimo**, se o prazo for curto:
- módulos estoque, vendas e clientes;
- um estilo de layout;
- 6 cenários;
- 3–5 usuários (ou só a avaliação técnica, se o CEP não couber).

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Escopo grande ("sistema completo") para um TCC | Escopo fechado (seção 6), motor por templates, plano mínimo |
| IA local lenta ou fraca em máquinas comuns | Modelo pequeno escolhido no piloto; modo guiado sem IA; o sistema gerado não depende de IA |
| Prazo do CEP | Consultar no início; plano B só com avaliação técnica |
| Usuários não técnicos não entendem as etapas | Linguagem simples, confirmação por exemplos, teste de usabilidade no piloto |
| Dados do negócio (LGPD) | Tudo local; nada sai da máquina; backup; orientação no manual |

---

## 10. Decisões a registrar quando a proposta for aprovada

| ID | Decisão | Status |
|---|---|---|
| D0 | Tema e pergunta → Forja para pequenos negócios | REVISADA |
| D1 | Desenho → DSR + avaliação técnica pareada + estudo com usuários | REVISADA |
| D2 | Perfil do executor → perfil dos participantes e do operador | REVISADA |
| D3 | Copilot → IA local via Ollama | REVISADA |
| D4 | Cenários de avaliação escritos por terceiro | REVISADA |
| D7 | Inclui a consulta ao CEP para o estudo com usuários | Atualizar |
| D12 | Custo zero e execução local | NOVA |
| D13 | Arquitetura "IA entende, motor garante" (mapa + templates) | NOVA |
| D14 | Escopo dos módulos e matriz de suporte do MVP | NOVA |
| D15 | Mapa como contrato formal (JSON Schema) e fonte única da verdade | NOVA |
| D16 | Portão offline G1 antes das etapas com IA | NOVA |
| D17 | Isolamento do efeito da IA: a IA só interpreta requisitos (etapas 1–3); o resto é idêntico nos dois modos | NOVA |

## 11. Próximos passos

1. Apresentar ao orientador (slides + este documento).
2. Prazo, manual e **consulta ao CEP**.
3. Definir quem escreve os cenários de avaliação.
4. Conversar informalmente com 2–3 pequenos empreendedores para validar a necessidade e os módulos (sem coleta formal antes do CEP, se ele for exigido).
5. Depois do aval:
   - instalar o Ollama;
   - testar modelos (com e sem GPU);
   - escrever o esquema do mapa do sistema e o primeiro template.
