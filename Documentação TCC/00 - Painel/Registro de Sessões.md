---
tipo: registro
atualizado: 2026-10-28
tags: [tcc, historico]
---

# Registro de Sessões

Histórico cronológico do trabalho no TCC (do mais antigo para o mais recente). Cada nova sessão entra no fim, usando o [[Modelo - Registro de Sessão]]. O estado vigente fica sempre em [[Estado Atual - Retomada]].

> **Sobre as datas:** os três commits do repositório estão carimbados em **27/10/2026 entre 00:45 e 01:37 (−03:00)**, mas parte dos documentos (CHANGELOG 0.2.0, D3, D9–D11) cita **28/10/2026**. Abaixo vale a data do commit; a divergência está em [[Inconsistências do Repositório]].

---

## Sessão 1 — 27/10/2026 · Montagem do projeto (v0.1.0)
**Commit:** `03d37b8` — "Estrutura completa do TCC: plano, protocolo, instrumento e piloto"
**Pedido do autor:** "monte tudo" a partir do tema e do título.
**Feito:**
- [[Plano de Execução]] v0.1 e [[Decisões Metodológicas]] D0–D8 (D1, D4, D5, D6 adotadas provisoriamente);
- [[Protocolo Experimental]] v0.9-rascunho, [[Métricas]], [[Guia de Sessão]], documento de ferramentas de IA;
- [[Instrumento tcc_exp]] (CLI `exp`, eventos com cadeia de hash, sessão, workspaces git, avaliação oculta, devolutiva, métricas, sorteio, selagem, análise estatística e figuras);
- [[Aplicação-base loja]] (16 testes) e tarefas-piloto P1a/P1b (T1) e P2a/P2b (T3);
- plano do piloto (semente 20261027 — depois substituída);
- 39 testes passando;
- revisão bibliográfica preliminar: 15 referências com metadados verificados, `referencias.bib`, estratégia de busca;
- rascunhos dos capítulos 1–4; 5–7 bloqueados;
- repositório publicado em github.com/NathanThomaz/TCC (público) — D8.

## Sessão 2 — 27/10/2026 (docs dizem 28/10) · Piloto completo e dashboard (v0.2.0)
**Commit:** `2e770ad` — "Piloto com 4 tipos de tarefa, dashboard final e insumos de processo"
**Pedido do autor:** "dashboard final com tudo pronto".
**Feito:**
- pares P3 (T2) e P4 (T4) → piloto com 4 pares / 8 tarefas, todas validadas (D9);
- plano do piloto **re-sorteado** (semente 20261028) antes de qualquer dado;
- `exp dashboard` e `exp demo-dashboard` (sintético, efeito nulo, gravado em `../tcc-demo`) — D11;
- confiança antes da entrega e questionário pós-sessão (D10);
- [[Análise de Poder]], formulário do [[Perfil do Executor]], [[Roteiro da Defesa]];
- correções: avaliação no Windows com acentos (UTF-8) e relatório com dados fora da raiz;
- 45 testes passando.
**Observação:** foi explicado ao autor que **resultados só existem após a coleta**; o dashboard de demonstração mostra apenas o formato.

## Sessão 3 — 27/10/2026 (docs dizem 28/10) · Escolha da ferramenta de IA (D3)
**Commit:** `d092da9` — "D3: GitHub Copilot no VS Code como ferramenta da condição B"
**Feito:**
- comparação Copilot × Cursor × Codex CLI × Gemini × Claude Code (seção 2.1 de `docs/ferramentas-ia.md`);
- D3 adotada provisoriamente: **GitHub Copilot no VS Code**, `ide-chat`, uso livre de autocompletar, chat e agente;
- `experimento.toml` preenchido com nome, fornecedor e modalidade; **modelo e versão ficaram vazios**;
- checklist de configuração e registro por sessão.
**Ficou pendente:** escolher o modelo, informar o plano, medir créditos.

