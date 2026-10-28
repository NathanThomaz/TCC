# 003 — Marco 1, etapa 1: contrato v0.2 e testes estruturais

**Data:** 2026-10-28

## Solicitado
Iniciar a implementação aprovada do Marco 1. Fazer primeiro uma conferência de escopo e depois a etapa 1:
- atualização do contrato para a v0.2;
- migração manual do exemplo da padaria;
- testes estruturais.

Ao fim, apresentar os resultados antes de avançar.

## Conferência de escopo
- Fora do escopo e intocados: `src/tcc_exp/`, `experiment/` e os testes antigos (confirmado por `git status`).
- Não foram criados interface, Ollama nem motor.
- Nenhuma dependência nova: jsonschema 4.24.0 e setuptools 65.5 já estavam instalados.
- O projeto já estava instalado em modo editável, com `src/` no caminho de importação. Assim, o pacote `forja` ficou importável sem reinstalar.

## Feito

| Arquivo | Ação | Conteúdo |
|---|---|---|
| `src/forja/__init__.py` | criado | Pacote novo, isolado do `tcc_exp`; declara que só existe o contrato |
| `src/forja/contrato/__init__.py` | criado | `carregar_schema()` com `importlib.resources`; devolve uma cópia |
| `src/forja/contrato/mapa-do-sistema.schema.json` | criado (v0.2) | Novidades listadas abaixo da tabela |
| `docs/forja/mapa-do-sistema.schema.json` | removido | Uma única cópia do contrato (P1) |
| `docs/forja/exemplo-padaria.mapa.json` | migrado à mão | Mudanças listadas abaixo da tabela |
| `pyproject.toml` | modificado | Grupo opcional `forja = ["jsonschema>=4.18,<5"]` + contrato incluído como dado do pacote; dependências do projeto antigo intactas |
| `tests/forja/__init__.py`, `conftest.py`, `test_estrutural.py` | criados | Fixtures e testes estruturais |
| `docs/forja/README.md` | ajuste mínimo | Novo caminho do contrato + aviso de que o restante ainda descreve a v0.1 |
| Vault | atualizado | Ponto de parada e registro da sessão |

**Novidades do contrato v0.2:**
- ciclo de vida (estados, transições, `estorna`, `detalhes`);
- `origem` de cada campo (`calculado` aceito como obsoleto e proibido junto com `origem`);
- `transicoes` como gatilho de regras;
- `para_cada`;
- `preparacao`/`forcar`;
- passo de teste do tipo `transicao`;
- `permissoes_transicoes`;
- `filtro` no relatório.

**Mudanças no exemplo da padaria:**
- a venda nasce como rascunho; concluir baixa o estoque e soma o fiado; cancelar estorna;
- `saldo_fiado` passou a ter `origem: acao`;
- regra nova: a venda precisa ter ao menos um item para ser concluída;
- painel e relatório consideram só vendas concluídas;
- só a dona cancela;
- 8 testes de aceitação no mapa.

## Testes executados (resultados reais)

| Comando | Resultado |
|---|---|
| `python -m pytest tests/forja -q -p no:cacheprovider` | **27 passed** em 0,82 s |
| `python -m pytest -q -p no:cacheprovider` (suíte completa) | **72 passed** em 39,00 s |
| `python -m pytest -q -p no:cacheprovider tests/unit tests/integration experiment/base-system/tests` | **45 passed** em 25,90 s (os 45 antigos) |

Os 27 testes se dividem assim:
- **3 sobre o contrato:** é Draft 2020-12 válido; devolve cópia; versão coerente.
- **3 casos válidos:** a padaria; o sinônimo `calculado`; uma entidade sem ciclo de vida.
- **21 casos inválidos.** Cada um altera um único ponto e confere que o erro aparece **naquele ponto**.

**Contrato encontrado após instalação:**
- **Wheel:** `pip wheel . --no-deps --no-build-isolation`, rodado numa cópia do projeto, falhou com `invalid command 'bdist_wheel'`. O pacote `wheel` não está instalado, e não foi instalado.
- **Prova equivalente que funcionou:**
  - o `build_py` do setuptools montou a estrutura que vai para o pacote instalado, com o `.schema.json` incluído;
  - um Python isolado (`python -I`), sem o `src/` do repositório no caminho, importou `forja.contrato` dessa cópia e carregou o contrato v0.2.

## Limitações registradas
- Só a forma é validada; a validação semântica é a etapa 2.
- Datas `date-time` ainda não são conferidas.
- A versão 0.1 é recusada com o erro genérico do jsonschema; o código `VERSAO_NAO_SUPORTADA` vem na etapa 2.
- Os 8 testes de aceitação do mapa só descrevem comportamento; não há motor para executá-los.
- O README e a seção 4.0 da proposta ainda estão parcialmente na v0.1; serão revisados na etapa de documentação.

## Próxima etapa (aguardando "ok")
Etapa 2: validador semântico e códigos de erro.
- **Arquivos:** `erros.py`, `caminhos.py`, `estrutural.py`, `semantica.py` e `__main__.py`.
- **Testes:** `test_semantica.py`, `test_ciclo_de_vida.py` e `test_erros.py`.
