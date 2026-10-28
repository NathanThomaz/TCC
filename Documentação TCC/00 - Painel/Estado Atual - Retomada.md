---
tipo: retomada
atualizado: 2026-10-28
versao_projeto: 0.2.0
ultimo_commit: d092da9
tags: [tcc, retomada]
---

# Estado Atual — Retomada

**Última atualização:** 28/10/2026
**Versão do projeto:** 0.2.0 (CHANGELOG) · último commit `d092da9` (D3: Copilot)
**Fase:** E1 (planejamento) e E4 (piloto) em andamento. **Nenhum dado experimental coletado.**
**Ambiente:** Windows 11 · Python 3.11.9 · git · PowerShell/Git Bash

> Histórico: [[Registro de Sessões]] · Pendências completas: [[Backlog e Pendências]] · Etapas: [[Etapas do Projeto]]

## ⏸️ PONTO DE PARADA — 28/10/2026

> [!warning] Nova direção proposta: Forja (28/10/2026, revisão 2)
> O TCC agora resolve uma necessidade: **pequenos negócios** criarem o **próprio sistema de controle**, sem programar, sem custo e no computador da loja.
> A Forja é completa: 7 etapas (mapeamento → regras do usuário → entidades e relacionamentos → modelos → documentação → layout final → entrega). A arquitetura é "a IA entende, o motor garante".
> **Proposta (revisão 3) e apresentação (23 slides, `proposta-v2-forja-rev3.pptx`) prontas**, aguardando o orientador. Ver [[Proposta v2 - Forja]].
> A revisão 3 trouxe:
> - contrato formal do mapa (JSON Schema validado, em `docs/forja/`);
> - matriz de suporte;
> - portão offline G1;
> - isolamento do efeito da IA.
>
> **Pendência de arquivo:** substituir `proposta-v2-forja.pptx` (19 slides, antiga) pela rev3 quando o PowerPoint for fechado.
>
> **Marco 1 (contrato + validação semântica):** plano **aprovado** (P1 a P9 aceitas). Implementação por etapas:
> - **Etapa 1 concluída:**
>   - contrato v0.2 em `src/forja/contrato/`;
>   - exemplo da padaria migrado;
>   - 27 testes estruturais em `tests/forja/`;
>   - suíte completa com 72 testes passando.
> - **Próximo:** etapa 2 (validador semântico + códigos de erro), aguardando o "ok" do autor.
>
> **GitHub (28/10):** tudo enviado na branch **`forja-marco-1`** (a `main` não foi alterada); merge ou PR a decidir.
> **Apresentação:** versão única `proposta-v2-forja.pptx`, com 22 slides e sem "Próximos passos". A `rev3` local está obsoleta.
> **Registro de trabalho:** `docs/registro-de-trabalho/` guarda cada pedido, o que foi feito e a resposta (001–004). **Manter uma entrada por interação.**
> O plano v0.1 está **suspenso**. **Não configurar o Copilot nem rodar o piloto N-de-1.**
> **Próximo passo:** levar `docs/proposta-v2-gerador-de-sistemas.md` e `thesis/apresentacao/proposta-v2-forja.pptx` ao orientador e descobrir o prazo. Nada de código da Forja antes do aval.
> *O que vem abaixo descreve o estado do plano v0.1, que continua no repositório.*

### Onde paramos
- **Estrutura completa no GitHub** (repo público): plano, protocolo v0.9-rascunho, métricas, instrumento `exp`, aplicação-base `loja`, 8 tarefas-piloto (P1–P4, um par por tipo T1–T4), plano do piloto sorteado (semente 20261028), dashboard e análise de poder.
- **Verificado em 28/10/2026:**
  - `python -m pytest` → **45 testes passando**;
  - `exp verificar-ambiente` → fase `piloto`, tarefas e plano ok; **ruff e radon não instalados**; **"Ferramenta de IA não configurada (campos vazios: modelo)"** → a condição B está bloqueada;
  - não existe `.env` (o padrão `TCC_FASE=piloto` está valendo);
  - não existem `data/raw/` nem `reports/` (nenhuma sessão feita);
  - existe a demonstração sintética em `../tcc-demo/` (fora do repo; **não são resultados**).