## Sessão 4 — 28/10/2026 · Vault do Obsidian
**Pedido do autor:** documentar todo o repositório num vault do Obsidian, com o processo e o ponto de parada sempre guardados.
**Feito:**
- leitura completa do repositório (docs, pesquisa, tese, experimento, código);
- verificação: `pytest` → 45 passando; `exp verificar-ambiente` → condição B bloqueada (modelo vazio), ruff/radon não instalados; sem `.env`, sem `data/raw`, sem `reports/`;
- vault criado em `Documentação TCC/` com painel, retomada, notas por área e modelos;
- divergências entre documentos listadas em [[Inconsistências do Repositório]] (não corrigidas no repo).
**Nada foi alterado no código nem nos documentos do repositório.**
**Próximo passo:** terminar a configuração do Copilot (ver [[Estado Atual - Retomada]]). *(Suspenso na sessão 5.)*

## Sessão 5 — 28/10/2026 · Proposta de mudança de direção
**Pedido do autor:** entender o que falta e readaptar o projeto para "um sistema que cria outro sistema".
**Feito:**
- explicado o que falta no projeto atual;
- apresentadas três formas de readaptar:
  1. construir um gerador e avaliá-lo (Design Science, recomendada);
  2. experimento com sistemas inteiros, com e sem IA;
  3. híbrido das duas.
- listado o que se aproveita e o que muda.
- Alerta de integridade: a pergunta não pode partir da resposta ("a IA consegue sim"); ela precisa admitir resultado negativo.

**Nada foi alterado no repositório.**

**Pendente:** quatro decisões do autor:
- formato;
- tipo de sistema gerado;
- orçamento e fornecedor da API;
- aval do orientador e prazo.

## Sessão 6 — 28/10/2026 · Proposta v2 "Forja" e apresentação
**Pedido do autor:** sistema que cria sistemas, customizável (escolher o que melhorar), **sem nenhum custo**; primeiro um plano e um PowerPoint.

**Feito:**
- hardware verificado: RTX 3060 12 GB, 24 GB de RAM, i7-7700, 212 GB livres → IA local viável; Ollama não instalado;
- plano escrito: `docs/proposta-v2-gerador-de-sistemas.md`:
  - DSR + experimento;
  - 8 configurações de melhorias (M2–M4) × 10 especificações × 3 repetições;
  - custo zero;
  - cronograma F0–F9;
  - riscos;
  - reaproveitamento;
- apresentação: `thesis/apresentacao/proposta-v2-forja.pptx`:
  - 15 slides com notas do apresentador;
  - validada e conferida visualmente pelo PowerPoint;
- nota [[Proposta v2 - Forja]].

**Escolhas feitas por padrão (o autor pode mudar):**
- nome provisório "Forja";
- sistemas gerados = API REST com SQLite (Python + FastAPI);
- fatores = M2, M3, M4.

**Nada commitado.** `decisoes-metodologicas.md` não foi alterado (a proposta ainda não foi aprovada).

**Próximo passo:** aval do orientador + prazo.

## Sessão 7 — 28/10/2026 · Revisão 2 da proposta: foco em pequenos negócios
**Pedido do autor:**
- a Forja roda local em qualquer máquina;
- atende pequenas empresas, para que não dependam de contratar alguém;
- o sistema principal deve ser completo (mapeamento, regras definidas pelo usuário, relacionamentos, modelos, documentação, layout final);
- o TCC deve resolver uma necessidade com tecnologia.

**Feito:**
- `docs/proposta-v2-gerador-de-sistemas.md` reescrito (revisão 2):
  - necessidade;
  - 7 etapas;
  - arquitetura "mapa do sistema + motor por templates";
  - requisitos "qualquer máquina" (modo guiado sem IA);
  - DSR com avaliação técnica (IA × guiado, cenários selados) + estudo com usuários (CEP);
  - escopo;
  - cronograma F0–F10;
- `thesis/apresentacao/proposta-v2-forja.pptx` refeito: 19 slides com notas, validado e conferido visualmente;
- nota [[Proposta v2 - Forja]] reescrita.

