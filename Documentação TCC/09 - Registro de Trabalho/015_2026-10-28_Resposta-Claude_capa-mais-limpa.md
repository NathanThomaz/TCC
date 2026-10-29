---
tipo: resposta
autor: Claude
numero: "015"
data: 2026-10-28
assunto: "Capa mais limpa"
pergunta: "[[015_2026-10-28_Pergunta-Nathan_capa-mais-limpa]]"
tags: [tcc, registro, resposta]
---

# 015 · Resposta do Claude — Capa mais limpa

**Pergunta:** [[015_2026-10-28_Pergunta-Nathan_capa-mais-limpa]]

## Resposta enviada (texto integral)

*Aviso enviado antes de começar:*

Vou separar a capa em dois blocos claros: o **tema** como título principal, grande, e logo abaixo o **projeto Nexo** com o slogan. Os dados do autor ficam discretos no rodapé, e sai a faixa laranja.

*Resposta final:*

A capa foi refeita em `thesis/apresentacao/proposta-nexo.pptx`, agora com três níveis separados:
1. **Tema do TCC:** em cima e grande, é o destaque da capa.
2. **Nexo:** depois de uma linha divisória, o ícone, o nome e o slogan "Da necessidade do pequeno negócio à especificação verificada".
3. **Rodapé discreto:** proposta, curso, autor, orientador e data.

Saíram a faixa laranja e o ícone grande, que disputavam a atenção com o texto. Os outros slides não mudaram.

Registrei esta conversa como par 015. Nada foi commitado.

## Registro técnico

- O layout da capa (`CAPA_ESCURA`) foi redefinido:
  - o título agora é o tema (30 pt, largura total);
  - o corpo é o slogan;
  - a meta vai para o rodapé.
- Na capa: o rótulo "TEMA DO TCC", uma linha divisória e o disco com o ícone do Nexo (0,82").
- Gerador: `build_nexo5.js` (`head5.js` + `corpo5.js`) no scratchpad.
- `validate.py`: passou; a capa foi renderizada e conferida.
- `proposta-nexo.pptx` substituído (19 slides). Sem commit.
