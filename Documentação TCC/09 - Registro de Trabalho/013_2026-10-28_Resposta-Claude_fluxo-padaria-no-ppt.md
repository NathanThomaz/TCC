---
tipo: resposta
autor: Claude
numero: "013"
data: 2026-10-28
assunto: "Fluxo do Nexo com o exemplo da padaria; refazer a tela 10"
pergunta: "[[013_2026-10-28_Pergunta-Nathan_fluxo-padaria-no-ppt]]"
tags: [tcc, registro, resposta]
---

# 013 · Resposta do Claude — Fluxo com o exemplo da padaria

**Pergunta:** [[013_2026-10-28_Pergunta-Nathan_fluxo-padaria-no-ppt]]

## Resposta enviada (texto integral)

Público considerado: orientador e banca.

Pronto: `thesis/apresentacao/proposta-nexo.pptx` agora tem 19 slides. Substituí o arquivo principal e apaguei a cópia `-v2`, que era temporária, para ficar uma versão só.

**Novo: o fluxo com a padaria da Ana**
- **Como o Nexo resolve?** As 4 etapas: Atender → Transformar → Criar → Disponibilizar.
- **Etapa 1 · Atender:** a troca de mensagens entre a Ana e o Nexo, até a confirmação da regra ("5 pães com 3 em estoque: bloqueia. Certo?").
- **Etapa 2 · Transformar:** cada fala vira uma parte do mapa (entidade, regra, teste), e a validação confere: 0 erros (resultado real).
- **E se o mapa tiver um erro?** O erro real que o validador aponta.
- **Etapa 3 · Criar:** a tela do sistema da padaria bloqueando a venda, e o que o motor gera.
- **Etapa 4 · Disponibilizar:** no computador da padaria, sem internet, sem mensalidade, com backup e manual. Mudou uma regra? Volta à conversa.

**Tela 10 refeita:** agora é "Como vamos avaliar?" em diagrama: mesmo cenário → IA direta × IA + Nexo → avaliador cego.

A conversa e a tela do sistema estão marcadas como ilustração, porque mostram como vai funcionar. A IA e a geração do sistema ainda não existem em código.

Registrado como par 013. Sem commit.

## Registro técnico

**Arquivo:** `thesis/apresentacao/proposta-nexo.pptx` (19 slides).
- Substituiu a versão de 19 slides da entrada 011, que não estava mais aberta no PowerPoint.
- `proposta-nexo-v2.pptx` (entrada 012) foi removida: era cópia temporária e seu conteúdo está incorporado.
- Gerador: `build_nexo3.js` no scratchpad (cabeçalho do `build_nexo.js` + `corpo3.js`, montado a partir de `corpo2.js` + `blocos3.js`).

**Ordem dos slides:**
1. Capa
2. O que é o Nexo?
3. Qual é o problema?
4. Qual é a causa?
5. Como o Nexo resolve? (4 etapas)
6. Etapa 1 · Atender (conversa)
7. Etapa 2 · Transformar (fala → mapa)
8. E se o mapa tiver um erro?
9. Etapa 3 · Criar (tela do sistema)
10. Etapa 4 · Disponibilizar
11. Em que ponto está o motor?
12. Pergunta de pesquisa
13. Objetivos
14. Como vamos avaliar? (diagrama novo)
15. O que vamos medir?
16. Escopo
17. Riscos
18. Cronograma
19. O que o TCC entrega?

**Fatos reais usados:**
- o mapa da padaria (`tests/forja/dados/exemplo-padaria.mapa.json`) valida com 0 erros e 0 avisos;
- a mensagem "Estoque insuficiente para este produto." é a da regra `r_estoque_suficiente`;
- o erro `REF_CAMPO_INEXISTENTE` do slide 8 é saída real do validador.

**Ilustrativo (marcado como tal):**
- a conversa da Ana (slide 6);
- a tela do sistema gerado (slide 9);
- a etapa de disponibilização (slide 10, descrita no futuro).

**Verificações:**
- `validate.py`: passou;
- slides novos renderizados pelo PowerPoint e conferidos;
- textos encurtados para não quebrar linha nos balões da conversa.

**Pendente:**
- dados das consultas com empresas (entrada 012), se existirem;
- sem commit.
