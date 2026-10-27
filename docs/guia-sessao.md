# Guia de execução de sessão (roteiro do executor)

Siga este roteiro em **toda** execução, piloto ou principal. A CLI recusa comandos fora de ordem.

## 0. Uma vez por máquina

```bash
pip install -e ".[dev,estatica]"
cp .env.example .env            # ajuste TCC_FASE (piloto/principal) e, na principal, TCC_TAREFAS_DIR
exp verificar-ambiente
```

## 1. Antes da sessão: checklist do ambiente

Descubra a próxima execução no plano (`experiment/randomization/plano-<fase>.csv`), na ordem da coluna `posicao`.

### Se a condição for A (sem IA)
- [ ] Editor aberto no **perfil A** (nenhuma extensão de IA ativa e autocompletar por IA desligado).
- [ ] Nenhum chat de IA aberto (navegador, app desktop, terminal).
- [ ] Buscador: usar apenas os links de documentação permitidos (`experimento.toml` → `[recursos]`). Evitar buscadores que exibem respostas geradas por IA.
- [ ] Notificações silenciadas.

### Se a condição for B (com IA)
- [ ] Editor no **perfil B**, com a ferramenta configurada em `experimento.toml` → `[ferramenta_ia]`.
- [ ] Anotar o **modelo exibido** pela ferramenta.
- [ ] Ferramenta restrita ao diretório do workspace (agentes: iniciar dentro do workspace).
- [ ] Notificações silenciadas.

## 2. Durante a sessão

| Passo | Comando | Observação |
|---|---|---|
| Abrir | `exp abrir X01 --confirmo-sem-ia` (A) ou `exp abrir X01 --modelo "<modelo>"` (B) | Monta o workspace e mostra o caminho do ENUNCIADO.md |
| Ler o enunciado | — | Leitura completa. Ainda não abra o código |
| Começar | `exp iniciar X01` | A partir daqui o tempo ativo conta |
| Trabalhar | — | Edite os arquivos no workspace. Não altere `testes_publicos/` |
| Testar | `exp testar X01` | Quantas vezes quiser. Cada execução é registrada |
| Pausar | `exp pausar X01 --motivo "..."` / `exp retomar X01` | **Só** para interrupções externas |
| Ver o tempo | `exp status X01` | Mostra o tempo ativo e o restante |
| Entregar | `exp entregar X01 --confianca <1-5>` | Antes de entregar, responda: quão confiante você está de que a entrega atende a **todos** os cenários? Aceita → fim. Senão → devolutiva → corrija → entregue de novo |
| Limite | `exp encerrar-limite X01` | Use ao chegar a 90 min ativos |
| Abortar | `exp abortar X01 --motivo "..."` | Falha de ambiente ou da IA. Registre em `docs/desvios.md` |
| Observação | `exp nota X01 "texto"` | Qualquer coisa relevante para a análise |

## 3. Depois da sessão

- [ ] `exp percepcao X01 <minutos>`: quanto tempo você **acha** que gastou, antes de olhar o status.
- [ ] `exp questionario X01 --dificuldade <1-5> --esforco <1-5> [--utilidade-ia <1-5>] [--comentario "..."]` (a utilidade da IA só se responde na condição B).
- [ ] Condição B: exportar a conversa ou log da ferramenta e rodar `exp anexar X01 <arquivo> --descricao "transcrição"`.
- [ ] Se houve algo fora do protocolo, registrar em [desvios.md](desvios.md).
- [ ] Commit dos dados brutos: `git add data/raw && git commit -m "dados: sessão X01"`.
- [ ] **Não** discutir nem rever a tarefa gêmea antes de executá-la.

## 4. Regras gerais

- Uma sessão por vez. Intervalo mínimo de 30 minutos entre execuções.
- No máximo 4 execuções por dia, para evitar fadiga.
- Não consultar o código de execuções anteriores durante uma execução.
- Não abrir o diretório `TCC_TAREFAS_DIR` (pacotes selados) em hipótese alguma.
