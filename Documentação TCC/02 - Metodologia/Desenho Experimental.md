---
tipo: metodologia
status: adotada-provisoria
decisao: D1
fonte: docs/plano-execucao.md §5; thesis/capitulos/04-metodologia.md §4.2
atualizado: 2026-10-28
tags: [tcc, metodologia, desenho]
---

# Desenho Experimental — caso único randomizado (N-de-1)

Fonte: [plano-execucao.md §5](https://github.com/NathanThomaz/TCC/blob/main/docs/plano-execucao.md) · Decisão [[Decisões Metodológicas#D1. Desenho experimental|D1]] (provisória)

## Desenhos comparados

| Desenho | Ideia | Viabilidade | Situação |
|---|---|---|---|
| **D1. N-de-1 randomizado** | O mesmo executor faz N pares de gêmeas; sorteio define qual gêmea é com IA e a ordem | **Alta** | **Escolhido** |
| D2. Crossover com 6–12 colegas | Cada um faz um par A/B | Média/baixa (CEP, recrutamento) | — |
| D3. Entre grupos | Grupo com IA × sem IA | Baixa (precisa de muita gente) | Inviável |
| D4. Híbrido (D1 + 2–4 colegas) | Replicação pequena, só descritiva | Média | **Extensão opcional** |
| D5. Só IA em benchmark | pass@k sem humanos | — | Descartado (não mede processo humano) |

**Por que D1:** o foco é o processo e a qualidade da entrega, não a variação entre pessoas; controle total; randomização real; precedente em Becker et al. (2025) — randomização por tarefa, mesmo desenvolvedor nas duas condições. **Limitação:** não generaliza para outros desenvolvedores (declarado no título e nas ameaças).

## Estrutura

- **Unidade experimental:** a execução de uma tarefa (tarefa × condição).
- **Bloco:** par de tarefas gêmeas (Tka, Tkb): mesmo tipo, tamanho e nº de critérios, mas **defeito/funcionalidade e módulo diferentes**.
- **Randomização** (semente registrada, antes da coleta):
  1. em cada par, sortear qual gêmea recebe IA;
  2. sortear a ordem no par, com **metade** dos pares começando por B;
  3. sortear a ordem dos pares, **intercalando tipos** (nunca dois pares seguidos do mesmo tipo);
  4. versionar plano + hash **antes** da 1ª sessão.
- **Tamanho:** 4 tipos × 3 pares = **12 pares, 24 execuções** (+ 1 par reserva por tipo). Mínimo aceitável: 9 pares. Com 12 pares: 2¹² = 4.096 permutações. Só efeitos **grandes** são detectáveis → ver [[Análise de Poder]].
- **Tempo-limite:** 90 min ativos [calibrar no piloto]. Atingiu → execução **censurada** (não excluída), qualidade medida no estado em que estiver.
- **Conclusão da tarefa:** testes públicos passam e o executor entrega; a entrega é avaliada pelos **ocultos**.
- **Ciclo de devolutiva:** após cada entrega, ocultos rodam; falhas → relatório padronizado (nome do cenário e comportamento esperado, sem mostrar o teste) → correção → reenvio. Para em 100% dos ocultos, após **2 rodadas de correção**, ou no tempo-limite.

## Controle de contaminação e vieses

| Problema | Estratégia |
|---|---|
| Aprendizagem | Contrabalanceamento, posição como covariável, tipos intercalados, familiarização antes da coleta |
| Familiaridade com a tarefa | Executor **não** escreve tarefas nem testes ocultos (D4) |
| Gêmeas desiguais | Pareamento por métricas da referência + sorteio da gêmea com IA |
| Uma gêmea "entrega" a outra | Defeitos e módulos distintos; checar no piloto |
| Experiência com a ferramenta | Perfil registrado; prática ≥ 3 h antes |
| Variação do modelo | Ferramenta e modelo fixos; versão registrada por sessão; transcrições |
| Documentação consultada | Mesma lista nas duas condições; em A, nada de IA nem buscador com resposta de IA (D5) |
| Contaminação entre condições | Perfis de editor separados (TCC-A / TCC-B) |
| IA com acesso ao gabarito | Ocultos e referências fora do workspace; agentes só no workspace |
| Expectativa (sem cegamento) | Desfechos automáticos; pré-registro; severidade definida a priori |
| Reatividade | Rotina idêntica nas duas condições; sessões de prática |

Relacionadas: [[Protocolo Experimental]] · [[Plano de Randomização]] · [[Ameaças à Validade]]
