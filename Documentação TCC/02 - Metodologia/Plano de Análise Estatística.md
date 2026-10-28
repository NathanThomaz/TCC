---
tipo: metodologia
fonte: docs/protocolo-experimental.md §9; src/tcc_exp/analise/estatistica.py; src/tcc_exp/analise/pipeline.py
atualizado: 2026-10-28
tags: [tcc, metodologia, estatistica]
---

# Plano de Análise Estatística

Fonte: [protocolo §9](https://github.com/NathanThomaz/TCC/blob/main/docs/protocolo-experimental.md) · código: `src/tcc_exp/analise/estatistica.py`, `pipeline.py`

## Passos
1. `exp processar` → `data/processed/<fase>/execucoes.csv` (métricas por execução) + `integridade.json`.
2. **Elegibilidade:** excluir abortadas, com cadeia de eventos violada ou fora do plano. **Todas as exclusões listadas** no relatório.
3. **Descritivas por condição:** n, média, DP, mediana, quartis, mín., máx.
4. **Inferência (H1–H3):**
   - diferença pareada **B − A** (em log para o tempo);
   - estimador de **Hodges-Lehmann**;
   - **IC 95% por bootstrap** da mediana (10.000 reamostragens, semente fixa 20261027);
   - **teste de randomização exato por inversão de sinais** — válido pelo próprio desenho: sob H0 estrita, trocar rótulos dentro do par só inverte o sinal de B − A. Estatística: |média das diferenças|; exato (todas as 2ⁿ inversões) até um limite de pares, Monte Carlo com 100.000 sorteios acima dele;
   - **Wilcoxon pareado** como verificação;
   - **correção de Holm** sobre H1–H3.
5. **Censura:** análise principal → não aceita recebe t_aceite = tempo-limite. Sensibilidade → excluir pares com censura.
6. **H4:** mediana das diferenças por tipo; **só descritiva**.
7. **Secundárias:** mesmo procedimento, sem correção, rotuladas como exploratórias.
8. **Interpretação:** "não significativo" ≠ "sem efeito". O texto prioriza estimativas e intervalos.
9. **Discrepantes:** investigados com notas e transcrições, **não removidos**; com justificativa de protocolo, análise com e sem.

## Por que teste de randomização, e não teste t
Com N-de-1 e poucos pares, não há base para supor normalidade. O teste de randomização deriva a distribuição nula do **próprio sorteio** feito no desenho (Edgington & Onghena — **[VERIFICAR]**, ainda não verificado na bibliografia). É uma das perguntas prováveis da banca ([[Roteiro da Defesa]]).

## Saídas
- `exp analisar` → `reports/<fase>/` (tabelas, figuras PNG, `relatorio-experimento.md`). O relatório **não interpreta**; a interpretação vai para o texto do TCC.
- `exp dashboard` → `reports/<fase>/dashboard.html`. Ver [[Dados, Pipeline e Dashboard]].

Relacionadas: [[Hipóteses e Variáveis]] · [[Análise de Poder]] · [[Métricas]]
