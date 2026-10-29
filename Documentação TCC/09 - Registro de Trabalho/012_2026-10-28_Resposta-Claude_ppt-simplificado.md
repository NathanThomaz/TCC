---
tipo: resposta
autor: Claude
numero: "012"
data: 2026-10-28
assunto: "Apresentação simplificada (perguntas curtas, causa e solução)"
pergunta: "[[012_2026-10-28_Pergunta-Nathan_ppt-simplificado]]"
tags: [tcc, registro, resposta]
---

# 012 · Resposta do Claude — Apresentação simplificada

**Pergunta:** [[012_2026-10-28_Pergunta-Nathan_ppt-simplificado]]

## Resposta enviada (texto integral)

*Aviso enviado antes de começar:*

Antes de refazer, dois pedidos esbarram em fatos, e preciso ser direto sobre eles: até agora nenhum dado de pequenas empresas foi levantado, e não existe código do motor de geração (existem só o contrato e o validador). Vou simplificar os slides e tirar o "híbrido" e o "vamos levantar". Mas não vou escrever que os dados já foram levantados. Do motor, digo só o que é verdade. Explico melhor no fim.

*Resposta final:*

Público considerado: orientador e banca.

A nova versão está em `thesis/apresentacao/proposta-nexo-v2.pptx`, com 15 slides. Ela não substituiu a `proposta-nexo.pptx` porque essa está aberta no seu PowerPoint. Feche e me avise que eu troco.

**O que mudou**
- Cada slide é uma pergunta curta com resposta rápida: O que é? → Qual é o problema? → Qual é a causa? → Como o Nexo resolve? → Como funciona na prática? → Em que ponto está o motor? → pesquisa, avaliação, escopo, riscos, cronograma e entregas.
- Tirei o "híbrido", as etiquetas de hipótese e todo o "vamos levantar com pequenas empresas".

**Dois pontos que não escrevi como você pediu**
- **"Já levantamos os dados, com consultas":** não tenho registro de nenhuma consulta feita, e afirmar isso numa banca seria dado inventado. Se você já fez as consultas, me passe quantas foram, com que tipo de negócio, quando e o que descobriu. Com isso eu monto um slide "O que as consultas mostraram".
- **"O motor já está em desenvolvimento":** escrevi "Em desenvolvimento. O núcleo já funciona e está testado". Isso é verdade: contrato, validador e 111 testes estão prontos. A IA e a geração do sistema aparecem como próximas etapas, porque ainda não existe código delas.

Registrado como par 012 no vault. Sem commit.

## Registro técnico

**Arquivo:** `thesis/apresentacao/proposta-nexo-v2.pptx`, com 15 slides e notas curtas.
- A `proposta-nexo.pptx` (19 slides, entrada 011) estava aberta no PowerPoint (EBUSY) e não foi substituída.
- Gerador: `build_nexo2.js` no scratchpad da sessão (cabeçalho do `build_nexo.js` + `corpo2.js`).

**Slides:**

| # | Pergunta | Resposta rápida |
|---|---|---|
| 1 | Capa | Nexo: da necessidade do pequeno negócio à especificação verificada |
| 2 | O que é o Nexo? | Ferramenta que transforma a descrição do negócio numa especificação verificada; a IA interpreta, o mapa estrutura, a validação verifica |
| 3 | Qual é o problema? | Sistema pronto não segue as regras; sob medida é caro; planilha erra |
| 4 | Qual é a causa? | Traduzir o negócio em regras precisas é difícil, e é aí que os erros nascem |
| 5 | Como o Nexo resolve? | Fluxo em 4 passos com laço de correção; o erro é pego no mapa |
| 6 | Como funciona na prática? | Regra real da padaria + saída real do validador |
| 7 | Em que ponto está o motor? | Em desenvolvimento: pronto (contrato, validador, 111 testes) × próximo (v0.3, IA local, correção, geração) |
| 8 | Qual é a pergunta de pesquisa? | O mapa e a validação melhoram as especificações em relação à IA direta? |
| 9 | Quais são os objetivos? | 4 objetivos com status |
| 10 | Como vamos avaliar? | IA direta × IA + Nexo; mesmas condições, terceiros, avaliador cego, 5 repetições |
| 11 | O que vamos medir? | Completude, consistência, rastreabilidade, erros que escapam |
| 12 | O que entra e o que fica fora? | Escopo + limite |
| 13 | Quais são os riscos? | Risco → mitigação |
| 14 | Qual é o cronograma? | F0 a F8 (F1 agora é "Fundamentação teórica") |
| 15 | O que o TCC entrega? | Contrato, validador, método, evidência |

**Verificações:**
- `validate.py`: passou;
- 15 slides renderizados pelo PowerPoint e conferidos;
- ajustes feitos na conferência:
  - slide 2: o texto passava da margem;
  - slides 7 e 8: sobrava espaço vazio.

**Integridade:**
- não foi escrito que os dados foram levantados, porque não há registro de consulta;
- "motor em desenvolvimento" foi limitado ao que existe;
- termos removidos: "híbrido", "hipótese", "a levantar";
- o problema foi redigido sem números.

**Pendente:**
- substituir `proposta-nexo.pptx` pela v2 depois que o PowerPoint for fechado;
- dados reais das consultas, se existirem;
- sem commit.
