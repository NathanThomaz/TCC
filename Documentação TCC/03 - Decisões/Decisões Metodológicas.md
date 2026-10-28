---
tipo: decisoes
fonte: docs/decisoes-metodologicas.md
atualizado: 2026-10-28
tags: [tcc, decisoes]
---

# Decisões Metodológicas (D0–D11)

Fonte: [decisoes-metodologicas.md](https://github.com/NathanThomaz/TCC/blob/main/docs/decisoes-metodologicas.md)

Status possíveis: `PENDENTE` · `ADOTADA-PROVISÓRIA` (em uso, aguardando orientador) · `APROVADA` · `REVISADA` (substituída; o texto anterior nunca é apagado). **Todas as provisórias precisam ser confirmadas com o orientador antes do congelamento (E5).**

## Painel

| ID | Assunto | Status | O que falta |
|---|---|---|---|
| D0 | Tema e pergunta | 🟡 provisória | Orientador |
| D1 | Desenho N-de-1 | 🟡 provisória | Orientador |
| **D2** | Perfil do executor | 🔴 **PENDENTE** | Preencher [[Perfil do Executor]] |
| **D3** | Ferramenta de IA (B) | 🟡 provisória (Copilot) | **Modelo, versão, plano, créditos** |
| D4 | Autoria das tarefas | 🟡 provisória | Terceiro para as principais |
| D5 | Recursos permitidos | 🟡 provisória | Orientador |
| D6 | Gravação de tela | 🟡 provisória | Orientador |
| **D7** | Informações institucionais | 🔴 **PENDENTE** | Prazo, manual, orientador, CEP |
| D8 | Repositório público | ⚪ registrada | — |
| D9 | Piloto com 4 tipos | 🟡 provisória | Avaliar P4 no piloto |
| D10 | Medidas de percepção | 🟡 provisória | — |
| D11 | Dashboard e demo sintética | ⚪ registrada | — |

---

## Bloco de 27/10/2026 — Montagem do projeto

### D0. Tema e pergunta de pesquisa
**ADOTADA-PROVISÓRIA.** Tema confirmado pelo autor; pergunta = versão delimitada (plano §2); título provisório refinado. → [[Tema, Pergunta e Objetivos]]

### D1. Desenho experimental
**ADOTADA-PROVISÓRIA.** Caso único randomizado (N-de-1), pares de gêmeas, randomização da gêmea e da ordem, teste de randomização. Replicação com colegas = extensão opcional. → [[Desenho Experimental]]

### D2. Perfil do executor
**PENDENTE (informação).** O autor executará as tarefas (inferido, **a confirmar**). Falta registrar experiência com Python, SQL e IA. *(O registro diz que o formulário seria criado depois; ele já existe, vazio — ver [[Inconsistências do Repositório]].)* → [[Perfil do Executor]]

### D3. Ferramenta de IA da condição B
**ADOTADA-PROVISÓRIA** (documentada como 28/10/2026).
- **Escolha do executor:** GitHub Copilot no VS Code, `ide-chat`, uso livre de autocompletar, chat e modo agente.
- **Por quê:** validade ecológica; comparabilidade com a literatura (Peng 2023, Vaithilingam 2022, Mozannar 2024, Cui 2026); mesmo editor nas duas condições via perfis; exportação da sessão em JSON.
- **Restrições:** modelo fixo no seletor (**não "Auto", não Claude**); atualização automática da extensão desligada.
- **Pendências do executor:** (1) informar o plano que já possui; (2) preencher `modelo` e `versao_cliente`; (3) medir créditos e confirmar que 32 sessões cabem.
→ [[Ferramenta de IA - GitHub Copilot]]

### D4. Autoria das tarefas
**ADOTADA-PROVISÓRIA (com ajuste).**
- **Piloto:** tarefas escritas pelo Claude (assistente usado na elaboração), **públicas**. Aceitável: o piloto testa procedimento e não entra na análise.
- **Principal:** tarefas e ocultos **fora do repo**, não vistos pelo executor, com selo de hash.
- **Ajuste:** as principais usam uma **variante selada da aplicação-base**, porque a base pública contém o código correto (daria para resolver por comparação).
→ [[Tarefas Principais e Selagem]]

### D5. Recursos permitidos
**ADOTADA-PROVISÓRIA.** Lista em `experimento.toml` → `[recursos]`; checklist no [[Guia de Sessão]].
- Permitidos (A e B): docs oficiais do Python, do SQLite, do pandas (se usado), código e docs da aplicação-base.
- Proibidos em A: qualquer assistente de IA; buscadores com resposta gerada por IA; fóruns e sites de perguntas e respostas.

### D6. Gravação de tela
**ADOTADA-PROVISÓRIA.** Opcional, numa amostra de ~4 pares, só para análise qualitativa por fases. Não alimenta métrica primária.

### D7. Informações institucionais
**PENDENTE (informação).** Prazo, manual de TCC, orientador, exigência de CEP. `thesis/` segue esqueleto ABNT genérico até o manual chegar. Campos `instituicao` e `orientador` vazios em `experimento.toml`.

### D8. Repositório público no GitHub
**REGISTRADA.** `github.com/NathanThomaz/TCC` é público. Consequências: (1) tarefas principais e ocultos nunca vão para lá; (2) dados brutos e transcrições ficam públicos quando versionados — revisar antes de cada envio; (3) IA com busca web poderia achar o repo (não afeta as principais).

---

## Bloco de 28/10/2026 (segundo os documentos) — Ampliação do piloto e do instrumento

### D9. Piloto com os 4 tipos de tarefa
**ADOTADA-PROVISÓRIA.** P3 (T2) e P4 (T4) acrescentados → 4 pares / 8 execuções. Plano **re-sorteado** (semente 20261028 substitui 20261027) **antes** de qualquer execução (`data/raw/piloto` não existia).
**Ressalva:** em P4 as gêmeas alteram o mesmo módulo (`etl.py`), funções diferentes (`importar_produtos_csv` × `preco_br_para_centavos`). Critério "módulos diferentes" relaxado para T4. **Avaliar no piloto se resolver uma ajuda na outra.**

### D10. Medidas de percepção
**ADOTADA-PROVISÓRIA.** Confiança antes da 1ª entrega (`--confianca`, 1–5) e questionário pós-sessão (dificuldade, esforço mental, utilidade da IA). Secundárias e exploratórias. → [[Métricas]]

### D11. Dashboard e demonstração sintética
**REGISTRADA.** `exp dashboard` só com dados registrados. `exp demo-dashboard` usa dados sintéticos de **efeito nulo**, não pode gravar em `reports/` nem `data/`, e mostra faixa de aviso em tudo. → [[Dados, Pipeline e Dashboard]]

---

## Decisões futuras já previstas
- Nº final de pares (após recalcular o poder com o DP do piloto).
- Tempo-limite definitivo (calibrar no piloto).
- Upgrade do plano do Copilot, se 32 sessões não couberem (decidir **antes** do piloto).
- Aprovação de D0–D6, D9, D10 pelo orientador.

Relacionadas: [[Desvios do Protocolo]] · [[Backlog e Pendências]]
