---
tipo: gestao
atualizado: 2026-10-28
tags: [tcc, gestao, revisao]
---

# Inconsistências do Repositório

Divergências encontradas na leitura completa de 28/10/2026. **Nenhuma foi corrigida no repositório** — o vault documenta o estado correto e esta lista diz o que ajustar. Marque ao corrigir.

## Desatualizações de texto
- [ ] **README.md — tabela de Status** diz "Decisões pendentes: executor (D2), ferramenta de IA (D3), instituição (D7)". A D3 já foi adotada (Copilot); só falta o modelo.
- [ ] **README.md — Estrutura** diz `tasks/piloto/  tarefas-piloto P1 e P2 (públicas)`. Hoje são P1–P4.
- [ ] **protocolo-experimental.md §7.3** diz "Piloto: pares P1 e P2". Hoje são P1–P4 (D9).
- [ ] **plano-execucao.md §6** diz "Piloto: 2 pares adicionais". Hoje são 4 (D9). *(O plano é histórico; basta uma nota de atualização apontando a D9.)*
- [ ] **decisoes-metodologicas.md D2** diz que `docs/perfil-executor.md` será criado "quando houver as respostas". O arquivo já existe (vazio).
- [ ] **gestao-projeto.md** tem "Atualizado em: 2026-10-27" mas contém itens de 28/10; o item "Instrumento mínimo" ainda cita 39 testes (hoje são 45).
- [ ] **uso-de-ia-no-tcc.md** só registra 27/10. Faltam a v0.2.0, a pesquisa da D3 e o vault.

## Versões e datas
- [ ] **pyproject.toml** `version = "0.1.0"`, mas o CHANGELOG está em **0.2.0**.
- [ ] **Datas:** os commits `2e770ad` (v0.2.0) e `d092da9` (D3) estão carimbados em **27/10/2026 01:26 e 01:37 (−03:00)**, mas CHANGELOG, D3, D9–D11, ferramentas-ia e gestão dizem **28/10/2026**. Decidir qual data vale e uniformizar (ou anotar que o registro foi feito na madrugada do dia 27).

## Metodológica (registrar como decisão)
- [ ] **P2 também viola "módulos diferentes":** P2a e P2b alteram o mesmo `loja/relatorios.py` (funções diferentes: vendas por categoria × produtos sem venda). A D9 registra a ressalva só para P4. Para T3 isso é estrutural (os relatórios ficam todos em `relatorios.py`), então convém registrar a mesma ressalva para T3 em `decisoes-metodologicas.md` e avaliar no piloto.

## Pontos de atenção (não são erros)
- O vault fica **dentro do repositório público** (`Documentação TCC/`). Se for commitado, vai para o GitHub. Ele só contém o que já está no repo, mas a pasta `.obsidian/workspace.json` muda a toda hora. Opções: commitar o vault e ignorar só `Documentação TCC/.obsidian/workspace*.json`, ou ignorar a pasta inteira no `.gitignore`.
- Os links internos deste vault apontam para notas; os links para arquivos do repo vão para o GitHub (branch `main`), então só refletem o que já foi enviado.

Relacionadas: [[Backlog e Pendências]] · [[Estado Atual - Retomada]]
