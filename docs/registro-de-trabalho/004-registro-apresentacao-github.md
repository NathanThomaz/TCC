# 004 — Registro de trabalho, ajuste da apresentação e envio ao GitHub

**Data:** 2026-10-28

## Solicitado
1. Gerar um `.md` com o retorno da etapa 1 e **manter esse controle daqui em diante**: tudo o que for solicitado, feito e respondido fica em documentos.
2. Subir tudo para o GitHub.
3. Ajustar a apresentação, **removendo do final os "próximos passos"**.

## Feito

### 1. Registro de trabalho
- Criada a pasta `docs/registro-de-trabalho/`, com índice ([README.md](README.md)).
- Entradas criadas:
  - 001: diagnóstico técnico, que só existia no chat;
  - 002: plano do Marco 1 e aprovação;
  - 003: etapa 1;
  - 004: esta entrada.
- Regra adotada: **toda interação de trabalho gera uma entrada nova**, com Solicitado / Feito / Resposta / Arquivos / Pendências.

### 2. Apresentação
- Arquivo: `thesis/apresentacao/proposta-v2-forja.pptx`. Passa a ser a **versão única**: tinha 23 slides, agora tem **22**.
- **Removido** o último slide, "Próximos passos". A apresentação termina em "Riscos e mitigação".
- **Ajuste a mais (não pedido explicitamente, feito para manter tudo alinhado):** o slide 11, "O mapa do sistema é o contrato", mostrava a regra no formato v0.1. Agora mostra o formato v0.2 (`entidade: venda`, `transicoes: ["concluir"]`, `para_cada: "itens"`), e o selo diz "Testado: a padaria passa e 21 mapas com erro de forma são recusados". As notas do apresentador também foram atualizadas.
- **Verificação:**
  - validação do arquivo: `All validations PASSED!`;
  - os slides 11 e 22 foram exportados como imagem pelo PowerPoint e conferidos.
- `proposta-v2-forja-rev3.pptx` estava **aberto no PowerPoint** e por isso **não foi enviado nem apagado**. Ele fica só na máquina local e está obsoleto: pode ser excluído depois de fechado.

### 3. GitHub
- `.gitignore` atualizado: ignora arquivos de bloqueio do Office (`~$*`) e o estado local do Obsidian (`workspace*.json`, `.trash/`).
- Antes do envio:
  - **busca por dados sensíveis:** só falsos positivos ("senha" dentro de "desenha");
  - **testes:** `python -m pytest -q -p no:cacheprovider` → **72 passed** em 27,27 s.
- **Branch nova `forja-marco-1`**, criada a partir da `main`. A `main` não foi alterada.
- Commits enviados:

| Commit | Conteúdo |
|---|---|
| `9d8acb5` | Vault do Obsidian com a documentação do TCC + `.gitignore` |
| `3eb4c0a` | Proposta v2 (Forja) e apresentação para o orientador |
| `3b3fd30` | Forja, Marco 1 etapa 1: contrato v0.2 e testes estruturais |
| (este commit) | Registro de trabalho 001 a 004 + vault atualizado |

- `git push -u origin forja-marco-1` → `* [new branch] forja-marco-1 -> forja-marco-1`.
- Pull request (não criado; pode ser aberto se você quiser): https://github.com/NathanThomaz/TCC/pull/new/forja-marco-1

## Observações
- O repositório é **público**. O vault inclui caminhos locais da máquina (ex.: `C:\Users\natha\Documents\TCC`) e a configuração do computador (GPU, memória). Isso não é segredo, mas fica visível.
- O script que gera a apresentação continua **fora do repositório** (pasta temporária da sessão). Por isso o `.pptx` não é reproduzível a partir do repositório.

## Pendências
- Decidir se a branch `forja-marco-1` entra na `main` (pull request ou merge).
- Excluir o `proposta-v2-forja-rev3.pptx` local depois de fechar o PowerPoint.
- Marco 1, etapa 2 (validador semântico), aguardando o "ok".
