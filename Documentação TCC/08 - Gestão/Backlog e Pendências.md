---
tipo: gestao
atualizado: 2026-10-28
tags: [tcc, gestao, backlog]
---

# Backlog e Pendências

Lista viva de tudo o que falta, por prioridade. Marque `[x]` ao concluir e registre a sessão em [[Registro de Sessões]].

## 🔴 Agora — destrava o piloto
- [ ] Informar qual plano do Copilot você já tem (estudantil / Free / Pro / Pro+)
- [ ] Criar perfis do VS Code **TCC-A** e **TCC-B** (auto-update desligado no B)
- [ ] Escolher o modelo do Copilot (não "Auto", não Claude) → `modelo` em `experimento.toml`
- [ ] Anotar a versão da extensão Copilot Chat → `versao_cliente`
- [ ] Conferir busca web desligada
- [ ] Registrar plano, custo e data na §5 de `docs/ferramentas-ia.md`
- [ ] `exp verificar-ambiente` → "configurada"
- [ ] `pip install -e ".[dev,estatica]"` (ruff + radon)
- [ ] Criar `.env` a partir de `.env.example` (opcional no piloto; obrigatório na principal)

## 🟠 Antes da 1ª sessão do piloto
- [ ] Preencher [[Perfil do Executor]] (D2), **com as expectativas prévias**
- [ ] Familiarização com a [[Aplicação-base loja]] (registrar duração)
- [ ] Prática com o Copilot ≥ 3 h, medindo créditos; decidir upgrade se 32 sessões não couberem
- [ ] Ler o [[Guia de Sessão]] inteiro

## 🟡 Piloto (E4)
- [ ] X01 … X08 na ordem do [[Plano de Randomização]]
- [ ] Relatório de ajustes `docs/relatorio-piloto.md`
- [ ] Calibrar o tempo-limite (90 min)
- [ ] Recalcular a [[Análise de Poder]] com o DP observado → decidir nº de pares
- [ ] Avaliar se as gêmeas de P4 (e P2) interferem uma na outra

## 🟢 Institucional (D7) — em paralelo
- [ ] Definir/confirmar orientador
- [ ] Obter manual de TCC e prazo de entrega
- [ ] Confirmar se precisa de CEP
- [ ] Confirmar regras da instituição sobre uso de IA
- [ ] Preencher `instituicao` e `orientador` em `experimento.toml`
- [ ] Validar D0–D6, D9, D10 com o orientador

## 🔵 Bibliografia (E2) — em paralelo
- [ ] Executar a string nas bases e registrar
- [ ] Triagem
- [ ] Fichar ≥ 15 estudos (texto integral) com o [[Modelo - Ficha de Leitura]]
- [ ] Localizar a publicação oficial do acompanhamento METR (A4)
- [ ] Verificar os itens "C" de [[Referências Verificadas]] (Edgington & Onghena, GQM, Kitchenham…)
- [ ] `pesquisa/revisao-literatura.md`: confirmar ou refutar a lacuna
- [ ] Completar os `[VERIFICAR]` das referências ABNT

## 🟣 Coleta principal (E3 → E5 → E6)
- [ ] Definir o terceiro que vai produzir as tarefas principais
- [ ] Variante selada da aplicação-base
- [ ] 12 pares + 4 reservas, validados e selados ([[Tarefas Principais e Selagem]])
- [ ] `pares-principal.toml` + `plano-principal.csv` sorteado
- [ ] Protocolo v1.0 + tag `protocolo-v1.0`
- [ ] 24 execuções

## ⚪ Redação
- [ ] Cap. 4: §4.6 Procedimento, §4.8 Ameaças, §4.9 Ética
- [ ] Caps. 2 e 3 após as fichas
- [ ] Atualizar [[Uso de IA no TCC]] (sessões de 28/10)

## 🧹 Manutenção do repositório
- [ ] Corrigir as divergências de [[Inconsistências do Repositório]]
