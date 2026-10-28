---
tipo: regras
fonte: README.md (Princípios de integridade); data/README.md; thesis/README.md; docs/uso-de-ia-no-tcc.md
atualizado: 2026-10-28
tags: [tcc, integridade, regras]
---

# Princípios de Integridade

Regras fixas do projeto. **Não se reabrem**, nem a pedido de "deixar tudo pronto".

## Resultados e dados
1. **Nenhum resultado é escrito antes da coleta.** Capítulos 5, 6 e 7 estão bloqueados e só podem usar `reports/principal/` (gerado por `exp processar && exp analisar`). Todo número no texto cita a tabela ou figura de origem.
2. **`data/raw` é somente-acréscimo**, com cadeia de hash verificável. Nunca editar à mão. Se a cadeia quebrar, a execução é excluída e a exclusão aparece no relatório.
3. **Dados sintéticos** existem só em `tests/fixtures/` e na demonstração (`exp demo-dashboard`, gravada fora do repo, ex.: `../tcc-demo`). Eles **não podem** gerar relatório em `reports/` nem ir para `data/`.
4. Métrica sem dado fica vazia (NaN). **Nunca** preencher com zero ou média.
5. Execuções abortadas ficam nos dados, marcadas, e são excluídas da análise **com listagem**. Casos discrepantes **não** são removidos.

## Tarefas
6. **Tarefas principais e testes ocultos nunca entram no repositório**, porque ele é **público** (D8).
7. **O executor não escreve, não lê e não revisa as tarefas principais** antes de executá-las. Um terceiro produz e sela. Ver [[Tarefas Principais e Selagem]].
8. Se for pedido "gere as tarefas principais" numa sessão em que o executor vê a saída, a resposta é: **outra pessoa precisa conduzir essa sessão**.
9. Nunca abrir o diretório `TCC_TAREFAS_DIR`.

## IA
10. **O instrumento não chama APIs de IA.** Ele só registra ferramenta, modelo e versão.
11. Nenhum dado experimental é produzido por IA.
12. Se a IA cair numa sessão B: abortar e remarcar. **Nunca** executar sem IA no lugar.
13. Na condição B, **não usar modelos Claude** (afinidade com o autor das tarefas-piloto e do instrumento).
14. O uso de IA na **elaboração** do TCC é declarado em [[Uso de IA no TCC]].

## Referências
15. Referências só entram no texto após verificação. Status em [[Referências Verificadas]]. Itens "NÃO verificado" não são citados. Nenhuma referência inventada.
16. Marcadores `[VERIFICAR]` e `[CITAÇÃO NECESSÁRIA]` não podem sobrar na versão entregue.

## Repositório público
17. Antes de cada commit de dados, conferir que não há dados pessoais nem segredos nos anexos.
18. `.env` nunca é versionado; nenhuma chave de API no repositório.

## Protocolo
19. Depois do congelamento (tag `protocolo-v1.0`), toda alteração vira entrada em [[Desvios do Protocolo]] e em [[Decisões Metodológicas]]. Decisão aprovada só muda com entrada `REVISADA`; o texto anterior não é apagado.
20. O plano de randomização não é refeito depois da 1ª sessão da fase.
