---
tipo: experimento
decisao: D3
status: adotada-provisoria (configuração incompleta)
fonte: docs/ferramentas-ia.md; experiment/config/experimento.toml
atualizado: 2026-10-28
tags: [tcc, experimento, ia, copilot]
---

# Ferramenta de IA — GitHub Copilot (condição B)

Fonte: [ferramentas-ia.md](https://github.com/NathanThomaz/TCC/blob/main/docs/ferramentas-ia.md) · [experimento.toml](https://github.com/NathanThomaz/TCC/blob/main/experiment/config/experimento.toml) · Decisão [[Decisões Metodológicas#D3. Ferramenta de IA da condição B|D3]]

> ⛔ **Bloqueio atual:** `modelo` e `versao_cliente` estão vazios em `experimento.toml`. O `exp verificar-ambiente` diz "Ferramenta de IA não configurada (campos vazios: modelo)" e o instrumento recusa execuções B. A 1ª execução do piloto (X01) é B.

## Registro da ferramenta (situação atual)

| Campo | Valor | Situação |
|---|---|---|
| Ferramenta | GitHub Copilot (extensões Copilot + Copilot Chat) no VS Code | ✅ |
| Fornecedor | GitHub (Microsoft) | ✅ |
| Modalidade | `ide-chat`, uso livre de autocompletar, chat e modo agente | ✅ |
| Modelo | — | ⏳ nome exato no seletor (**não "Auto", não Claude**) |
| Versão do cliente | — | ⏳ VS Code + extensão Copilot Chat |
| Plano / custo | — | ⏳ estudantil / Free / Pro / Pro+, com preço da página oficial e data |
| Busca web | `busca_web = false` no toml | ⏳ conferir nas configurações e deixar desligada |
| Exportação | Paleta → "Chat: Export…" (JSON) → `exp anexar` | ✅ definido |
| Créditos | — | ⏳ medir na prática; 32 sessões (8 piloto + 24 principais) precisam caber |

## Por que o Copilot
- **Validade ecológica:** é a ferramenta que o executor usaria.
- **Comparabilidade:** é a ferramenta de Peng (2023), Vaithilingam (2022), Mozannar (2024) e Cui (2026).
- **Mesmo editor** nas duas condições (perfis do VS Code).
- **Exporta a sessão** em JSON.
- **Risco principal:** cota de créditos do plano estudantil. Se não couber, Pro — decidir **antes** do piloto e registrar.

## Alternativas avaliadas (resumo da §2.1)
| Opção | Por que não |
|---|---|
| Cursor | Editor diferente; registro não confirmado |
| Codex CLI | Melhor rastreabilidade, mas muda a modalidade para agente de terminal (o estudo viraria sobre "agente") |
| Gemini CLI / Code Assist | Informação sobre gratuidade contraditória |
| Claude Code | **Evitar:** afinidade com quem escreveu tarefas-piloto e instrumento |

> Preços e limites da comparação vieram, em boa parte, de sites de terceiros. Conferir na página oficial e anotar a data.

## Categorias de ferramentas (para o cap. 2)
| Modalidade | O que faz | Papel do dev |
|---|---|---|
| Autocompletar | Sugere continuação ao digitar | Aceita/rejeita |
| `ide-chat` | Chat no editor que lê o código e propõe edições | Pergunta, revisa, aplica |
| `chat-externo` | Chat no navegador, sem acesso ao projeto | Copia e cola |
| `agente` | Edita vários arquivos, roda comandos e testes, itera | Define, supervisiona, revisa |

## Checklist de configuração (uma vez)
1. **Perfis do VS Code** (Arquivo → Perfis):
   - **TCC-A:** sem Copilot e Copilot Chat (ou desabilitados no perfil);
   - **TCC-B:** com os dois habilitados.
2. Em **TCC-B** (settings JSON do perfil): `"extensions.autoUpdate": false`; opcional `"update.mode": "none"`.
3. No seletor de modelo do chat: escolher **um** modelo (não "Auto", não Claude) e copiar o nome exato para `modelo` em `experiment/config/experimento.toml`.
4. Anotar a versão da extensão Copilot Chat em `versao_cliente`.
5. Desligar busca na web / ferramentas externas, se houver. Registrar.
6. `exp verificar-ambiente` → a linha "Ferramenta de IA (condição B)" deve dizer **configurada**.
7. **Prática ≥ 3 h** em tarefas não relacionadas, anotando créditos por sessão (página de uso da conta GitHub). Estimar se 32 sessões cabem.
8. Registrar tudo na §5 de `docs/ferramentas-ia.md` (data, plano, custo, configs) e capturas em `docs/anexos/ferramenta-ia/`.

## Em cada sessão B
- VS Code no perfil **TCC-B**, abrindo **só** a pasta do workspace da execução.
- Conferir o modelo no seletor e passar em `exp abrir X.. --modelo "<nome>"` (se divergir da config, o instrumento marca `modelo_diverge_da_config`).
- Ao final: "Chat: Export…" → JSON → `exp anexar X.. <arquivo.json> --descricao "transcrição Copilot"`.

## Regras de uso na condição B
- **Livre:** perguntar, pedir código, revisão, testes; no modo agente, deixar editar e rodar comandos.
- **Proibido:** outra ferramenta de IA; deixar a IA rodar `exp entregar`, `exp encerrar-limite` ou `exp abortar`; apontar a IA para fora do workspace.
- A responsabilidade pela entrega é do executor. Testes públicos podem ser mostrados à IA; os ocultos não estão acessíveis.

## O instrumento não chama a IA
`src/tcc_exp/ia.py` é só um **adaptador de registro**: sem chave de API, sem SDK; trocar de ferramenta = editar a config; IA fora do ar = abortar e remarcar.

Relacionadas: [[Guia de Sessão]] · [[Ameaças à Validade]] · [[Uso de IA no TCC]]
