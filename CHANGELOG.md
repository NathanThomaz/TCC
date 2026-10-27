# Changelog

## [0.2.0] — 2026-10-28

### Adicionado
- Tarefas-piloto P3a e P3b (T2, nova funcionalidade) e P4a e P4b (T4, robustez da importação). O piloto cobre os 4 tipos (8 tarefas, todas validadas). Plano do piloto sorteado de novo (semente 20261028), sem dados afetados.
- `exp dashboard`: dashboard HTML autocontido com apresentação, resumo, gráficos SVG interativos, análises, dados e limitações.
- `exp demo-dashboard`: demonstração com dados sintéticos de efeito nulo, bloqueada para `reports/` e `data/`.
- Confiança antes da entrega (`--confianca`) e questionário pós-sessão (`exp questionario`) como métricas secundárias.
- Análise de poder por simulação (`docs/analise-poder.md`), formulário de perfil do executor e roteiro da defesa.

### Corrigido
- A avaliação quebrava no Windows quando a saída do pytest tinha acentos (cp1252). Agora força UTF-8.
- O relatório quebrava quando os dados processados ficavam fora da raiz do projeto.

## [0.1.0] — 2026-10-27

### Adicionado
- Plano de execução v0.1 e registro de decisões (D0–D8). D1, D4, D5 e D6 foram adotadas provisoriamente.
- Protocolo experimental v0.9 (rascunho), matriz de métricas, guia de sessão e documento sobre ferramentas de IA.
- Instrumento `tcc_exp`:
  - CLI `exp`;
  - eventos JSONL com cadeia de hash;
  - máquina de estados da sessão;
  - workspaces versionados com git;
  - avaliação com testes ocultos;
  - devolutiva padronizada;
  - métricas;
  - sorteio;
  - selagem de tarefas;
  - pipeline de análise (teste de randomização, Hodges-Lehmann, bootstrap, Wilcoxon, Holm) e figuras.
- Aplicação-base `loja`, com 16 testes.
- Tarefas-piloto P1a, P1b (T1) e P2a, P2b (T3), validadas com `exp validar-tarefa`.
- Plano de randomização do piloto (semente 20261027).
- Testes do instrumento: 39 passando, incluindo os 16 da aplicação-base.
- Revisão bibliográfica preliminar: 15 referências com metadados verificados, `referencias.bib` e estratégia de busca.
- Rascunhos dos capítulos 1 a 4. Capítulos 5 a 7 bloqueados até a coleta.
