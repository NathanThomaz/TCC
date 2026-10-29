---
tipo: resposta
autor: Claude
numero: "014"
data: 2026-10-28
assunto: "Tema em destaque na capa; cronograma com prazo final 20/11"
pergunta: "[[014_2026-10-28_Pergunta-Nathan_tema-na-capa-e-prazo]]"
tags: [tcc, registro, resposta]
---

# 014 · Resposta do Claude — Tema na capa e prazo

**Pergunta:** [[014_2026-10-28_Pergunta-Nathan_tema-na-capa-e-prazo]]

## Resposta enviada (texto integral)

Público considerado: orientador e banca.

Feito em `thesis/apresentacao/proposta-nexo.pptx`:
- **Capa:** o tema do TCC aparece em destaque, numa faixa laranja: "Impacto da inteligência artificial generativa na agilidade e na qualidade do processo de desenvolvimento de software". Usei o texto oficial que está no vault, sem alterar nada.
- **Cronograma:** troquei semanas por datas, de 28/10 a 20/11. Há uma linha marcando "20/11 · entrega final", e cada fase mostra seu período (por exemplo, IA local de 02/11 a 08/11 e experimento de 10/11 a 13/11).

O resto não mudou.

Um alerta: são 23 dias para integrar a IA, montar os cenários, rodar o experimento, analisar e escrever. Cabe, mas sem folga. Se algo atrasar, o corte natural é usar menos cenários e fazer só a comparação IA direta × IA + Nexo. Deixei isso nas notas do slide.

Registrado como par 014. Sem commit.

## Registro técnico

**Origem do tema:** [[Painel do TCC]] e [[Tema, Pergunta e Objetivos]] (arquivo original `Tema TCC.txt`).

**Cronograma (dia 0 = 28/10/2026):**

| Fase | Período |
|---|---|
| F0 Aprovação da proposta | 28/10 a 30/10 |
| F1 Fundamentação teórica | 29/10 a 12/11 (em paralelo) |
| F2 Contrato v0.3 | 30/10 a 02/11 |
| F3 IA local + correção | 02/11 a 08/11 |
| F4 Cenários e gabarito | 30/10 a 06/11 (em paralelo) |
| F5 Piloto | 08/11 a 09/11 |
| F6 Experimento | 10/11 a 13/11 |
| F7 Análise | 13/11 a 15/11 |
| F8 Redação e defesa | 10/11 a 20/11 (em paralelo) |

**Arquivo:**
- `proposta-nexo.pptx` substituído; continua com 19 slides;
- gerador: `build_nexo4.js` (com `corpo4.js`) no scratchpad.

**Verificações:**
- `validate.py`: passou;
- capa e cronograma renderizados e conferidos;
- o ícone da capa foi reposicionado para não ficar sob a faixa do tema.

**Pendente:**
- confirmar o prazo de 20/11 com a instituição e o orientador;
- sem commit.
