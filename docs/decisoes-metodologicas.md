# Registro de decisões metodológicas

Cada decisão tem um ID, um status, a data, as alternativas, a escolha e a justificativa. Os status possíveis são:
- `PENDENTE`: ainda não decidida;
- `ADOTADA-PROVISÓRIA`: em uso, aguardando validação do orientador;
- `APROVADA`: validada;
- `REVISADA`: substituída por uma decisão posterior.

Uma decisão aprovada só muda com uma nova entrada `REVISADA`, que explica o motivo. O texto anterior não é apagado.

---

## 2026-10-27 — Montagem do projeto

Contexto: o autor confirmou o tema e pediu a montagem completa do projeto com base no plano v0.1 ([plano-execucao.md](plano-execucao.md)). As recomendações do plano foram adotadas **provisoriamente**, para viabilizar a estrutura, o instrumento e o piloto. Todas precisam ser confirmadas com o orientador antes do congelamento do protocolo (Etapa 5).

### D0. Tema e pergunta de pesquisa — ADOTADA-PROVISÓRIA
- O tema foi confirmado pelo autor.
- Pergunta adotada: a versão delimitada da seção 2 do plano.
- Título provisório: o refinado na seção 2 do plano.

### D1. Desenho experimental — ADOTADA-PROVISÓRIA
- **Escolha:** caso único randomizado (N-de-1), com pares de tarefas gêmeas, randomização da gêmea e da ordem e teste de randomização.
- **Justificativa:** seção 5 do plano.
- **A confirmar:** a replicação com colegas (D4 do plano) fica como extensão opcional.

### D2. Perfil do executor — PENDENTE (informação)
- O autor executará as tarefas (inferido do contexto, **a confirmar**).
- Falta registrar a experiência com Python, SQL e ferramentas de IA, no formulário `docs/perfil-executor.md` (a criar quando houver as respostas).

### D3. Ferramenta de IA da condição B — ADOTADA-PROVISÓRIA (2026-10-28)
- **Escolha do executor:** GitHub Copilot no VS Code, modalidade `ide-chat`, com uso livre de autocompletar, chat e modo agente.
- **Justificativa:** validade ecológica (é a ferramenta que o executor usaria); maior comparabilidade com a literatura (Peng et al., 2023; Vaithilingam et al., 2022; Mozannar et al., 2024; Cui et al., 2026); mesmo editor nas duas condições, via perfis do VS Code; exportação da sessão em JSON. Comparação completa em [ferramentas-ia.md](ferramentas-ia.md), seção 2.1.
- **Restrições:** modelo fixo escolhido no seletor (não "Auto", **não Claude**, por causa da afinidade com o autor das tarefas); atualização automática da extensão desligada.
- **Pendências do executor:**
  1. informar qual plano/ferramenta paga já possui;
  2. preencher `modelo` e `versao_cliente`;
  3. medir o consumo de créditos na prática e confirmar que 32 sessões cabem no plano.

### D4. Autoria das tarefas — ADOTADA-PROVISÓRIA (com ajuste)
- **Piloto:** as tarefas P1a, P1b, P2a e P2b foram escritas pelo Claude (assistente de IA usado na elaboração do projeto) e estão **públicas** no repositório. Isso é aceitável porque o piloto testa o procedimento, e os dados do piloto não entram na análise principal.
- **Coleta principal:** as tarefas e os testes ocultos **não podem** ficar no repositório (que é público) nem ser vistos pelo executor. Elas serão produzidas fora do repositório, com hashes registrados (selo), conforme o procedimento em [../experiment/tasks/README.md](../experiment/tasks/README.md).
- **Ajuste decorrente:** as tarefas principais usarão uma **variante da aplicação-base** também selada. A aplicação-base pública contém a versão correta do código, então tarefas de correção de defeito feitas sobre ela poderiam ser resolvidas por comparação com o original.

### D5. Recursos permitidos — ADOTADA-PROVISÓRIA
- Lista em `experiment/config/experimento.toml` → `[recursos]`. O checklist está em [guia-sessao.md](guia-sessao.md).

### D6. Gravação de tela — ADOTADA-PROVISÓRIA
- Opcional, apenas em uma amostra de ~4 pares, para a análise qualitativa por fases. A gravação não é usada para nenhuma métrica primária.

### D7. Informações institucionais — PENDENTE (informação)
- Prazo, manual de TCC, orientador e exigência de CEP.
- A estrutura em `thesis/` segue um esqueleto ABNT genérico até o manual da instituição ser recebido.

### D8. Repositório público no GitHub — REGISTRADA
- O repositório `github.com/NathanThomaz/TCC` é **público**.
- **Consequências:**
  1. tarefas principais e testes ocultos nunca vão para lá;
  2. dados brutos e transcrições de IA ficarão públicos quando forem versionados. Revisar antes de cada envio para que não haja dados pessoais nem segredos;
  3. ferramentas de IA com busca web podem, em tese, encontrar o repositório. Isso não afeta as tarefas principais, porque elas não estão nele.

---

## 2026-10-28 — Ampliação do piloto e do instrumento

### D9. Piloto com os 4 tipos de tarefa — ADOTADA-PROVISÓRIA
- Foram acrescentados os pares P3 (T2, nova funcionalidade) e P4 (T4, robustez da importação). O piloto passa a ter 4 pares (8 execuções).
- O plano do piloto foi **sorteado de novo** (semente 20261028, substituindo a 20261027). Isso foi feito **antes** de qualquer execução: `data/raw/piloto` não existia, então nenhum dado foi afetado.
- **Ressalva:** em P4 as duas gêmeas alteram o mesmo módulo (`etl.py`), mas funções diferentes (`importar_produtos_csv` e `preco_br_para_centavos`). O critério "módulos diferentes" foi relaxado para T4 porque a rotina de importação é um único módulo. Avaliar no piloto se resolver uma gêmea ajuda na outra.

### D10. Medidas de percepção — ADOTADA-PROVISÓRIA
- Confiança declarada antes da 1ª entrega (`exp entregar --confianca`, 1–5) e questionário pós-sessão (`exp questionario`: dificuldade, esforço mental e utilidade da IA).
- Entram como métricas **secundárias e exploratórias**.

### D11. Dashboard e demonstração sintética — REGISTRADA
- `exp dashboard` gera `reports/<fase>/dashboard.html` somente a partir dos dados registrados.
- `exp demo-dashboard` usa dados sintéticos com **efeito nulo**, é proibido de gravar em `reports/` ou `data/` e exibe uma faixa de aviso em todas as visualizações.
