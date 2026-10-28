---
tipo: experimento
fonte: experiment/randomization/plano-piloto.csv; src/tcc_exp/sorteio.py
semente_piloto: 20261028
atualizado: 2026-10-28
tags: [tcc, experimento, randomizacao]
---

# Plano de Randomização

Fonte: [plano-piloto.csv](https://github.com/NathanThomaz/TCC/blob/main/experiment/randomization/plano-piloto.csv) · código: `src/tcc_exp/sorteio.py`

## Como o sorteio funciona (`exp sortear --pares <toml> --semente <N>`)
1. Em cada par, sorteia qual gêmea é **B** (com IA) e qual é **A**.
2. Sorteia a ordem no par, com **exatamente metade** dos pares começando por B.
3. Sorteia a ordem dos pares, **evitando dois pares seguidos do mesmo tipo**.
4. Grava o CSV + `.sha256`. Versionar **antes** da 1ª sessão. Não refazer depois.

## Plano do piloto (semente 20261028)
SHA-256: `88443cddc56b115522720593a9a2dc72dbc52a3b065997833754f8038bca24e1`
(A semente 20261027 foi substituída em D9, antes de qualquer dado.)

| Posição | exec_id | Par | Tipo | Tarefa | Condição | Status |
|---|---|---|---|---|---|---|
| 1 | **X01** | P2 | T3 | P2b | **B** | ⛔ bloqueada (modelo do Copilot vazio) |
| 2 | X02 | P2 | T3 | P2a | A | ⏳ |
| 3 | X03 | P4 | T4 | P4a | B | ⏳ |
| 4 | X04 | P4 | T4 | P4b | A | ⏳ |
| 5 | X05 | P3 | T2 | P3a | A | ⏳ |
| 6 | X06 | P3 | T2 | P3b | B | ⏳ |
| 7 | X07 | P1 | T1 | P1b | A | ⏳ |
| 8 | X08 | P1 | T1 | P1a | B | ⏳ |

P2 e P4 começam por B; P3 e P1 começam por A (metade/metade). Executar **na ordem da coluna posição**.

> Atualize a coluna "Status" aqui à medida que as execuções forem feitas (✅ aceita / ⚠️ limite / ❌ rejeitada / 🚫 abortada) e crie uma nota por execução com o [[Modelo - Execução Experimental]].

## Plano principal
Ainda não existe. Será `experiment/randomization/plano-principal.csv` (+ `.sha256`), sorteado a partir de `pares-principal.toml` com semente escolhida antes e registrada no commit, e versionado antes da tag `protocolo-v1.0`.

Relacionadas: [[Tarefas do Piloto]] · [[Guia de Sessão]] · [[Desenho Experimental]]
