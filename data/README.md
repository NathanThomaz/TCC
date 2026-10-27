# Dados

| Diretório | Conteúdo | Quem escreve | Pode editar à mão? |
|---|---|---|---|
| `raw/<fase>/sessoes/` | Um JSONL por execução, somente-acréscimo, com cadeia de hash | `exp` (CLI) | **Nunca** |
| `raw/<fase>/anexos/<exec_id>/` | Transcrições de IA e outros arquivos brutos (com SHA-256 no evento `anexo`) | `exp anexar` | **Nunca** |
| `processed/<fase>/` | `execucoes.csv` (métricas por execução) e `integridade.json` | `exp processar` | Não. Para mudar, regenere |

- `<fase>` é `piloto` ou `principal`. Os dados do piloto não entram na análise principal.
- **Dados sintéticos** (usados para testar o código) ficam em `tests/fixtures/` e **nunca** aqui.
- Se a cadeia de hash de uma sessão falhar (`integridade.json`), a execução é excluída da análise e a exclusão aparece no relatório.
- O repositório é **público**: antes de cada commit de dados, confira que não há dados pessoais nem segredos nos anexos.
