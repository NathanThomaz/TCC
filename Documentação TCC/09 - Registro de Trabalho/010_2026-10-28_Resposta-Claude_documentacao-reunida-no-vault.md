---
tipo: resposta
autor: Claude
numero: "010"
data: 2026-10-28
assunto: "Documentação reunida no vault"
pergunta: "[[010_2026-10-28_Pergunta-Nathan_documentacao-reunida-no-vault]]"
tags: [tcc, registro, resposta]
---

# 010 · Resposta do Claude — Documentação reunida no vault

**Pergunta:** [[010_2026-10-28_Pergunta-Nathan_documentacao-reunida-no-vault]]

## Resposta enviada (texto integral)

Feito. Reuni a documentação no vault e deixei no repositório só o que o código usa.

**Foi para o vault (`Documentação TCC`):**

| Antes (repositório) | Agora (vault) |
|---|---|
| `docs/forja/README.md` | `10 - Nexo - Contrato e Validação/Contrato do Mapa do Sistema.md` |
| `docs/forja/validacao.md` | `10 - Nexo - Contrato e Validação/Validação do Mapa.md` |
| `docs/forja/plano-marco-1.md` | `10 - Nexo - Contrato e Validação/Plano do Marco 1.md` |
| `docs/proposta-v2-gerador-de-sistemas.md` | `01 - Projeto/Proposta v2 - Documento Completo.md` |

- Os links entre esses documentos foram corrigidos, e no topo de cada um há um aviso dizendo de onde ele veio.
- A pasta nova aparece no Painel do TCC, e todos os links do vault foram conferidos (62 notas, nenhum quebrado).

**Ficou no repositório, porque o código precisa:**
- **O exemplo da padaria** (`exemplo-padaria.mapa.json`) foi para `tests/forja/dados/`, junto dos testes que o usam.
- **Os documentos do projeto antigo** (`docs/metricas.md`, `guia-sessao.md`, `protocolo-experimental.md` e outros) **continuam em `docs/`**. O código do `tcc_exp` cita esses arquivos, e você pediu para preservar esse projeto intacto. O vault já tem resumos de cada um.
- No README do repositório, acrescentei uma linha avisando que a documentação do TCC está no vault.

**Conferências:**
- O validador continua funcionando no novo lugar do exemplo: 0 erros, 0 avisos.
- **Testes: 111 da Forja e 156 na suíte completa, passando.**
- Durante a troca, eu introduzi um erro de aspas numa mensagem do validador. Ele foi pego e corrigido antes de rodar os testes.

**Registro:** esta conversa está gravada como o par **010** em `09 - Registro de Trabalho`.

Nenhum commit foi feito. Seguem aguardando você: a revisão da Etapa 2 (validador) e as decisões B1 a B12 do diagnóstico Nexo.

---

## Registro técnico
- **Movidos com `git mv`:**
  - `docs/forja/README.md`, `docs/forja/plano-marco-1.md` e `docs/proposta-v2-gerador-de-sistemas.md` → vault;
  - `docs/forja/exemplo-padaria.mapa.json` → `tests/forja/dados/`.
- **Movido com `mv`** (estava fora do git): `docs/forja/validacao.md` → vault.
- **A pasta `docs/forja/` foi removida** (ficou vazia).
- **Links corrigidos:**
  - entre os documentos movidos: wikilinks e caminhos relativos para `src/`, `tests/`, `thesis/` e `docs/plano-execucao.md`;
  - aviso de origem no topo de cada documento movido.
- **Código e testes:**
  - `tests/forja/conftest.py`: `EXEMPLO_PADARIA` → `tests/forja/dados/exemplo-padaria.mapa.json`;
  - `src/forja/estrutural.py`: a mensagem de `VERSAO_NAO_SUPORTADA` agora cita o documento "Contrato do Mapa do Sistema" no vault. A primeira troca deixou aspas desencontradas; foi corrigida antes dos testes.
- **Vault:**
  - "Proposta v2 - Forja": fonte e links atualizados;
  - Estado Atual: links + bloco "Documentação organizada";
  - Painel do TCC: seção "10 – Nexo: contrato e validação" e link para o documento completo da proposta;
  - Registro de Sessões: sessão 15.
- **Repositório:** `README.md` ganhou uma nota apontando para `Documentação TCC/`.
- **Mantidos em `docs/`:** os documentos do projeto antigo, citados por `src/tcc_exp` (`cli.py`, `ia.py`, `metricas.py`, `analise/estatistica.py`, `analise/dashboard.py`), por `experiment/scripts/analise_poder.py` e pelo `README.md`.
- **Comandos e resultados:**
  - `python -m forja validar tests/forja/dados/exemplo-padaria.mapa.json` → `VÁLIDO: 0 erro(s), 0 aviso(s).`, saída 0;
  - `python -m pytest tests/forja -q -p no:cacheprovider` → 111 passed;
  - `python -m pytest -q -p no:cacheprovider` → 156 passed;
  - checagem de links do vault: 62 notas, nenhum quebrado.
- **Commit:** nenhum.