**Escolhas feitas por padrão:**
- persona ilustrativa "Ana, padaria";
- meta de hardware de 16 GB de RAM (a medir);
- módulos e escopo da seção 6.

**Alertas dados ao autor:**
- a avaliação com usuários exige consulta ao CEP;
- dados do setor ainda não levantados (nenhum número citado).

**Nada commitado.**

## Sessão 8 — 28/10/2026 · Revisão 3: quatro ajustes de revisão crítica
**Entrada:** texto colado com quatro recomendações:
1. contrato formal do mapa;
2. separar personalização de geração livre;
3. comprovar o modo offline;
4. isolar o efeito da IA.

**Feito:**
- `docs/forja/mapa-do-sistema.schema.json`: contrato v0.1 (JSON Schema 2020-12), com perfis, permissões e testes de aceitação;
- `docs/forja/exemplo-padaria.mapa.json`: mapa completo de desenvolvimento;
- **validado:** o exemplo passa e 8 mapas errados são recusados (jsonschema 4.24);
- `docs/forja/README.md`: seções, matriz de suporte do MVP, o que o schema não cobre (validação semântica) e questões em aberto;
- proposta → revisão 3:
  - §3: a IA só nas etapas 1–3;
  - §4.0: contrato;
  - §4.3: matriz;
  - §4.4: portão offline G1;
  - §5.1: tabela de isolamento;
  - F2 inclui o portão;
  - D15–D17;
- apresentação refeita com 23 slides (novos: contrato, prova offline, matriz, isolamento):
  - validada e conferida;
  - salva como `thesis/apresentacao/proposta-v2-forja-rev3.pptx`, porque a antiga estava aberta no PowerPoint.

**Verificado:** Windows Sandbox não ativado (precisa de admin); hipervisor presente.

**Questões em aberto do contrato:**
- evento "confirmar" para mestre-detalhe;
- ações na edição;
- dados iniciais de campos calculados.

**Nada commitado.**

## Sessão 9 — 28/10/2026 · Diagnóstico técnico e plano do Marco 1
**Diagnóstico** (somente leitura, nada alterado):
- a Forja **não tem nenhum código**: existe só o contrato v0.1 (forma) + o exemplo escrito à mão;
- 45 testes do projeto antigo passaram (executados);
- o schema aceita referências inexistentes (verificado);
- `jsonschema` está fora do `pyproject.toml`;
- script dos slides fora do repo; arquivo de bloqueio `~$…pptx` sem regra no `.gitignore`.

**Marco 1 (pedido do autor):** contrato + validação semântica.

**Decisões confirmadas pelo autor:**
- venda começa como rascunho;
- estoque e financeiro só mudam ao concluir;
- venda concluída só se cancela, com estorno sem duplicidade;
- calculados não editáveis;
- preparação de testes explícita e isolada;
- sem `eval`;
- mesmo formato nos dois modos.

**Feito:** plano escrito em `docs/forja/plano-marco-1.md`, em linguagem explicativa, com glossário, a pedido do autor.

**Aguardando:** aprovação do plano e das pendências P1 a P9. **Nada implementado.**

## Sessão 10 — 28/10/2026 · Marco 1, etapa 1: contrato v0.2 + testes estruturais
**Aprovação:** plano do Marco 1 aprovado, com as recomendações P1 a P9 aceitas.

**Feito:**
- pacote novo `src/forja/` (isolado do `tcc_exp`);
- contrato v0.2 em `src/forja/contrato/mapa-do-sistema.schema.json`, lido com `importlib.resources`. Novidades:
  - ciclo de vida;
  - `origem` dos campos;
  - gatilhos por transição;
  - `para_cada`;
  - `preparacao`/`forcar`;
  - `permissoes_transicoes`;
  - `filtro` no relatório;
- exemplo da padaria migrado: rascunho → concluir → cancelar com estorno; 8 testes de aceitação;
- `pyproject.toml`: extra `forja` (jsonschema) + dados de pacote;
- cópia antiga do schema em `docs/` removida.

