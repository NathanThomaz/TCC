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

### D3. Ferramenta de IA da condição B — PENDENTE
- O instrumento foi construído **independente de fornecedor**. Ele recusa execuções na condição B enquanto `experiment/config/experimento.toml` → `[ferramenta_ia]` estiver vazio.
- Critérios de escolha e opções: [ferramentas-ia.md](ferramentas-ia.md).

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
