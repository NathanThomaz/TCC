---
tipo: resposta
autor: Claude
numero: "011"
data: 2026-10-28
assunto: "Nova apresentação do Nexo"
pergunta: "[[011_2026-10-28_Pergunta-Nathan_novo-ppt-nexo]]"
tags: [tcc, registro, resposta]
---

# 011 · Resposta do Claude — Nova apresentação do Nexo

**Pergunta:** [[011_2026-10-28_Pergunta-Nathan_novo-ppt-nexo]]

## Resposta enviada (texto integral)

Público considerado: orientador e banca, na apresentação da proposta.

A apresentação nova está pronta: `thesis/apresentacao/proposta-nexo.pptx`, com **19 slides** e notas do apresentador em todos. O arquivo passou na validação, e conferi cada slide renderizado no PowerPoint.

**O que mudou em relação à apresentação da Forja**
- Novo nome e foco: **Nexo**, "da necessidade à especificação verificável", com a frase "A IA interpreta, o modelo estrutura e a validação verifica."
- **Cada afirmação traz uma etiqueta de status** (HIPÓTESE, A LEVANTAR, PARCIAL, IMPLEMENTADO, PLANEJADO, FUTURO, EXPECTATIVA). Assim, plano não aparece como resultado.
- O problema e a lacuna aparecem como hipóteses. O slide de evidências lista onde buscar os dados (Cetic.br, SEBRAE, IBGE, preços com data, conversas com empreendedores) e diz claramente que nenhum número foi levantado.
- **Exemplo concreto com saída real:** a regra "Não posso vender o que acabou" do mapa da padaria, com um erro de digitação proposital e o erro que o validador realmente devolveu (`REF_CAMPO_INEXISTENTE`, com sugestões).
- "O que já existe": contrato v0.2, validador com 48 códigos e 111 testes. Logo abaixo, o aviso de que ainda não há IA integrada nem geração de sistema.
- O método virou uma comparação de quatro condições (A0 a A3), com **A1 × A0 como comparação principal**. Há também a proteção contra viés (cenários de terceiros, avaliador cego, repetições) e uma tabela de métricas com definição e responsável.
- Escopo do MVP com as limitações declaradas, riscos, pontos de debate para a banca e cronograma por fases (F0 a F8).
- O fecho mostra as contribuições *esperadas*. Não há slide de "próximos passos".

**Decisões que assumi** (as recomendações do diagnóstico 006; mudo qualquer uma se você preferir outra):
- B1: A1 × A0 como comparação principal;
- B2: o MVP é especificação + validação, e o motor de geração fica como trabalho futuro;
- B3: o estudo com usuários fica para o futuro;
- B7: execução local e custo zero como restrições, não como perguntas;
- B8: título acadêmico na Opção A;
- B9: o slogan;
- B6: arquivo novo, `proposta-nexo.pptx`. A antiga `proposta-v2-forja.pptx` não foi alterada.

**Atenção antes de apresentar**
- O orientador aparece como "a definir" na capa.
- A proposta escrita no vault ainda é a revisão 3 (Forja) e agora diverge da apresentação; ela precisa da atualização da Fase 2. O `roteiro-defesa.md` também está desatualizado.
- O script que gera os slides está fora do repositório, no scratchpad da sessão: `C:\Users\natha\AppData\Local\Temp\claude\c--Users-natha-Documents-TCC\156b7463-4866-4bf3-8787-a247d5b0f311\scratchpad\deck\build_nexo.js`. Posso copiá-lo para o repositório se você quiser poder gerar os slides de novo.

Registrei esta conversa como par **011** em `09 - Registro de Trabalho` e atualizei o índice, o Estado Atual e o Registro de Sessões. **Nada foi commitado nem enviado ao GitHub.**

## Registro técnico

**Arquivo gerado:** `thesis/apresentacao/proposta-nexo.pptx` (novo; ainda não versionado).

**Estrutura (19 slides, 5 seções):**

| # | Seção | Slide |
|---|---|---|
| 1 | Abertura | Capa: "Nexo: da necessidade à especificação verificável" + título acadêmico (Opção A) |
| 2 | Abertura | O Nexo em uma frase |
| 3 | Problema | O problema a investigar (3 alternativas, todas HIPÓTESE) |
| 4 | Problema | Evidências: o que temos e o que falta (A LEVANTAR) |
| 5 | Problema | Lacuna investigada (HIPÓTESE) |
| 6 | Proposta | Construir, demonstrar e avaliar |
| 7 | Proposta | Pergunta de pesquisa + SQ1 a SQ4 |
| 8 | Proposta | Objetivos (geral + 6 específicos com status) |
| 9 | Proposta | Arquitetura híbrida (fluxo, laço de correção, limites da validação) |
| 10 | Proposta | Exemplo concreto (regra real + saída real do validador) |
| 11 | Proposta | O que já existe e o que é plano |
| 12 | Método | Condições A0 a A3 e o que cada comparação permite concluir |
| 13 | Método | Cenários, gabarito e proteção contra viés |
| 14 | Método | Métricas (definição operacional e quem mede) |
| 15 | Escopo | Escopo do MVP e limitações |
| 16 | Escopo | Riscos e viabilidade |
| 17 | Escopo | Pontos de debate para a banca |
| 18 | Escopo | Cronograma F0 a F8 (semanas relativas) |
| 19 | Escopo | Contribuições esperadas (EXPECTATIVA) |

**Saída real usada no slide 10:**
- mapa da padaria com `regras[1].condicao.dir.campo` trocado de `produto.estoque` para `produto.estoqe`;
- resultado de `python -m forja validar … --json`:
  - código `REF_CAMPO_INEXISTENTE`;
  - caminho `/regras/1/condicao/dir/campo`;
  - camada semântica;
  - sugestões `estoque` e `estoque_minimo`;
  - código de saída 1.
- A regra mostrada no slide confere com `regras[1]` de `tests/forja/dados/exemplo-padaria.mapa.json`, inclusive a mensagem "Estoque insuficiente para este produto."

**Verificações:**
- `validate.py`: todas as validações passaram.
- 19 slides exportados como imagem pelo PowerPoint (sem fechar o aplicativo) e conferidos um a um.
- Corrigido na conferência:
  - título dos slides de conteúdo alinhado à esquerda;
  - no slide 10, a anotação sobrepunha o código e a mensagem estava resumida: agora o erro aparece destacado em amarelo, a nota fica embaixo e a mensagem é a do mapa real;
  - no slide 11 havia espaço vazio: entrou o aviso "Hoje o Nexo valida mapas escritos à mão. Ainda não há IA integrada nem geração de sistema.";
  - no slide 3, títulos dos cartões alinhados.

**Não feito / pendente:**
- sem commit e sem push;
- B1 a B12 continuam formalmente sem resposta: a apresentação adota as recomendações;
- a proposta escrita (Fase 2), o `roteiro-defesa.md` e a remoção da `proposta-v2-forja-rev3.pptx` obsoleta ficam pendentes.
