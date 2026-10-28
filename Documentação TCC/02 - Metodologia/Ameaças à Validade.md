---
tipo: metodologia
fonte: docs/plano-execucao.md §10; docs/ferramentas-ia.md §6
atualizado: 2026-10-28
tags: [tcc, metodologia, validade]
---

# Ameaças à Validade

Fontes: [plano-execucao.md §10](https://github.com/NathanThomaz/TCC/blob/main/docs/plano-execucao.md) · [ferramentas-ia.md §6](https://github.com/NathanThomaz/TCC/blob/main/docs/ferramentas-ia.md) · classificação de Wohlin et al. (2012). Serão consolidadas na seção 4.8 do capítulo de metodologia (ainda um marcador no rascunho).

## Gerais

| Ameaça | Tipo | Gravidade | Mitigação |
|---|---|---|---|
| n = 1 executor | Externa | Alta | Declarar e restringir conclusões; replicação opcional (D4 do plano) |
| Executor conhece tarefas ou testes | Interna | **Crítica** | Tarefas de terceiros, seladas, abertas só no `exp abrir` |
| Sem cegamento / expectativa | Interna | Alta | Desfechos automáticos; pré-registro |
| Aprendizagem ao longo da coleta | Interna | Média | Contrabalanceamento; covariável de posição |
| Gêmeas não equivalentes | Interna | Média | Pareamento por métricas; sorteio; checagem no piloto |
| Ocultos não representam "qualidade" | Constructo | Média | Múltiplos indicadores; ocultos derivados dos requisitos; severidade |
| Tarefas artificiais (sistema pequeno) | Externa | Média | Declarar; defeitos típicos |
| Modelo muda durante a coleta | Interna/Conclusão | Média | Fixar versão; registrar por sessão; coleta concentrada |
| Autor das tarefas é um modelo de IA (Claude) | Interna | Média | Revisão humana (orientador); condição B com outro fornecedor (Copilot, modelo não-Claude) |
| Baixo poder estatístico | Conclusão | Alta | Estimativas com IC; ver [[Análise de Poder]] |
| Escopo e prazo | Projeto | Média | Cortes: 3 tipos × 3 pares (9) como mínimo |

## Específicas da IA

| Ameaça | Efeito | Mitigação |
|---|---|---|
| Atualização silenciosa do modelo | Tratamento B muda | Modelo fixado; `--modelo` por sessão; coleta curta |
| Não determinismo | Variação entre execuções | Parte do tratamento; transcrições descrevem |
| Contaminação de treino | B inflado | Tarefas originais, seladas, fora do repo público |
| Afinidade autor–ferramenta | B inflado | Ferramenta de outro fornecedor ou declarar |
| Novidade/inexperiência | B reduzido | Prática ≥ 3 h |
| Conectividade | Abortos em B | Abortar e remarcar; abortos reportados |
| "IA vs. sem IA" confunde ferramenta e modalidade | Generalização indevida | Conclusões restritas à ferramenta e modalidade |

## Ameaças específicas desta configuração
- **P4 (piloto):** as gêmeas mexem no mesmo módulo `etl.py` (funções diferentes). Verificar no piloto se resolver uma ajuda na outra (D9).
- **Busca no GitHub:** o repo é público; ferramentas com busca web poderiam achá-lo. Não afeta as tarefas principais (não estão lá) — D8.

Relacionadas: [[Desenho Experimental]] · [[Ferramenta de IA - GitHub Copilot]]
