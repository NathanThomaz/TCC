# Roteiro da apresentação de defesa

Previsão: ~20 minutos, 14 slides. Os slides 1 a 8 já podem ser preparados. Os slides 9 a 12 usam **exclusivamente** as figuras e os números de `reports/principal/dashboard.html` (gerado por `exp dashboard`). Durante a defesa, o próprio dashboard pode ser aberto no navegador como material de apoio.

| # | Slide | Conteúdo | Fonte |
|---|---|---|---|
| 1 | Título | Título, autor, orientador, curso, data | `experimento.toml` → `[apresentacao]` |
| 2 | Motivação | Adoção de IA na programação; evidência contraditória: Peng et al. (2023) mostram 55,8% mais rápido, e Becker et al. (2025) mostram 19% mais lento | Cap. 1 |
| 3 | Problema e pergunta | "Rapidez ≠ produtividade": o retrabalho é um custo oculto; pergunta de pesquisa | Cap. 1 |
| 4 | Objetivos e hipóteses | Objetivo geral; H1–H3 (bilaterais), H4 exploratória | Cap. 1 |
| 5 | Trabalhos relacionados | Quadro comparativo e lacuna (ciclo entrega → avaliação oculta → retrabalho) | Cap. 3 |
| 6 | Desenho experimental | Diagrama: pares de gêmeas, sorteio da gêmea e da ordem, condições A/B | Cap. 4, dashboard → Apresentação |
| 7 | Tarefas e métricas | 4 tipos de tarefa (com exemplo do piloto); testes públicos × ocultos; definição de devolutiva e retrabalho | `docs/metricas.md` |
| 8 | Instrumento e integridade | CLI `exp`, eventos com cadeia de hash, selagem das tarefas, IA não chamada pelo instrumento, análise de poder | `docs/analise-poder.md` |
| 9 | Execução | Execuções concluídas/abortadas, desvios, ferramenta e modelo usados | Dashboard → Resumo/Dados |
| 10 | Resultados H1–H3 | Gráfico de efeitos (estimativa + IC 95%) e gráficos pareados | Dashboard → Resumo/Gráficos |
| 11 | Velocidade × qualidade | Dispersão tempo × ocultos; confiança declarada × resultado | Dashboard → Gráficos |
| 12 | H4 e aprendizagem | Barras por tipo; tempo por posição na sequência | Dashboard → Gráficos |
| 13 | Limitações | N = 1 executor, uma ferramenta, tarefas de pequeno porte, poder estatístico | Dashboard → Limitações |
| 14 | Conclusão e trabalhos futuros | Resposta restrita ao contexto; contribuições; replicações | Cap. 7 |

## Perguntas prováveis da banca (preparar respostas)

1. Por que um único executor? O resultado vale para quem?
2. Como você garante que não conhecia as tarefas principais?
3. As gêmeas têm mesmo a mesma dificuldade? Como isso foi tratado?
4. Por que um teste de randomização, e não um teste t?
5. O que significa um resultado não significativo com 12 pares?
6. A ferramenta de IA mudou durante a coleta? Como você sabe?
7. Por que medir o retrabalho após a devolutiva, e não apenas o tempo até a primeira solução?
8. Qual foi o papel da IA na elaboração do próprio TCC?
