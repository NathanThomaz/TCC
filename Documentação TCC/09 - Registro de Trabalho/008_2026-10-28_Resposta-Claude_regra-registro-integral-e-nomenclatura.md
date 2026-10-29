---
tipo: resposta
autor: Claude
numero: "008"
data: 2026-10-28
assunto: "Regra de registro integral e nova nomenclatura dos arquivos"
pergunta: "[[008_2026-10-28_Pergunta-Nathan_regra-registro-integral-e-nomenclatura]]"
tags: [tcc, registro, resposta]
---

# 008 · Resposta do Claude — Regra de registro integral e nova nomenclatura dos arquivos

**Pergunta:** [[008_2026-10-28_Pergunta-Nathan_regra-registro-integral-e-nomenclatura]]
**Nova nomenclatura dos arquivos** (`NNN_AAAA-MM-DD_assunto.md`):
**O que corrigi nas entradas antigas:**
**Duas ressalvas, para o controle ficar honesto:**
**O que continua igual:** nenhum commit foi feito. Seguem aguardando você:

## Resposta enviada (texto integral)

Feito. A partir de agora, **toda mensagem sua e toda resposta minha ficam gravadas em texto integral** no registro de trabalho. Guardei a regra na memória, então ela vale também nas próximas sessões, inclusive quando você pedir "não altere arquivos": o registro é a exceção.

**Nova nomenclatura dos arquivos** (`NNN_AAAA-MM-DD_assunto.md`):

| Antes | Agora |
|---|---|
| `001-diagnostico-tecnico.md` | `001_2026-10-28_diagnostico-tecnico-forja.md` |
| `002-plano-marco-1.md` | `002_2026-10-28_plano-marco-1.md` |
| `003-marco-1-etapa-1.md` | `003_2026-10-28_marco-1-etapa-1.md` |
| `004-registro-apresentacao-github.md` | `004_2026-10-28_registro-apresentacao-github.md` |
| `005-marco-1-etapa-2.md` | `005_2026-10-28_marco-1-etapa-2.md` |
| `006-diagnostico-proposta-nexo.md` | `006_2026-10-28_diagnostico-proposta-nexo.md` |
| — | `007_2026-10-28_conferencia-gravacao-diagnostico.md` (nova) |
| — | `008_2026-10-28_regra-registro-integral-e-nomenclatura.md` (nova, esta conversa) |

O número dá a ordem, a data mostra quando foi, e o assunto diz do que se trata. A regra está explicada no [índice](docs/registro-de-trabalho/README.md).

**O que corrigi nas entradas antigas:**
- As entradas 001 a 006 agora têm a **sua mensagem em texto integral** e a **minha resposta em texto integral**, seguidas do registro técnico (comandos, testes, arquivos).
- **007** registra a sua pergunta "Gravou isso no 005?" e a resposta, que antes não estavam gravadas.
- **008** registra esta mensagem e esta resposta.
- Atualizei os links do índice e do vault para os nomes novos, e acrescentei esta sessão no vault.

**Duas ressalvas, para o controle ficar honesto:**
- **002:** a resposta original (o plano completo) não foi gravada literalmente na época. O que ficou registrado é a versão em arquivo que você pediu em seguida, `docs/forja/plano-marco-1.md`, com o mesmo conteúdo técnico e explicações a mais. Deixei isso anotado na entrada.
- **006:** o texto da resposta é o enviado; a única diferença é de formatação (nível dos títulos).

**O que continua igual:** nenhum commit foi feito. Seguem aguardando você:
- a revisão da Etapa 2 (validador) para eu fazer o commit e o push;
- as decisões B1 a B12 do diagnóstico Nexo, para a Fase 2.

---

## Registro técnico
- **Memória:** `tcc-registro-de-trabalho.md` reescrita com a regra (pergunta e resposta integrais, sempre, inclusive em fases "sem alterar arquivos") e com a nomenclatura; índice da memória atualizado.
- **Renomeação:**
  - 001 a 004, que estavam no git: `git rm` dos nomes antigos e criação dos novos (ainda sem commit);
  - 005 e 006, fora do git: substituídos.
- **Conteúdo:**
  - 001, 003, 004 e 005: pergunta e resposta integrais + registro técnico;
  - 002: as duas mensagens integrais, com a resposta 1 apontando para `plano-marco-1.md`;
  - 006: pergunta integral (via arquivo auxiliar) + resposta integral;
  - 007 e 008: novas.
- **Índice (`README.md`):** regra, nomenclatura e as 8 entradas.
- **Vault:**
  - "Estado Atual - Retomada": regra nova e links atualizados;
  - "Registro de Sessões": links atualizados + sessão 13.
- **Verificação:**
  - as 8 entradas têm as seções "Pergunta (texto integral)" e "Resposta enviada" (a 002 tem duas de cada);
  - nomes antigos (`00N-assunto.md`) continuam apenas **dentro das respostas reproduzidas como foram enviadas** (004, 005 e 007), cada uma com uma nota de controle sobre a renomeação;
  - índice e vault apontam para os nomes novos.
- **Commit:** nenhum.
