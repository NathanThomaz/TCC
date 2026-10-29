# Validação do mapa do sistema

> **Local:** documento movido de `docs/forja/validacao.md` para o vault em 28/10/2026 (entrada 010 do registro). Caminhos citados no texto que começam com `docs/forja/` são históricos: o exemplo da padaria está em `tests/forja/dados/` e o contrato em `src/forja/contrato/`.

**Status:** IMPLEMENTADO no Marco 1, etapa 2 (2026-10-28), na branch `forja-marco-1`.
**Código:** `src/forja/`. **Testes:** `tests/forja/` (111 testes).

> **O que existe:** validação de um mapa (contrato v0.2) em duas camadas, catálogo de códigos, linha de comando e testes.
> **O que ainda NÃO existe:** interface, IA local (Ollama) e motor de geração. A validação confere o **mapa**. Ela não executa nenhum sistema gerado.

## Como usar

```bash
pip install -e ".[forja]"          # instala o jsonschema (já presente nesta máquina: 4.24.0)
python -m forja validar tests/forja/dados/exemplo-padaria.mapa.json
python -m forja validar meu-mapa.json --json      # saída em JSON
```

```python
from forja.validacao import validar, validar_arquivo, tem_erros
erros = validar_arquivo("tests/forja/dados/exemplo-padaria.mapa.json")   # [] para a padaria
```

Exemplo real de saída (padaria com dois defeitos introduzidos de propósito):

```
ERRO  REF_CAMPO_INEXISTENTE            /regras/1/condicao/dir/campo  O caminho 'produto.estoqe' não existe a partir de 'item_venda': 'estoqe' não é campo nem relacionamento de 'produto'.
ERRO  CICLO_DE_CALCULO                 /regras/2/expressao  Cálculos em círculo: item_venda.subtotal → venda.total → item_venda.subtotal.
INVÁLIDO: 2 erro(s), 0 aviso(s).
```

| Código de saída | Significado |
|---|---|
| 0 | Válido (pode ter avisos) |
| 1 | Há erros |
| 2 | Arquivo ilegível ou JSON quebrado |

## Camadas

| Camada | Arquivo | O que confere |
|---|---|---|
| Estrutural | `src/forja/estrutural.py` | Versão do mapa (`VERSAO_NAO_SUPORTADA`) e a **forma**, contra o contrato JSON Schema 2020-12 (`src/forja/contrato/`). Os erros do jsonschema viram `ESQUEMA_<palavra-chave>` (ex.: `ESQUEMA_REQUIRED`) |
| Semântica | `src/forja/semantica.py` (+ `caminhos.py`) | O **sentido**: referências, caminhos, tipos, cálculos e ciclos, ações, ciclo de vida, telas, perfis, testes de aceitação, datas |
| Orquestração | `src/forja/validacao.py` | Roda a estrutural. Se ela tiver erros, **para** (evita erros em cascata). Senão, roda a semântica |

**Expressões:** são percorridas como árvore de dados. **Não há `eval`, `exec` nem `compile`**, e um teste (`test_nenhum_eval_exec_ou_compile_no_pacote`) varre o código para garantir isso.

**Caminhos** (`caminhos.py`), como `produto.estoque` ou `cliente.saldo_fiado`, são percorridos segmento a segmento:
- um campo só pode aparecer no fim;
- relacionamento "para um" leva a um registro;
- relacionamento "para muitos" leva a uma coleção, que só pode estar no fim (para agregações e `para_cada`).

**Tipos:** são agrupados em famílias.

| Família | Tipos |
|---|---|
| número | inteiro, decimal, moeda |
| texto | texto, texto longo, telefone, e-mail, opções |
| data | data, data e hora |
| booleano | booleano |

Regras de tipo:
- Contas só aceitam números.
- `<`, `<=`, `>` e `>=` só valem entre números ou entre datas. Um texto literal que seja uma data ISO conta como data.
- `=` e `!=` exigem a mesma família, ou `null`.

## Formato do erro

```json
{
  "codigo": "REF_CAMPO_INEXISTENTE",
  "caminho": "/regras/1/condicao/dir/campo",
  "mensagem": "O caminho 'produto.estoqe' não existe a partir de 'item_venda': ...",
  "severidade": "erro",
  "camada": "semantica",
  "detalhes": { "valor": "produto.estoqe", "sugestoes": ["estoque"] }
}
```

- **`caminho`:** JSON Pointer (RFC 6901) que aponta para o ponto exato do mapa. Os testes conferem que todo caminho existe no documento.
- **`severidade`:** vem sempre do catálogo; quem gera o erro não escolhe.
- **Ordenação determinística:** por caminho (índices em ordem **numérica**: `/regras/2` antes de `/regras/10`), depois por código, depois por mensagem. Validar duas vezes dá o mesmo resultado.

## Catálogo de códigos (48)

Gerado a partir de `forja.erros.CATALOGO`. Todos os 48 códigos são exercitados em `tests/forja/`.

