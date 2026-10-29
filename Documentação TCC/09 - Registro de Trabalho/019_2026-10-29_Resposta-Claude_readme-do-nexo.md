---
tipo: resposta
autor: Claude
numero: "019"
data: 2026-10-29
assunto: "README reescrito para o Nexo"
pergunta: "[[019_2026-10-29_Pergunta-Nathan_readme-do-nexo]]"
tags: [tcc, registro, resposta]
---

# 019 · Resposta do Claude — README reescrito para o Nexo

**Pergunta:** [[019_2026-10-29_Pergunta-Nathan_readme-do-nexo]]

## Resposta enviada (texto integral)

Reescrevi o `README.md`, que agora apresenta o Nexo. Ele traz:
- o tema, o título provisório e a pergunta de pesquisa;
- o problema, o que o Nexo faz e as quatro etapas: atender, transformar, criar, disponibilizar;
- o status real:
  - prontos: o contrato, o validador e os testes;
  - próximos passos: a IA local, a geração do sistema e a avaliação;
  - nenhum resultado coletado ainda;
- como instalar, validar o mapa da padaria e rodar os testes. Conferi os comandos: o mapa dá 0 erros e os 111 testes do Nexo passam;
- onde fica a documentação no vault;
- o projeto anterior (N-de-1), num bloco curto marcado como suspenso. O texto antigo do README continua no histórico do git.

Ainda não fiz commit nem push. O README é a primeira coisa que aparece no GitHub, então vale você revisar antes. Quando aprovar, envio para a `main` e para a `forja-marco-1`.

Registrei esta conversa como par 019.

## Registro técnico

- Fontes do conteúdo:
  - a apresentação `proposta-nexo.pptx`: tema, título provisório (nas notas do slide 1), problema, etapas, status, pergunta e limites;
  - o código em `src/forja/`.
- Conferido antes de escrever:
  - `python -m forja validar tests/forja/dados/exemplo-padaria.mapa.json`: VÁLIDO, 0 erro(s), 0 aviso(s);
  - `python -m pytest -q tests/forja`: 111 passaram;
  - os módulos citados existem;
  - o validador checa transições (`REF_TRANSICAO_INEXISTENTE`, `TRANSICAO_DE_ESTADO_FINAL` e outros).
- Instalação indicada: `pip install -e ".[dev,forja]"`. O extra `forja` traz o `jsonschema`.
- Sem commit e sem push, aguardando a revisão do autor.
