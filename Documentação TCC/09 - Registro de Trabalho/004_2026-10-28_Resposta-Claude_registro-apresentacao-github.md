---
tipo: resposta
autor: Claude
numero: "004"
data: 2026-10-28
assunto: "Registro de trabalho, ajuste da apresentação e envio ao GitHub"
pergunta: "[[004_2026-10-28_Pergunta-Nathan_registro-apresentacao-github]]"
tags: [tcc, registro, resposta]
---

# 004 · Resposta do Claude — Registro de trabalho, ajuste da apresentação e envio ao GitHub

**Pergunta:** [[004_2026-10-28_Pergunta-Nathan_registro-apresentacao-github]]
**1. Registro de trabalho.** Criei a pasta [docs/registro-de-trabalho/](docs/registro-de-trabalho/README.md), com um índice e uma entrada por interação: o que foi pedido, o que foi feito, a resposta com resultados reais, os arquivos e as pendências.
**2. Apresentação.** O arquivo único agora é `thesis/apresentacao/proposta-v2-forja.pptx`, com 22 slides.
**3. GitHub.**
**Pontos que dependem de você:**

## Resposta enviada (texto integral)

Os três pedidos estão feitos: o registro em `.md`, a apresentação ajustada e o envio ao GitHub.

**1. Registro de trabalho.** Criei a pasta [docs/registro-de-trabalho/](docs/registro-de-trabalho/README.md), com um índice e uma entrada por interação: o que foi pedido, o que foi feito, a resposta com resultados reais, os arquivos e as pendências.
- [001](docs/registro-de-trabalho/001-diagnostico-tecnico.md): diagnóstico técnico, que só existia no chat.
- [002](docs/registro-de-trabalho/002-plano-marco-1.md): plano do Marco 1 e a sua aprovação (P1 a P9).
- [003](docs/registro-de-trabalho/003-marco-1-etapa-1.md): o retorno da etapa 1.
- [004](docs/registro-de-trabalho/004-registro-apresentacao-github.md): esta interação.

Daqui em diante, cada interação ganha uma entrada nova. Guardei essa regra na memória.

**2. Apresentação.** O arquivo único agora é `thesis/apresentacao/proposta-v2-forja.pptx`, com 22 slides.
- Removi o slide "Próximos passos". A apresentação termina em "Riscos e mitigação".
- **Fiz um ajuste a mais, sem você pedir:** o slide 11 mostrava a regra no formato antigo do contrato (v0.1), que deixou de valer na etapa 1. Atualizei para a v0.2, e o selo agora diz "21 mapas com erro de forma são recusados".
- O arquivo passou na validação, e conferi os slides 11 e 22 como imagens geradas pelo PowerPoint.

**3. GitHub.**
- Enviei para uma **branch nova, `forja-marco-1`**. A `main` não foi alterada.
- Antes de subir:
  - o `.gitignore` passou a ignorar os arquivos temporários do Office (`~$…`) e o estado local do Obsidian;
  - procurei dados sensíveis e só achei falsos positivos ("senha" dentro de "desenha");
  - **os 72 testes passaram**.

| Commit | Conteúdo |
|---|---|
| `9d8acb5` | Vault do Obsidian + `.gitignore` |
| `3eb4c0a` | Proposta v2 (Forja) + apresentação |
| `3b3fd30` | Marco 1, etapa 1: contrato v0.2 + testes |
| `7689514` | Registro de trabalho 001–004 + vault atualizado |

**Pontos que dependem de você:**
- **A `rev3` antiga** (`proposta-v2-forja-rev3.pptx`) estava aberta no seu PowerPoint, então não foi enviada nem apagada. Ela está obsoleta: depois de fechar o PowerPoint, pode excluir (ou me peça).
- **Juntar a branch à `main`:** posso abrir um pull request ou fazer o merge. Ou você abre por aqui: https://github.com/NathanThomaz/TCC/pull/new/forja-marco-1
- **O repositório é público.** O vault mostra caminhos da sua máquina e a configuração do computador (placa de vídeo e memória). Não é segredo, mas fica visível.
- **A Etapa 2 do Marco 1** (validador semântico) aguarda o seu "ok".

> **Nota de controle (entrada 008):** os links acima usavam os nomes antigos dos arquivos (`001-diagnostico-tecnico.md` etc.). Os arquivos foram renomeados para o padrão `NNN_AAAA-MM-DD_assunto.md`; veja o índice.

---

## Registro técnico
- **Apresentação:**
  - o último slide ("Próximos passos") foi removido: tinha 23 slides, ficou com 22;
  - o slide 11 foi alinhado ao contrato v0.2;
  - validação: `All validations PASSED!`;
  - os slides 11 e 22 foram exportados como PNG pelo PowerPoint e conferidos.
- **`.gitignore`:** acrescentados `~$*`, `Documentação TCC/.obsidian/workspace*.json` e `Documentação TCC/.trash/`.
- **Antes do envio:** busca por dados sensíveis (só falsos positivos) e `python -m pytest -q -p no:cacheprovider` → **72 passed** em 27,27 s.
- **Git:**
  - `git checkout -b forja-marco-1`;
  - 4 commits (tabela acima);
  - `git push -u origin forja-marco-1` → `* [new branch] forja-marco-1 -> forja-marco-1`.
- **Não enviado:** `proposta-v2-forja-rev3.pptx` (aberto no PowerPoint, obsoleto).
- **Pendências:**
  - merge ou PR da `forja-marco-1`;
  - apagar a `rev3` local;
  - Etapa 2.