**Testes executados:**
- `tests/forja`: 27 passaram;
- suíte completa: 72 passaram;
- só os antigos: 45 passaram;
- projeto antigo sem alteração (`git status`).

**Instalação:** sem o pacote `wheel` não foi possível gerar o wheel. A prova foi feita com `build_py` + importação isolada: o contrato é encontrado fora do repositório.

**Próximo:** etapa 2 (validador semântico).

## Sessão 11 — 28/10/2026 · Registro de trabalho, apresentação e GitHub
**Feito:**
- criado `docs/registro-de-trabalho/` (entradas 001 a 004). De agora em diante, cada interação gera uma entrada;
- apresentação ajustada:
  - "Próximos passos" removido (22 slides);
  - slide 11 alinhado ao contrato v0.2;
- `.gitignore`: ignora `~$*` e o estado do Obsidian;
- testes: 72 passaram;
- push da branch `forja-marco-1`, com 4 commits.

Detalhes em [[004_2026-10-28_Resposta-Claude_registro-apresentacao-github]].

## Sessão 12 — 28/10/2026 · Marco 1, etapa 2: validador semântico
**Feito:**
- `erros.py` (catálogo de 48 códigos);
- `caminhos.py`;
- `estrutural.py`;
- `semantica.py`;
- `validacao.py`;
- `__main__.py`.

**Testes:**
- 111 da Forja passando;
- 156 na suíte completa;
- 45 antigos intactos;
- o teste de mutação confirmou que os testes pegam falhas.

**Sem commit:** aguardando revisão do autor. Detalhes em [[005_2026-10-28_Resposta-Claude_marco-1-etapa-2]].

## Sessão 13 — 28/10/2026 · Diagnóstico Nexo e nova regra do registro
**Diagnóstico Nexo (Fase 1):** proposta e apresentação lidas; diagnóstico com 8 seções e decisões B1 a B12, aguardando aprovação.

**Regra nova do autor:** SEMPRE gravar a pergunta e a resposta, em texto integral.

**Feito:**
- arquivos do registro renomeados para `NNN_AAAA-MM-DD_assunto.md`;
- entradas 001 a 006 reescritas com a pergunta e a resposta integrais;
- criadas as entradas 007 (conferência) e 008 (regra e nomenclatura);
- índice atualizado.

**Sem commit.**

## Sessão 14 — 28/10/2026 · Registro separado por autor e movido para o vault
**Pedido:** saber pelo nome do arquivo o que é pergunta de Nathan e o que é resposta do Claude, e manter o registro no vault, sem documentação espalhada.

**Feito:**
- cada entrada foi dividida em dois arquivos, `…_Pergunta-Nathan_…` e `…_Resposta-Claude_…`, ligados entre si;
- pasta nova `09 - Registro de Trabalho/`, com o índice [[000 - Índice do Registro de Trabalho]];
- a antiga `docs/registro-de-trabalho/` foi removida (conteúdo conferido: nenhum bloco de texto perdido);
- a entrada 002 virou 002-1 e 002-2 (duas mensagens).

**Sem commit.**

## Sessão 15 — 28/10/2026 · Documentação reunida no vault
**Feito:**
- `docs/forja/README.md`, `validacao.md` e `plano-marco-1.md` → `10 - Nexo - Contrato e Validação/` ("Contrato do Mapa do Sistema", "Validação do Mapa", "Plano do Marco 1");
- `docs/proposta-v2-gerador-de-sistemas.md` → `01 - Projeto/Proposta v2 - Documento Completo.md`;
- exemplo da padaria → `tests/forja/dados/`;
- links internos corrigidos.

**Mantidos em `docs/`:** os documentos do projeto antigo, citados pelo código do `tcc_exp`, que precisa ficar intacto.

**Testes:** 111 da Forja e 156 na suíte completa, passando.

**Sem commit.**


