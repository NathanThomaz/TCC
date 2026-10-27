# Ferramentas de IA generativa no experimento

Este documento cobre:
1. as categorias de ferramentas de IA para programação;
2. os critérios para escolher a ferramenta da condição B (decisão D3);
3. como a ferramenta é configurada, registrada e usada durante a coleta;
4. as ameaças à validade específicas da IA.

> **Nota de verificação:** nomes de produtos, modelos, preços e recursos mudam com
> frequência. Tudo o que for específico de uma ferramenta deve ser **conferido na
> documentação oficial no dia da decisão** e registrado com data. Este documento
> não afirma preço, versão nem desempenho de nenhuma ferramenta.

---

## 1. Categorias de ferramentas

A diferença entre categorias é o **grau de autonomia** da ferramenta, e isso muda o próprio *processo* estudado. Por isso a modalidade é registrada em toda execução.

| Modalidade (`experimento.toml`) | O que a ferramenta faz | Papel do desenvolvedor | Exemplos de produtos (conferir disponibilidade) |
|---|---|---|---|
| — (autocompletar) | Sugere a continuação do código no editor, à medida que se digita | Escreve, aceita ou rejeita sugestões | Autocompletar do GitHub Copilot e equivalentes em outros editores |
| `ide-chat` | Chat integrado ao editor que lê o código aberto e propõe edições | Pergunta, revisa e aplica edições | Chat do Copilot, Cursor, Gemini Code Assist, Continue |
| `chat-externo` | Chat no navegador, sem acesso direto ao projeto | Copia e cola contexto e código | ChatGPT, Claude.ai, Gemini |
| `agente` | Lê e edita vários arquivos, roda comandos e testes e itera sozinho | Define a tarefa, supervisiona e revisa o resultado | Claude Code, modo agente do Copilot, Cursor Agent, Codex CLI |

Na literatura verificada até agora ([../pesquisa/referencias-verificadas.md](../pesquisa/referencias-verificadas.md)):
- a maioria dos experimentos controlados mais antigos usou **autocompletar/Copilot** (Peng et al., 2023; Vaithilingam et al., 2022; Mozannar et al., 2024);
- Becker et al. (2025) permitiram as ferramentas da "fronteira do início de 2025" escolhidas pelos participantes;
- as ferramentas **agênticas** de 2025–2026 aparecem menos em experimentos controlados até onde a busca preliminar alcançou. **[NÃO VALIDADO: confirmar na revisão da Etapa 2.]**

## 2. Critérios de escolha da ferramenta (D3)

| Critério | Por que importa | Como verificar |
|---|---|---|
| **Validade ecológica** | O resultado deve refletir o uso real, então a escolha deve ser uma ferramenta que o executor usaria no trabalho | Declaração do executor |
| **Disponibilidade durante toda a coleta** | Trocar de ferramenta no meio da coleta invalida a comparação | Plano e assinatura ativos durante todo o período |
| **Possibilidade de fixar o modelo** | Reduz a variação de comportamento ao longo das sessões | Configuração da ferramenta |
| **Registro de interações** | Transcrições caracterizam o tratamento e ajudam a explicar casos discrepantes | Exportação de conversa ou log |
| **Custo** | Precisa caber no orçamento do TCC | Página de preços na data, registrada aqui |
| **Termos de uso e privacidade** | O código enviado é fictício, mas os termos devem ser registrados | Termos na data |
| **Controle de acesso a arquivos** | Agentes não podem alcançar os pacotes selados | Rodar a ferramenta só dentro do workspace da execução |
| **Busca na web** | Muda o tratamento: "IA + web" é diferente de "IA" | Configuração registrada (`busca_web`) |

**Recomendação:** uma **única** ferramenta, na modalidade que o executor de fato usa, com o modelo fixado e a atualização automática desligada durante a coleta.

### 2.1 Comparação das opções (pesquisa de 2026-10-28)

> **Confiabilidade das informações:** a maior parte dos preços e limites veio de sites de terceiros, que se contradizem em vários pontos. Antes de decidir, conferir na **página oficial** de cada ferramenta e anotar a data na seção 5. Itens marcados [?] não foram confirmados.

