# Mapa do sistema — contrato da Forja

> **Local:** documento movido de `docs/forja/README.md` para o vault em 28/10/2026 (entrada 010 do registro). Caminhos citados no texto que começam com `docs/forja/` são históricos: o exemplo da padaria está em `tests/forja/dados/` e o contrato em `src/forja/contrato/`.

**Status:** contrato **v0.2** em implementação (Marco 1 — ver [[Plano do Marco 1]]). Parte da [proposta v2](<../01 - Projeto/Proposta v2 - Documento Completo.md>), ainda não aprovada pelo orientador.

> **Atualização em andamento (Marco 1, etapas 1 e 2 concluídas):**
> - o contrato oficial mudou para [`src/forja/contrato/mapa-do-sistema.schema.json`](../../src/forja/contrato/mapa-do-sistema.schema.json) (v0.2);
> - o exemplo da padaria foi migrado para a v0.2;
> - **a validação estrutural e semântica está implementada**: `python -m forja validar <mapa.json>`. Detalhes em [[Validação do Mapa]];
> - testes em `tests/forja/` (111).
>
> O restante deste README ainda descreve a v0.1 (inclusive as "questões em aberto", já resolvidas pelas decisões do Marco 1). Será revisado na etapa de documentação.

O **mapa do sistema** é a **fonte única da verdade** de cada sistema gerado. Banco de dados, regras em código, telas, permissões, documentação e testes são **todos derivados** dele. Nada é escrito à mão para um negócio específico.

A IA e o modo guiado produzem **o mesmo formato**. A única diferença é quem preenche o mapa:
- **modo com IA:** a IA, a partir da conversa, e o usuário revisa;
- **modo guiado:** o próprio usuário, nos formulários.

| Arquivo | Conteúdo |
|---|---|
| [../../src/forja/contrato/mapa-do-sistema.schema.json](../../src/forja/contrato/mapa-do-sistema.schema.json) | Contrato formal (JSON Schema 2020-12), v0.2, recurso do pacote `forja` |
| [exemplo-padaria.mapa.json](../../tests/forja/dados/exemplo-padaria.mapa.json) | Exemplo completo: cenário de **desenvolvimento** "Padaria da Ana" (fictício, público) |

## Seções do mapa

| Seção | O que descreve |
|---|---|
| `metadados` | Data, **modo** (`ia` ou `guiado`) e versão da Forja |
| `negocio` | Nome, ramo e módulos escolhidos |
| `entidades` | Entidades e campos (tipo, obrigatório, único, mínimo/máximo, opções, calculado) |
| `relacionamentos` | 1:N e N:N, nomes nos dois lados, comportamento ao excluir |
| `regras` | `restricao`, `calculo` e `acao`, com **expressões estruturadas** (nunca texto livre) e os exemplos confirmados pelo usuário |
| `telas` | Menu, painel com indicadores, listas, formulários, mestre-detalhe e relatórios |
| `perfis` | Permissões por entidade (ler, criar, editar, excluir) |
| `testes_aceitacao` | Testes do **próprio sistema**, derivados dos exemplos confirmados. Não são os testes ocultos da avaliação do TCC, que ficam fora do mapa |
| `tema` | Nome do sistema, estilo, cores e logo |

## Validação feita em 2026-10-28

```bash
pip install jsonschema   # gratuito
```

Resultado:
- **o schema é válido** (Draft 2020-12) e **o exemplo da padaria passa**;
- **8 mapas propositalmente errados foram recusados:**
  - tipo de campo inexistente;
  - restrição sem mensagem;
  - ação sem alvo;
  - campo de opções sem a lista;
  - regra escrita em texto livre;
  - permissão inventada;
  - cor fora do formato;
  - seção extra não prevista (ex.: código embutido).

## O que o schema NÃO verifica (validação semântica, fase F2)
O JSON Schema garante a **forma**. Um validador semântico, a ser escrito na F2, precisa garantir a **coerência**:
1. Todo `id` referenciado existe (entidade, campo, relacionamento, tela, regra).
2. Todo `caminho` (`produto.estoque`) percorre relacionamentos válidos, e o tipo do resultado é compatível com a operação.
3. Campos `calculado: true` têm exatamente uma regra de cálculo, e não há ciclos entre cálculos.
4. Nenhuma ação altera um campo calculado.
5. Telas usam campos existentes; `menu` só lista telas existentes; todo perfil cobre todas as entidades.
6. Testes de aceitação usam entidades, campos e `@refs` existentes.

## Questões em aberto (encontradas ao escrever o exemplo)
- **Documentos mestre-detalhe** (venda + itens): ao criar a venda, o total ainda é 0, então regras como o limite de fiado só fazem sentido quando a venda é **concluída**. Provável solução: um evento `confirmar` para entidades mestre. O teste `t_limite_fiado` contorna isso editando a venda depois de incluir o item.
- **Ações e edição:** `r_soma_fiado` só dispara ao criar. Se a forma de pagamento mudar para "fiado" numa edição, o saldo não é atualizado. É preciso definir a semântica de ações em `editar` (diferença entre o valor antigo e o novo).
- **Dados iniciais de campos calculados:** o teste do fiado define `saldo_fiado` direto, para montar o cenário. É preciso decidir se testes podem semear campos calculados.
- **Valores monetários:** no mapa ficam em reais (decimal); no banco, em centavos inteiros (convenção já usada na aplicação `loja`).

## Matriz de suporte do MVP (o que a personalização cobre)

A personalização é **ilimitada dentro destas combinações**: o usuário cria quantas entidades, campos, relacionamentos e regras quiser, e os templates as suportam sem código novo. **O que não estiver aqui não é suportado no MVP** e é declarado como limite.

| Elemento | Suportado no MVP | Fora do MVP |
|---|---|---|
| Entidades | Quantas forem necessárias, criadas pelo usuário | Herança entre entidades |
| Tipos de campo | texto, texto longo, inteiro, decimal, moeda, data, data e hora, sim/não, lista de opções, telefone, e-mail | Arquivo, imagem, localização, assinatura |
| Validação de campo | obrigatório, único, mínimo e máximo, opções | Expressões regulares livres |
| Relacionamentos | 1:N; N:N sem atributos; N:N com atributos via entidade intermediária | Auto-relacionamento (hierarquias) e relacionamento 1:1 [a reavaliar] |
| Regras: restrição | Condição com comparações, e/ou/não, aritmética, campos via relacionamento, agregações (soma, contagem, mín., máx.) com filtro, hoje/agora | Regras com estado temporal (ex.: "três atrasos no mês"), regras entre registros sem relacionamento |
| Regras: cálculo | Campo derivado por expressão ou agregação | Cálculos recursivos ou com ciclo |
| Regras: ação | Somar, subtrair ou definir um campo ao criar/editar/excluir, com condição e estorno | Fluxos de várias etapas, envio de mensagens, tarefas agendadas |
| Telas | Painel com indicadores, lista com filtros, formulário, mestre-detalhe, relatório agrupado por período | Telas desenhadas livremente, gráficos personalizados |
| Perfis | Perfis com permissão por entidade; login local | Permissão por campo ou por registro, login integrado |
| Layout | 3 estilos, cores, logo, nome, ordem do menu, campos visíveis | CSS livre |
| Saída | Exportação CSV/planilha, backup em arquivo | Integrações externas, nota fiscal, pagamentos |