## Sessão 16 — 28/10/2026 · Nova apresentação do Nexo
**Pedido:** gerar a nova apresentação, completa e corrigida, para apresentar o projeto.

**Feito:**
- `thesis/apresentacao/proposta-nexo.pptx`, com 19 slides, notas do apresentador e etiquetas de status (hipótese, implementado, planejado, futuro);
- segue a estrutura do diagnóstico 006 e assume as recomendações B1, B2, B3, B6, B7, B8 e B9;
- o slide 10 mostra a saída real do validador para um erro de digitação proposital no mapa da padaria;
- validado e conferido slide a slide.

**Pendente:** proposta escrita (Fase 2), `roteiro-defesa.md`, decisões B1 a B12 formais.

**Registro:** [[011_2026-10-28_Resposta-Claude_novo-ppt-nexo]]. **Sem commit.**

## Sessão 17 — 28/10/2026 · Apresentação simplificada
**Pedido:** começo menos complexo; perguntas curtas e respostas rápidas; sem "híbrido"; foco em causa e solução; afirmar que os dados já foram levantados e que o motor está em desenvolvimento.

**Feito:**
- `thesis/apresentacao/proposta-nexo-v2.pptx`, com 15 slides em formato pergunta → resposta;
- a `proposta-nexo.pptx` estava aberta no PowerPoint e não foi substituída.

**Não feito, por integridade:**
- não foi escrito que os dados de pequenas empresas já foram levantados, porque não há registro de consulta; foram pedidos os dados reais;
- o motor aparece como "em desenvolvimento, núcleo pronto", sem afirmar IA ou geração já existentes.

**Registro:** [[012_2026-10-28_Resposta-Claude_ppt-simplificado]]. **Sem commit.**

## Sessão 18 — 28/10/2026 · Fluxo da padaria na apresentação
**Pedido:** mostrar como o fluxo vai funcionar (troca de mensagens, atender, transformar, criar, disponibilizar) com o exemplo da padaria; refazer a tela 10.

**Feito:**
- `proposta-nexo.pptx` com 19 slides: visão das 4 etapas, a conversa da Ana, fala → mapa (validação real: 0 erros), erro real do validador, tela ilustrativa do sistema, disponibilização;
- avaliação refeita como diagrama;
- `-v2` removida (versão única).

**Registro:** [[013_2026-10-28_Resposta-Claude_fluxo-padaria-no-ppt]]. **Sem commit.**

## Sessão 19 — 28/10/2026 · Tema na capa e prazo de 20/11
**Feito:**
- capa com o tema oficial em destaque;
- cronograma por datas (28/10 a 20/11), com linha de entrega final.

**Prazo final informado pelo autor:** 20/11/2026.

**Registro:** [[014_2026-10-28_Resposta-Claude_tema-na-capa-e-prazo]]. **Sem commit.**

## Sessão 20 — 28/10/2026 · Capa mais limpa
**Feito:** a capa foi refeita em três níveis: o tema (grande), o Nexo com o slogan, e o rodapé com os dados do autor. Saiu a faixa laranja.

**Registro:** [[015_2026-10-28_Resposta-Claude_capa-mais-limpa]]. **Sem commit.**

## Sessão 21 — 29/10/2026 · Commit das alterações
**Feito:**
- testes antes do commit: 156 passaram;
- commit na `forja-marco-1` com o validador (Marco 1, etapa 2), a apresentação `proposta-nexo.pptx`, o vault e o registro de 001 a 016;
- a `proposta-v2-forja-rev3.pptx` ficou fora (obsoleta).

**Sem push.**

**Registro:** [[016_2026-10-29_Resposta-Claude_commit-das-alteracoes]].

## Sessão 22 — 29/10/2026 · Limpeza e push
**Feito:**
- apagada a `proposta-v2-forja-rev3.pptx` (obsoleta);
- push da `forja-marco-1` para o GitHub.

A `main` não mudou.

**Registro:** [[017_2026-10-29_Resposta-Claude_limpeza-e-push]].