| Critério | GitHub Copilot (VS Code) | Cursor | Codex CLI (OpenAI) | Gemini CLI / Code Assist | Claude Code |
|---|---|---|---|---|---|
| Modalidade | autocompletar + chat + agente no editor | editor próprio (base VS Code) com chat e agente | agente de terminal | agente de terminal + extensão | agente de terminal / IDE |
| Custo para estudante | Plano estudantil gratuito via GitHub Education, com créditos limitados de chat/agente [?] ([fonte](https://agentdex.app/blog/copilot-student/)). Pro: US$ 10/mês ([fonte](https://benchlm.ai/github-copilot/pricing)) | Pro: US$ 20/mês. Há relato não confirmado de mudança de planos em out/2026 ([fonte](https://coworker.ai/blog/cursor-pricing)) | Incluído em planos pagos do ChatGPT ([fonte](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex)) | Cota gratuita oficial para indivíduos ([fonte](https://developers.google.com/gemini-code-assist/docs/gemini-cli)). Há relato **conflitante** de suspensão em jun/2026 [?] ([fonte](https://www.therundown.ai/tools/gemini-cli)) | Plano pago da Anthropic |
| Fixar o modelo | Seletor de modelo no chat. **Não usar "Auto"** | Seletor de modelo. **Não usar "Auto"** | `codex -m <modelo>` ([docs](https://developers.openai.com/codex/models)) | `-m <modelo>` | `--model` |
| Registro das interações | Exportação da sessão em JSON pela paleta de comandos ("Chat: Export…"; o nome varia por versão) ([fonte](https://code.visualstudio.com/docs/copilot/chat/chat-sessions)) | [?] não confirmado | JSONL por sessão em `~/.codex/sessions/`, com prompts, respostas, comandos e modelo por turno ([fonte](https://allaboutcoding.ghinda.com/where-ai-coding-clis-store-session-logs/)) | [?] | JSONL por sessão |
| Restrição ao workspace | Abrir no VS Code **apenas** a pasta do workspace | Idem | Sandbox de escrita restrita ao diretório [?] | Diretório atual | Diretório atual + permissões |
| Comparabilidade com a literatura | **Alta**: Copilot é a ferramenta de Peng et al. (2023), Vaithilingam et al. (2022), Mozannar et al. (2024) e Cui et al. (2026) | Média | Baixa (agentes de terminal são pouco estudados em experimentos controlados, até onde a busca alcançou) | Baixa | Baixa |
| Risco de afinidade com o autor das tarefas (Claude) | Baixo, se o modelo escolhido **não** for Claude | Idem | Baixo | Baixo | **Alto**: evitar ou declarar |
| Risco de faltar cota no meio da sessão | Médio no plano estudantil (créditos mensais) [?] | Médio | Depende do plano | Médio | Depende do plano |

**Leitura metodológica:**
1. **Copilot no VS Code** tem a melhor combinação para este TCC: é gratuito para estudantes (se a elegibilidade se confirmar), permite comparação direta com a literatura, mantém o mesmo editor nas condições A e B (no perfil A basta desativar a extensão) e exporta a sessão. O risco principal é a **cota de créditos**: 32 sessões (8 de piloto + 24 principais) podem estourar o limite mensal do plano estudantil. Medir o consumo na fase de prática. Se não couber, usar o Pro.
2. **Codex CLI** é a melhor opção para **rastreabilidade** (modelo fixo por parâmetro, log completo por sessão), mas muda a modalidade para agente de terminal. O estudo passaria a ser sobre "agente de IA", e não "assistente no editor". Isso é válido, mas precisa ser decidido de forma consciente.
3. **Claude Code** deve ser evitado na condição B, por causa da afinidade com quem escreveu as tarefas e o instrumento (seção 2).
4. **Gemini:** a informação sobre o acesso gratuito é contraditória. Só considerar após confirmar na página oficial.

**Ameaça a declarar:** o projeto, o instrumento e as tarefas-piloto foram elaborados com auxílio do Claude (Anthropic). Se a ferramenta da condição B também usar modelos Claude, existe o risco de afinidade de estilo entre quem escreveu as tarefas e quem ajuda a resolvê-las. Preferir outra ferramenta para a condição B ou, se mantida, declarar essa ameaça no capítulo de validade.

## 3. Configuração e registro

### 3.1 Antes da coleta (uma vez)
1. Preencher `[ferramenta_ia]` em `experiment/config/experimento.toml`: `nome`, `fornecedor`, `modalidade`, `modelo`, `versao_cliente`, `busca_web` e `observacoes`.
2. Registrar neste arquivo, na seção 5: a data, o plano e assinatura, o custo, as configurações relevantes (contexto, regras personalizadas, extensões) e capturas de tela das configurações, guardadas em `docs/anexos/ferramenta-ia/`.
3. Desligar a atualização automática do cliente, ou registrar cada atualização como desvio.
4. Criar dois **perfis de editor**:
   - **Perfil A:** sem extensões de IA, sem autocompletar por IA e sem chat;
   - **Perfil B:** com a ferramenta configurada.

### 3.2 Em cada execução
- **Condição A:** `exp abrir <id> --confirmo-sem-ia`. A confirmação só deve ser dada após o checklist em [guia-sessao.md](guia-sessao.md).
- **Condição B:** `exp abrir <id> --modelo "<modelo exibido pela ferramenta>"`. Se o modelo exibido divergir do configurado, o instrumento marca `modelo_diverge_da_config`.
- **Ao final, na condição B:** exportar a transcrição e rodar `exp anexar <id> <arquivo>`. O arquivo é copiado para `data/raw/<fase>/anexos/<id>/` com hash SHA-256.

### 3.3 O instrumento não chama a IA
O módulo [src/tcc_exp/ia.py](../src/tcc_exp/ia.py) é um **adaptador de registro**: ele valida e grava os metadados da condição, mas não se comunica com nenhum fornecedor.

Consequências:
- o experimento não depende de chave de API nem de SDK de fornecedor;
- trocar de ferramenta exige só editar a configuração;
- se a ferramenta estiver fora do ar, a sessão é **abortada e remarcada**. Nunca se produz nenhum dado no lugar.

## 4. Regras de uso durante a condição B

1. **Uso livre** da ferramenta escolhida, como no dia a dia: perguntar, pedir código, pedir revisão, pedir testes e, no caso de agentes, deixar a ferramenta editar e rodar comandos.
2. **Proibido:**
   - qualquer outra ferramenta de IA;
   - deixar a IA rodar `exp entregar`, `exp encerrar-limite` ou `exp abortar` (a decisão de entregar é do executor);
   - apontar a IA para diretórios fora do workspace da execução.
3. O executor é responsável pela entrega: pode aceitar, rejeitar ou corrigir o que a IA produzir.
4. Os testes públicos podem ser compartilhados com a IA, porque fazem parte do workspace. Os ocultos não estão acessíveis.

## 5. Registro da ferramenta escolhida

> D3 adotada provisoriamente em 2026-10-28: o executor escolheu o GitHub Copilot no VS Code. Os campos marcados ⏳ devem ser preenchidos pelo executor na configuração.

| Campo | Valor | Data da verificação |
|---|---|---|
| Ferramenta | GitHub Copilot (extensões GitHub Copilot + Copilot Chat) no VS Code | 2026-10-28 |
| Fornecedor | GitHub (Microsoft) | 2026-10-28 |
| Modalidade | `ide-chat`, com uso livre de autocompletar, chat e modo agente | 2026-10-28 |
| Modelo(s) | ⏳ nome exato no seletor (não "Auto"; não Claude) | |
| Versão do cliente | ⏳ VS Code + extensão Copilot Chat | |
| Plano / custo | ⏳ plano do executor (estudantil / Free / Pro / Pro+) e preço na página oficial | |
| Busca web habilitada? | ⏳ conferir nas configurações do Copilot e deixar **desligada** | |
| Exportação de transcrição | Paleta de comandos → "Chat: Export…" (JSON), depois `exp anexar` | 2026-10-28 |
| Observações | Medir o consumo de créditos na fase de prática (risco de esgotar a cota no meio da coleta) | |

### 5.1 Checklist de configuração do Copilot (fazer uma vez, antes da prática)

1. **Perfis do VS Code** (Arquivo → Perfis):
   - **"TCC-A"**: sem as extensões GitHub Copilot e Copilot Chat (ou com ambas **desabilitadas** neste perfil);
   - **"TCC-B"**: com as duas habilitadas.
2. Em **TCC-B**, nas configurações (JSON do perfil):
   - `"extensions.autoUpdate": false`, para que a extensão não mude durante a coleta;
   - `"update.mode": "none"`, opcional, para congelar também o VS Code.
3. No chat do Copilot, abrir o **seletor de modelo**:
   - escolher **um** modelo que não seja "Auto" nem da família Claude;
   - copiar o nome exato para `modelo` em `experiment/config/experimento.toml`.
4. Anotar a versão da extensão Copilot Chat em `versao_cliente`.
5. Conferir se o Copilot tem alguma opção de busca na web ou de ferramentas externas habilitada. Desligar e registrar.
6. Rodar `exp verificar-ambiente`. A linha "Ferramenta de IA (condição B)" deve dizer **configurada**.
7. **Prática (≥ 3 h, tarefas não relacionadas):** anotar quantos créditos ou requisições cada sessão consome (página de uso da conta GitHub) e estimar se 32 sessões cabem no plano. Se não couberem, decidir o upgrade **antes** do piloto e registrar em `decisoes-metodologicas.md`.

### 5.2 Em cada sessão da condição B

- Abrir o VS Code no perfil **TCC-B**, com **apenas** a pasta do workspace da execução.
- Conferir no seletor que o modelo é o configurado e passar o nome em `exp abrir X.. --modelo "<nome>"`.
- Ao final: Paleta de comandos → "Chat: Export…" → salvar o JSON → `exp anexar X.. <arquivo.json> --descricao "transcrição Copilot"`.

## 6. Ameaças à validade específicas da IA

| Ameaça | Efeito possível | Mitigação |
|---|---|---|
| Atualização silenciosa do modelo pelo fornecedor | Tratamento B diferente ao longo da coleta | Modelo fixado quando possível, `--modelo` registrado em cada sessão, coleta concentrada em poucas semanas |
| Não determinismo das respostas | Variação entre execuções | Parte do tratamento real. As transcrições permitem descrever a variação |
| Contaminação de treino (a tarefa existe na internet) | Desempenho de B inflado | Tarefas originais, seladas e fora do repositório público |
| Afinidade autor–ferramenta (ver seção 2) | Desempenho de B inflado | Ferramenta de outro fornecedor ou declaração explícita |
| Novidade ou inexperiência com a ferramenta | Desempenho de B reduzido | Período de prática antes da coleta |
| Dependência de conectividade | Abortos em B | Regra de aborto e remarcação. Abortos são reportados |
| Comparação "IA vs. sem IA" confunde ferramenta e modalidade | Generalização indevida | Conclusões restritas à ferramenta e à modalidade estudadas |