| Código | Severidade | Significado |
|---|---|---|
| `VERSAO_NAO_SUPORTADA` | erro | versao_mapa diferente da versão do contrato |
| `DATA_INVALIDA` | erro | data ou data-hora fora do formato ISO 8601 |
| `ID_DUPLICADO` | erro | identificador repetido no mesmo conjunto |
| `NOME_CONFLITANTE` | erro | nome de relacionamento igual a campo ou a outro relacionamento da entidade |
| `REF_ENTIDADE_INEXISTENTE` | erro | entidade citada não existe |
| `REF_CAMPO_INEXISTENTE` | erro | campo citado não existe na entidade |
| `REF_RELACIONAMENTO_INEXISTENTE` | erro | relacionamento citado não existe |
| `REF_TELA_INEXISTENTE` | erro | tela citada no menu não existe |
| `REF_REGRA_INEXISTENTE` | erro | regra citada não existe |
| `REF_ESTADO_INEXISTENTE` | erro | estado citado não existe no ciclo de vida |
| `REF_TRANSICAO_INEXISTENTE` | erro | transição citada não existe no ciclo de vida |
| `CAMINHO_INVALIDO` | erro | caminho não percorre campos e relacionamentos válidos |
| `COLECAO_ONDE_SE_ESPERA_VALOR` | erro | caminho termina numa coleção onde se espera um valor |
| `AGREGACAO_SEM_COLECAO` | erro | agregação sobre algo que não é coleção |
| `AGREGACAO_SEM_EXPRESSAO` | erro | soma, mínimo ou máximo sem o valor a agregar |
| `PARA_CADA_INVALIDO` | erro | para_cada não aponta para uma coleção |
| `TIPO_INCOMPATIVEL` | erro | operação entre tipos incompatíveis |
| `CONDICAO_NAO_BOOLEANA` | erro | condição ou filtro que não resulta em verdadeiro/falso |
| `VALOR_FORA_DAS_OPCOES` | erro | valor não pertence à lista de opções do campo |
| `CALCULO_TIPO_INCOMPATIVEL` | erro | expressão do cálculo incompatível com o tipo do campo |
| `ACAO_TIPO_INCOMPATIVEL` | erro | valor da ação incompatível com o campo alvo |
| `CALCULADO_SEM_REGRA` | erro | campo de origem 'calculo' sem regra de cálculo |
| `CALCULO_DUPLICADO` | erro | mais de uma regra de cálculo para o mesmo campo |
| `CALCULO_EM_CAMPO_NAO_CALCULADO` | erro | regra de cálculo em campo que não tem origem 'calculo' |
| `CICLO_DE_CALCULO` | erro | cálculos que dependem uns dos outros em círculo |
| `ACAO_ALTERA_CALCULADO` | erro | ação alterando campo de origem 'calculo' |
| `ACAO_ALTERA_ESTADO` | erro | ação alterando campo de estado (só transições o alteram) |
| `CAMPO_ACAO_SEM_ACAO` | erro | campo de origem 'acao' que nenhuma ação altera |
| `REVERTER_EM_TRANSICAO` | erro | reverter_ao_excluir em ação disparada por transição |
| `ACAO_EM_EDICAO_NAO_SUPORTADA` | erro | ação disparada por edição (não suportada no MVP, P3) |
| `REGRA_DUPLICADA` | erro | id de regra repetido |
| `REGRA_EQUIVALENTE` | aviso | regra idêntica a outra, exceto id e textos |
| `CAMPO_ESTADO_INVALIDO` | erro | campo de estado incoerente com o ciclo de vida |
| `ESTADO_INICIAL_INEXISTENTE` | erro | estado inicial não está entre os estados |
| `TRANSICAO_DE_ESTADO_FINAL` | erro | transição saindo de estado final |
| `ESTORNO_INVALIDO` | erro | transição de estorno incoerente com a transição estornada |
| `EXCLUSAO_COM_EFEITOS` | erro | estado alcançado por transição com efeitos permite exclusão |
| `GATILHO_SEM_CICLO` | erro | regra disparada por transição em entidade sem ciclo de vida |
| `DETALHE_INVALIDO` | erro | detalhe não é relacionamento que parte da entidade |
| `ESTADO_INALCANCAVEL` | aviso | estado que nenhuma transição alcança a partir do inicial |
| `PERFIL_ENTIDADE_INEXISTENTE` | erro | perfil cita entidade inexistente |
| `PERFIL_SEM_ENTIDADE` | aviso | entidade que nenhum perfil cita |
| `TESTE_REF_INDEFINIDA` | erro | @ref usada antes de ser criada |
| `TESTE_REF_ENTIDADE_INCOMPATIVEL` | erro | @ref aponta para registro de outra entidade |
| `TESTE_CAMPO_PROTEGIDO` | erro | campo protegido em 'dados' (use 'forcar' na preparação) |
| `FORCAR_CAMPO_DE_USUARIO` | erro | 'forcar' em campo de origem 'usuario' |
| `TESTE_TRANSICAO_INEXISTENTE` | erro | passo de teste com transição inexistente na entidade |
| `CAMPO_CALCULADO_OBSOLETO` | aviso | 'calculado: true' é obsoleto; use origem 'calculo' |

Além destes, os erros estruturais usam `ESQUEMA_<palavra-chave do JSON Schema>`.

## Limitações conhecidas
1. **Mensagens estruturais.**
   - O resumo dos erros da camada estrutural está em português.
   - O texto detalhado vem do jsonschema, em inglês, e fica em `detalhes.mensagem_original`.
   - Erros de `oneOf` (por exemplo, numa regra) apontam para a regra inteira, não para a propriedade exata.
2. **Valores que não são conferidos:**
   - o **tipo** dos valores em `padrao` e em `dados` dos testes, exceto opções e datas (ex.: `"preco": "abc"` não é acusado);
   - `min` ≤ `max`;
   - a **semântica de execução** (estorno exato, cancelamento sem duplicidade, "tudo ou nada"). Ela depende do motor (planejado). Aqui só se confere que o mapa a **expressa** corretamente.
3. **`PERFIL_SEM_ENTIDADE`** avisa quando **nenhum** perfil cita a entidade. Não avisa por perfil individual.
4. **Mestre-detalhe com "para muitos" no meio do caminho** (ex.: `itens.produto.nome`) não é aceito. Coleções só no fim do caminho.
