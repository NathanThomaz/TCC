---
tipo: projeto
status: PROPOSTA (aguardando orientador) — revisão 2
fonte: docs/proposta-v2-gerador-de-sistemas.md; thesis/apresentacao/proposta-v2-forja.pptx
atualizado: 2026-10-28
tags: [tcc, projeto, proposta-v2, forja]
---

# Proposta v2 — Forja: sistemas sob medida para pequenos negócios

**Fontes:**
- plano completo: [proposta-v2-gerador-de-sistemas.md](https://github.com/NathanThomaz/TCC/blob/main/docs/proposta-v2-gerador-de-sistemas.md);
- apresentação: `thesis/apresentacao/proposta-v2-forja-rev3.pptx` (23 slides com notas do apresentador). A versão antiga, de 19 slides, ficou como `proposta-v2-forja.pptx` porque estava aberta no PowerPoint; ela deve ser substituída pela rev3.
- contrato do mapa: `docs/forja/` (schema, exemplo da padaria, README com a matriz de suporte).

*Os arquivos estão no repositório local; o link do GitHub só funciona depois de commit e push.*

> **Status:** proposta, revisão 2 (28/10/2026), aguardando o orientador. O plano v0.1 ([[Plano de Execução]]) está **suspenso**: não configurar o Copilot nem rodar o piloto N-de-1.

## A necessidade (o centro do TCC)
Pequenos negócios (padaria, salão, oficina, pet shop, pequenas lojas) precisam controlar estoque, vendas, clientes e contas. As três saídas atuais têm problemas:

| Saída | Problema |
|---|---|
| Sistema pronto | Mensalidade e pouca adaptação |
| Desenvolvedor | Caro |
| Planilha ou caderno | Frágil |

**A Forja** deixa o próprio dono criar um sistema de controle **sob medida**, **sem programar**, **sem custo** e **no computador da loja**.

*Dados do setor (SEBRAE, IBGE) ainda precisam ser levantados e verificados.*

**Persona ilustrativa:** Ana, dona de uma padaria de bairro. Ela quer controlar estoque (com aviso de produto acabando), encomendas, fiado com limite e as vendas do dia.

## Pedidos do autor que a proposta atende
| Pedido | Como foi atendido |
|---|---|
| Sistema que cria sistemas, rodando local em qualquer máquina | Forja + sistema gerado leve |
| Foco em pequenas empresas | Necessidade, persona, cenários e usuários reais |
| Sistema principal completo | 7 etapas |
| Sem custo | Ollama + modelo aberto, Python, SQLite |
| Necessidade resolvida pela tecnologia | Avaliação técnica + estudo com usuários |

## As 7 etapas (a IA propõe, o usuário decide)
1. **Mapeamento do negócio:** conversa guiada.
2. **Regras de negócio:** definidas pelo usuário e confirmadas com exemplos ("vender 5 com 3 em estoque → bloqueado. Correto?").
3. **Entidades e relacionamentos:** diagrama ER que o usuário ajusta.
4. **Modelos:** o motor gera o banco, as validações, as regras em código e os testes.
5. **Documentação:** manual em linguagem simples, dicionário de dados, regras, diagrama, backup.
6. **Layout final:** telas, menu e painel; o usuário escolhe estilo, cores e logo, com prévia.
7. **Entrega:** sistema local com backup e exportação para planilha.

## Arquitetura: "a IA entende, o motor garante"
Conversa → IA local → **mapa do sistema** (especificação estruturada, aprovada pelo usuário) → **motor de geração por templates** (determinístico) → sistema.

A IA não escreve código livremente. Isso garante:
- **confiabilidade:** quem não programa não precisa corrigir código;
- **leveza:** o sistema gerado não depende de IA nem de internet;
- **avaliação limpa:** separa o erro de entendimento do erro de geração.

## "Em qualquer máquina"
| Parte | Onde roda |
|---|---|
| Sistema gerado | Qualquer PC comum, sem internet e sem IA |
| Forja no modo guiado (sem IA) | Qualquer PC |
| Forja no modo com IA local | Requisito mínimo medido no piloto (meta: 16 GB de RAM, sem GPU obrigatória) **[NÃO VALIDADO]** |

## Método e avaliação
- **Design Science Research**, com as 6 atividades de Peffers et al. (2007) [VERIFICAR].
- **Avaliação técnica:**
  - ~10 cenários de pequenos negócios, escritos por terceiro e selados;
  - cada cenário feito no **modo com IA × modo guiado**;
  - testes de aceitação ocultos;
  - modelo de dados comparado a um gabarito;
  - H1 tempo, H2 aderência às regras, H3 correções.
- **Avaliação com usuários:**
  - 6–10 empreendedores criam e usam um sistema;
  - medidas: sucesso, tempo, SUS, utilidade (H4, exploratória);
  - **exige consulta ao CEP**. Plano B: só a avaliação técnica.

## Escopo
- **Dentro:** estoque, vendas, clientes, fornecedores, agenda, contas a pagar e receber, regras do usuário, relatórios, painel, backup, um computador.
- **Fora:** nota fiscal, bancos e Pix, rede ou nuvem, celular, marketplaces.

## Decisões a registrar se for aprovada
- **REVISADAS:** D0, D1, D2, D3, D4 (e D7 passa a incluir o CEP).
- **NOVAS:**
  - D12: custo zero e execução local;
  - D13: arquitetura mapa + motor;
  - D14: escopo.

Ver [[Decisões Metodológicas]].

## Próximos passos
1. Levar a proposta e os slides ao orientador.
2. Descobrir o prazo e o manual, e **consultar o CEP**.
3. Definir quem escreve os cenários de avaliação.
4. Conversar informalmente com 2–3 pequenos empreendedores.
5. Depois do aval: Ollama, testes de modelos (com e sem GPU), esquema do mapa e primeiro template.

## Revisão 3: quatro ajustes antes de implementar
1. **Contrato formal do mapa:**
   - JSON Schema em `docs/forja/mapa-do-sistema.schema.json` (rascunho v0.1), com exemplo completo da padaria em `docs/forja/exemplo-padaria.mapa.json`.
   - Fonte única da verdade: entidades, campos, relacionamentos, regras (expressões estruturadas, nunca texto livre), telas, **perfis e permissões**, **testes de aceitação** e tema.
   - **Verificado em 28/10:** o exemplo passa e **8 mapas errados são recusados**.
   - Falta o validador semântico (F2). As questões em aberto estão em `docs/forja/README.md`: evento "confirmar" para mestre-detalhe, ações na edição, dados iniciais de campos calculados.
2. **Personalização × geração livre:**
   - templates + metadados, com uma **matriz de suporte do MVP** (11 tipos de campo, 1:N e N:N, restrição/cálculo/ação, 5 tipos de tela, perfis por entidade, 3 estilos);
   - pedido fora da matriz = "não suportado", registrado e contado.
3. **Portão offline G1** (fim da F2, antes da parte com IA):
   - sistema da padaria gerado sem IA, empacotado e testado numa **máquina limpa sem rede** (Windows Sandbox: gratuito no Win 11 Pro, **ainda não ativado**, precisa de admin);
   - checklist de 12 itens;
   - resultado em `docs/forja/prova-offline.md`.
4. **Isolamento do efeito da IA:**
   - a IA atua **só nas etapas 1–3** (interpretar requisitos → alterações no mapa);
   - documentação e layout passam a ser feitos pelo **motor** nos dois modos;
   - mesmos formulários, catálogo, exemplos, templates, roteiro e testes;
   - ordem contrabalanceada; tempo das etapas 1–3 medido à parte; rejeições do schema contadas.

**Novas decisões propostas:** D15 (contrato), D16 (portão offline), D17 (isolamento).

## Histórico desta proposta
- **Revisão 1 (28/10):** gerador avaliado por 8 configurações de melhorias (M2–M4). Substituída.
- **Revisão 2 (28/10):** foco em pequenos negócios, 7 etapas, arquitetura mapa + motor, modo com IA × modo guiado, estudo com usuários.
- **Revisão 3 (28/10):**
  - contrato formal (schema validado);
  - matriz de suporte;
  - portão offline G1;
  - isolamento da IA (só etapas 1–3);
  - apresentação com 23 slides.

Relacionadas: [[Estado Atual - Retomada]] · [[Princípios de Integridade]] · [[Tema, Pergunta e Objetivos]]
