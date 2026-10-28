---
tipo: procedimento
fonte: docs/guia-sessao.md
atualizado: 2026-10-28
tags: [tcc, experimento, sessao, procedimento]
---

# Guia de Sessão (roteiro do executor)

Fonte: [guia-sessao.md](https://github.com/NathanThomaz/TCC/blob/main/docs/guia-sessao.md)

Seguir em **toda** execução, piloto ou principal. A CLI recusa comandos fora de ordem. Os exemplos usam `X01`; troque pelo exec_id da vez.

## 0. Uma vez por máquina
```bash
pip install -e ".[dev,estatica]"
cp .env.example .env     # TCC_FASE=piloto|principal; na principal, TCC_TAREFAS_DIR
exp verificar-ambiente
```
> Hoje (28/10) ainda não há `.env` e `ruff`/`radon` não estão instalados.

## 1. Antes da sessão — checklist
Próxima execução = próxima linha do [[Plano de Randomização]] (coluna `posicao`).

**Condição A (sem IA)**
- [ ] VS Code no perfil **TCC-A** (nenhuma extensão de IA, autocompletar por IA desligado)
- [ ] Nenhum chat de IA aberto (navegador, app, terminal)
- [ ] Só os links de documentação permitidos; evitar buscadores com resposta de IA
- [ ] Notificações silenciadas

**Condição B (com IA)**
- [ ] VS Code no perfil **TCC-B**, só a pasta do workspace
- [ ] Anotar o **modelo exibido** no seletor
- [ ] Ferramenta restrita ao workspace
- [ ] Notificações silenciadas

## 2. Durante a sessão

| Passo | Comando | Observação |
|---|---|---|
| Abrir | `exp abrir X01 --confirmo-sem-ia` (A) · `exp abrir X01 --modelo "<modelo>"` (B) | Monta o workspace, mostra o ENUNCIADO.md |
| Ler | — | Leitura completa; ainda não abrir o código |
| Começar | `exp iniciar X01` | A partir daqui conta o tempo ativo |
| Trabalhar | — | Editar no workspace; **não** alterar `testes_publicos/` |
| Testar | `exp testar X01` | À vontade; cada execução é registrada |
| Pausar | `exp pausar X01 --motivo "..."` / `exp retomar X01` | **Só** interrupções externas |
| Ver tempo | `exp status X01` | Tempo ativo e restante |
| Entregar | `exp entregar X01 --confianca <1-5>` | Responder antes: quão confiante de que atende **todos** os cenários? Aceita → fim; senão devolutiva → corrigir → entregar de novo |
| Limite | `exp encerrar-limite X01` | Aos 90 min ativos |
| Abortar | `exp abortar X01 --motivo "..."` | Falha de ambiente/IA; registrar em desvios |
| Nota | `exp nota X01 "texto"` | Qualquer coisa relevante |

## 3. Depois da sessão
- [ ] `exp percepcao X01 <minutos>` — quanto você **acha** que gastou, **antes** de olhar o status
- [ ] `exp questionario X01 --dificuldade <1-5> --esforco <1-5> [--utilidade-ia <1-5>] [--comentario "..."]` (utilidade só em B)
- [ ] B: exportar a conversa e `exp anexar X01 <arquivo> --descricao "transcrição"`
- [ ] Algo fora do protocolo → [[Desvios do Protocolo]]
- [ ] Revisar anexos (repo público: sem dados pessoais/segredos) e `git add data/raw && git commit -m "dados: sessão X01"`
- [ ] **Não** discutir nem rever a gêmea antes de executá-la
- [ ] Atualizar o status no [[Plano de Randomização]], criar a nota da execução ([[Modelo - Execução Experimental]]) e atualizar [[Estado Atual - Retomada]]

## 4. Regras gerais
- Uma sessão por vez; **intervalo mínimo de 30 min** entre execuções.
- **Máximo 4 execuções por dia** (fadiga).
- Não consultar código de execuções anteriores durante uma execução.
- **Nunca** abrir `TCC_TAREFAS_DIR`.

Relacionadas: [[Comandos da CLI exp]] · [[Protocolo Experimental]] · [[Ferramenta de IA - GitHub Copilot]]
