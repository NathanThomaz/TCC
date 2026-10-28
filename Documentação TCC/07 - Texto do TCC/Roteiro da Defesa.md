---
tipo: texto
fonte: thesis/apresentacao/roteiro-defesa.md
atualizado: 2026-10-28
tags: [tcc, defesa]
---

# Roteiro da Defesa

Fonte: [roteiro-defesa.md](https://github.com/NathanThomaz/TCC/blob/main/thesis/apresentacao/roteiro-defesa.md)

~20 min, 14 slides. **Slides 1–8 podem ser preparados já.** Slides 9–12 usam **exclusivamente** figuras e números de `reports/principal/dashboard.html`. O dashboard pode ser aberto na defesa como apoio.

| # | Slide | Conteúdo | Fonte |
|---|---|---|---|
| 1 | Título | Título, autor, orientador, curso, data | `experimento.toml` → `[apresentacao]` |
| 2 | Motivação | Evidência contraditória: Peng +55,8% × Becker −19% | Cap. 1 |
| 3 | Problema e pergunta | Rapidez ≠ produtividade; retrabalho como custo oculto | Cap. 1 |
| 4 | Objetivos e hipóteses | Objetivo geral; H1–H3 bilaterais; H4 exploratória | Cap. 1 |
| 5 | Trabalhos relacionados | Quadro comparativo e lacuna | Cap. 3 |
| 6 | Desenho | Pares de gêmeas, sorteio da gêmea e da ordem, A/B | Cap. 4, dashboard |
| 7 | Tarefas e métricas | 4 tipos (exemplo do piloto); públicos × ocultos; devolutiva e retrabalho | [[Métricas]] |
| 8 | Instrumento e integridade | CLI, cadeia de hash, selagem, IA não chamada, poder | [[Análise de Poder]] |
| 9 | Execução | Concluídas/abortadas, desvios, ferramenta e modelo | Dashboard |
| 10 | Resultados H1–H3 | Efeitos + IC 95%, gráficos pareados | Dashboard |
| 11 | Velocidade × qualidade | Dispersão; confiança × resultado | Dashboard |
| 12 | H4 e aprendizagem | Por tipo; tempo por posição | Dashboard |
| 13 | Limitações | N=1, uma ferramenta, tarefas pequenas, poder | Dashboard |
| 14 | Conclusão | Resposta restrita ao contexto; contribuições; futuros | Cap. 7 |

## Perguntas prováveis da banca (preparar respostas)
1. Por que um único executor? O resultado vale para quem? → [[Desenho Experimental]]
2. Como garante que não conhecia as tarefas principais? → [[Tarefas Principais e Selagem]]
3. As gêmeas têm a mesma dificuldade? → sorteio da gêmea + `dificuldade_percebida`
4. Por que teste de randomização e não teste t? → [[Plano de Análise Estatística]]
5. O que significa não significativo com 12 pares? → [[Análise de Poder]]
6. A ferramenta de IA mudou durante a coleta? Como sabe? → `--modelo` por sessão, auto-update desligado
7. Por que medir retrabalho após a devolutiva? → [[Tema, Pergunta e Objetivos]]
8. Qual foi o papel da IA na elaboração do TCC? → [[Uso de IA no TCC]]
