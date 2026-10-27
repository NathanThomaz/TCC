# Texto do TCC

A estrutura abaixo é um esqueleto ABNT genérico (NBR 14724 para trabalhos acadêmicos, NBR 6023 para referências, NBR 10520 para citações). **As edições vigentes das normas e o manual da instituição (D7) ainda precisam ser conferidos.** Quando o manual chegar, a estrutura será adaptada a ele.

## Estrutura

| Parte | Arquivo | Status | Pode ser escrito agora? |
|---|---|---|---|
| Elementos pré-textuais (capa, folha de rosto, resumo, abstract, listas) | — | ⏳ | Após o manual da instituição |
| 1 Introdução | [capitulos/01-introducao.md](capitulos/01-introducao.md) | Rascunho | Sim |
| 2 Fundamentação teórica | [capitulos/02-fundamentacao-teorica.md](capitulos/02-fundamentacao-teorica.md) | Rascunho parcial | Sim (depende das fichas da E2) |
| 3 Trabalhos relacionados | [capitulos/03-trabalhos-relacionados.md](capitulos/03-trabalhos-relacionados.md) | Rascunho parcial | Sim (depende das fichas da E2) |
| 4 Metodologia | [capitulos/04-metodologia.md](capitulos/04-metodologia.md) | Rascunho | Sim, no futuro do indicativo até a coleta |
| 5 Resultados | [capitulos/05-resultados.md](capitulos/05-resultados.md) | **Bloqueado** | **Não.** Só a partir de `reports/principal/` |
| 6 Discussão | [capitulos/06-discussao.md](capitulos/06-discussao.md) | **Bloqueado** | **Não** |
| 7 Conclusão | [capitulos/07-conclusao.md](capitulos/07-conclusao.md) | **Bloqueado** | **Não** |
| Referências | [referencias.md](referencias.md) | Parcial | Somente referências verificadas |
| Apêndices | — | ⏳ | Protocolo, enunciados das tarefas (após a coleta), instrumento |

## Regras de redação

1. Toda citação precisa ter ficha em `pesquisa/fichas/` (ou status V-meta, com a ressalva "segundo o resumo").
2. Marcadores no texto:
   - `[VERIFICAR]`: afirmação ou citação ainda não conferida no texto integral;
   - `[CITAÇÃO NECESSÁRIA]`: afirmação que precisa de fonte.

   Nenhum marcador pode sobrar na versão entregue.
3. Antes da coleta, a metodologia é escrita no futuro ("será executado"). Depois da coleta, passa ao passado, e cada desvio é relatado.
4. Números de resultados só podem vir de `reports/principal/`, citando a tabela ou figura de origem.
5. O uso de IA na elaboração está declarado em [../docs/uso-de-ia-no-tcc.md](../docs/uso-de-ia-no-tcc.md), conforme as regras da instituição.
