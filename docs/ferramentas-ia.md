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

> Preencher após a decisão D3.

| Campo | Valor | Data da verificação |
|---|---|---|
| Ferramenta | | |
| Fornecedor | | |
| Modalidade | | |
| Modelo(s) | | |
| Versão do cliente | | |
| Plano / custo | | |
| Busca web habilitada? | | |
| Exportação de transcrição | | |
| Observações | | |

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