- **D3 (ferramenta de IA):** adotada provisoriamente → GitHub Copilot no VS Code, modalidade `ide-chat`. Faltam `modelo`, `versao_cliente`, o plano/assinatura e a medição de créditos. Ver [[Ferramenta de IA - GitHub Copilot]].
- **D2 (perfil do executor):** formulário existe, mas está vazio. Ver [[Perfil do Executor]].
- **D7 (instituição):** prazo, manual de TCC, orientador e CEP desconhecidos.
- **Revisão bibliográfica (E2):** 15 referências com metadados verificados; **nenhum texto integral lido**, nenhuma ficha, buscas nas bases não executadas.
- **Tarefas principais:** não existem. Precisam ser feitas **por terceiros, fora do repositório**. Ver [[Tarefas Principais e Selagem]].
- **Capítulos:** 1–4 em rascunho; 5–7 **bloqueados** até a coleta.

### Por que o piloto está travado
A 1ª execução do plano é **X01 = P2b na condição B** (ver [[Plano de Randomização]]). O instrumento recusa abrir execuções B enquanto `modelo` estiver vazio em `experiment/config/experimento.toml`. A ordem do plano não pode ser alterada.

### Ao retomar, fazer nesta ordem
1. **Terminar a D3 (Copilot)** — checklist em [[Ferramenta de IA - GitHub Copilot#Checklist de configuração (uma vez)]]:
   - criar perfis do VS Code **TCC-A** (sem Copilot) e **TCC-B** (com Copilot, `extensions.autoUpdate: false`);
   - escolher **um** modelo no seletor (não "Auto", **não Claude**) e anotar a versão da extensão Copilot Chat;
   - preencher `modelo` e `versao_cliente` em `experiment/config/experimento.toml`;
   - conferir que a busca web está desligada;
   - registrar plano/custo na seção 5 de `docs/ferramentas-ia.md`;
   - rodar `exp verificar-ambiente` até aparecer **configurada**.
2. **Instalar as métricas estáticas:** `pip install -e ".[dev,estatica]"` (sem isso, `delta_alertas_ruff` e `delta_cc_soma` ficam "indisponível").
3. **D2:** preencher `docs/perfil-executor.md`, **incluindo as expectativas prévias antes de qualquer sessão**.
4. **Preparação:** familiarização com a [[Aplicação-base loja]] (sem tarefas, duração registrada) e prática com o Copilot ≥ 3 h em tarefas não relacionadas, **medindo o consumo de créditos** (32 sessões precisam caber no plano).
5. **Rodar o piloto X01 → X08** seguindo o [[Guia de Sessão]] (máx. 4 por dia, 30 min de intervalo).
6. **Pós-piloto:** relatório de ajustes (`docs/relatorio-piloto.md`), calibrar o tempo-limite de 90 min, recalcular a [[Análise de Poder]] com o DP observado e verificar se resolver uma gêmea de P4 ajuda na outra (ressalva da D9).
7. **Em paralelo:** resolver D7 (orientador, manual, prazo, CEP) e começar a E2 (executar a string de busca, fichar ≥ 15 estudos).
8. **Depois:** terceiro produz e sela as tarefas principais → sortear `plano-principal.csv` → tag `protocolo-v1.0` (E5) → coleta.

### Regras que não se reabrem
- Resultados **só** depois da coleta. Capítulos 5–7 só a partir de `reports/principal/`. Ver [[Princípios de Integridade]].
- Tarefas principais e testes ocultos **nunca** no repositório (público) e **nunca** vistos pelo executor.
- Na condição B, **não usar modelos Claude** (afinidade com quem escreveu as tarefas-piloto e o instrumento).
- Se a IA cair durante uma sessão B: `exp abortar` e remarcar. **Nunca** fazer sem IA no lugar.
- O instrumento não chama nenhuma API de IA; só registra.

### Pequenas correções pendentes no repositório
Há textos desatualizados (README diz "D3 pendente", protocolo fala em "P1 e P2", etc.). Lista em [[Inconsistências do Repositório]].
