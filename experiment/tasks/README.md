# Tarefas experimentais

## Fases

| Fase | Onde ficam os pacotes | Visíveis ao executor? | Entram na análise principal? |
|---|---|---|---|
| **Piloto** | `experiment/tasks/piloto/` (neste repositório, público) | Sim | **Não.** Servem para testar procedimento e instrumento |
| **Principal** | Diretório externo, apontado por `TCC_TAREFAS_DIR` (**nunca** neste repositório) | **Não** | Sim |

## Formato do pacote

```
<ID>/
  task.toml          id, tipo, par, titulo, base, piloto, total_ocultos,
                     [severidade_ocultos] e [descricao_ocultos] (um item por teste oculto)
  enunciado.md       relato + regras + critérios de aceitação (TUDO o que os ocultos verificam
                     deve estar dito aqui)
  overrides/         arquivos que substituem os da aplicação-base (estado inicial)
  testes_publicos/   conftest.py + testes visíveis (caso relatado / caminho feliz)
  testes_ocultos/    conftest.py + testes de avaliação (casos de borda das regras escritas)
  referencia/        (opcional) solução de referência. Sem esse diretório, a referência é a aplicação-base
```

`exp validar-tarefa [IDs]` confere que:
1. o estado inicial falha em ao menos 1 teste oculto;
2. a referência passa em 100% dos testes públicos e ocultos;
3. os nomes dos testes ocultos batem com o manifesto.

## Tipos de tarefa

| Tipo | Descrição | Alvo típico na aplicação | Referência |
|---|---|---|---|
| T1 | Correção de defeito em regra de negócio | `precos`, `estoque`, `pedidos` | aplicação-base (defeito injetado) |
| T2 | Nova funcionalidade com requisitos especificados | novo módulo ou função | `referencia/` obrigatório |
| T3 | Consulta SQL com resultado incorreto | `relatorios` | aplicação-base (defeito injetado) |
| T4 | Robustez da importação (validação, exceções, casos de borda) | `etl` | `referencia/` ou base |

## Critérios de equivalência entre gêmeas (a e b)

As gêmeas de um par devem ter:
- o mesmo tipo;
- o mesmo número de testes ocultos e a mesma distribuição de severidade (±1);
- um tamanho de solução de referência parecido (linhas alteradas, ±30%);
- um enunciado de extensão parecida;
- **defeitos e funções diferentes, em módulos diferentes**, para que resolver uma não entregue a solução da outra.

O sorteio de qual gêmea recebe IA neutraliza diferenças residuais de dificuldade.

## Procedimento para produzir as tarefas PRINCIPAIS (sem que o executor as veja)

O executor (autor do TCC) **não pode** escrever, ler nem revisar as tarefas principais antes de executá-las.

1. **Autoria:** um terceiro produz os pacotes num diretório fora deste repositório. Pode ser o orientador, um colega ou uma sessão de IA conduzida por outra pessoa, ou por você sem ler a saída. Os pacotes incluem uma **variante selada da aplicação-base** (domínio análogo, código diferente), porque a aplicação-base pública contém a versão correta do código.
2. **Validação:** essa pessoa roda `exp validar-tarefa` com `TCC_FASE=principal` e `TCC_TAREFAS_DIR=<dir>`. Tudo precisa sair OK.
3. **Selagem:** essa pessoa roda `exp selar`, que gera `experiment/tasks/selos-principal.json` só com os hashes. Esse arquivo pode ser versionado, porque não revela o conteúdo.
4. **Pares:** `experiment/tasks/pares-principal.toml` lista apenas IDs e tipos (sem conteúdo) e pode ser versionado.
5. **Guarda:** o diretório fica numa pasta que o executor se compromete a não abrir. O ideal é uma cópia de segurança com o orientador.
6. **Execução:** `exp abrir` confere o selo antes de montar o workspace e recusa pacotes alterados.
7. **Depois da coleta:** os pacotes podem ser publicados num apêndice ou repositório, para reprodutibilidade.
