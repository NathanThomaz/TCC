# 001 — Diagnóstico técnico do projeto Forja

**Data:** 2026-10-28
**Tipo:** revisão técnica, somente leitura (nenhum arquivo alterado, nada instalado, nenhum commit)

## Solicitado
Diagnóstico para uma revisão técnica conjunta, em 10 pontos:
1. árvore de diretórios;
2. tecnologias;
3. arquitetura implementada e fluxo;
4. o que funciona, o que é parcial e o que é planejado;
5. representação do mapa;
6. IA, modo guiado, templates e validação;
7. artefatos gerados;
8. testes e resultados reais;
9. riscos e divergências;
10. próximos cinco passos.

Cada afirmação deveria trazer os arquivos relevantes e distinguir o que foi verificado do que é intenção.

## Feito
Verificações executadas:
- `git status`;
- busca por código da Forja;
- `pytest` sem gravar cache;
- validação do mapa só em memória;
- `exp verificar-ambiente`.

O `git status` ficou idêntico antes e depois.

## Resposta (resumo fiel)

Legenda:
- **[VERIFICADO]:** executado ou inspecionado na revisão;
- **[DOCUMENTADO]:** afirmado nos documentos, não reexecutado;
- **[PLANEJADO]:** só intenção.

**Conclusão central:** a Forja **não tinha nenhuma implementação** [VERIFICADO]. Buscas por `forja`, `ollama`, `fastapi`, `jinja` e `mapa-do-sistema` em código não encontraram nada. Existiam só:
- o contrato v0.1 (forma);
- um mapa de exemplo escrito à mão;
- documentos.

Todo o código era do projeto anterior: o instrumento `tcc_exp` (experimento N-de-1, suspenso) e a aplicação `loja`.

| Tema | Diagnóstico |
|---|---|
| Tecnologias implementadas | CLI Python (argparse); JSONL com cadeia SHA-256; CSV; SQLite (`sqlite3`) só na `loja`; dashboard HTML estático. Nenhum frontend, backend web, gerador ou chamada de IA |
| Tecnologias da Forja | Ollama, FastAPI, Jinja2, empacotamento: **todas só planejadas**. O `jsonschema` era usado, mas não estava declarado no `pyproject.toml` |
| Funciona | Instrumento `tcc_exp` e aplicação `loja`: 45 testes passaram em 27,18 s |
| Parcial | Contrato do mapa: valida a forma, mas **aceitava referência inexistente** (verificado); validação não reprodutível (sem script nem teste) |
| Só planejado | Interpretação por IA, modo guiado, motor, templates, painel, documentação gerada, layout, empacotamento, prova offline, avaliação |
| Artefatos da Forja | Nenhum. Os slides vinham de um script fora do repositório |
| Testes | 45 passed (16 da `loja` + 29 do instrumento); **nenhum teste da Forja** |

**Riscos apontados:**
1. Documentos à frente do código.
2. Dois projetos misturados no repositório.
3. Lacuna semântica do contrato.
4. Validação não reprodutível.
5. Modo offline não comprovado.
6. IA local não testada (o maior risco).
7. O isolamento IA × guiado depende de uma interface inexistente.
8. O reaproveitamento de código era só intenção.
9. Higiene do repositório público.
10. Escopo × prazo desconhecido.

**Próximos cinco passos recomendados:**
1. Aval do orientador e prazo.
2. Contrato como código testável (validador semântico).
3. Experimento rápido com IA local.
4. Motor mínimo sem IA.
5. Portão offline G1.

## Arquivos
Nenhum (revisão somente leitura). Esta entrada foi registrada depois, na entrada 004.

## Pendências geradas
Viraram o Marco 1 (entradas 002 e 003).
