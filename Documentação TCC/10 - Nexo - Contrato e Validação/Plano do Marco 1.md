# Forja — Marco 1: plano de contrato e validação semântica

> **Local:** documento movido de `docs/forja/plano-marco-1.md` para o vault em 28/10/2026 (entrada 010 do registro). Caminhos citados no texto que começam com `docs/forja/` são históricos: o exemplo da padaria está em `tests/forja/dados/` e o contrato em `src/forja/contrato/`.

**Data:** 2026-10-28
**Status:** PLANO. **Nada foi implementado ainda.** Aguarda aprovação, inclusive das decisões pendentes P1 a P9 (seção 10).
**Escopo:** revisar o contrato do mapa do sistema e preparar uma validação estrutural e semântica que possa ser repetida por qualquer pessoa. **Fora do escopo:** interface, Ollama e motor de geração.

> **Como ler este documento**
> - Cada seção começa com um quadro **"Em palavras simples"**, que explica a ideia antes dos detalhes técnicos.
> - Os termos técnicos estão no **glossário** (seção 11).
> - **[CONFIRMADO]** marca decisões que você já tomou.
> - **[PENDENTE]** marca decisões que ainda precisam da sua aprovação.
> - **[PLANEJADO]** marca o que só existirá quando o motor de geração for construído.

---

## 1. Ponto de partida: os arquivos atuais

> **Em palavras simples:** hoje existem três arquivos da Forja:
> - um "contrato", que diz como um mapa de sistema deve ser escrito;
> - um exemplo de mapa (a padaria da Ana);
> - um README.
>
> Nenhum código da Forja existe. O contrato confere só a **forma** do mapa (se os campos certos estão lá), mas não a **coerência** (se as coisas citadas existem e fazem sentido juntas).

| Arquivo | Conteúdo | Situação |
|---|---|---|
| `docs/forja/mapa-do-sistema.schema.json` | Contrato v0.1 (JSON Schema Draft 2020-12) | Existe; sem alteração desde 28/10 às 14:46 |
| `docs/forja/exemplo-padaria.mapa.json` | Mapa de exemplo da padaria | Existe; passa no contrato v0.1 |
| `docs/forja/README.md` | Explicação, matriz de suporte, questões em aberto | Existe |

---

## 2. Problemas encontrados no contrato v0.1

> **Em palavras simples:** o contrato atual não consegue dizer que uma venda começa como **rascunho** e só mexe no estoque quando é **concluída**. Também mistura dois tipos de campo "automático" e deixa os testes alterarem campos que o usuário não deveria alterar.

| Ponto | Como está no v0.1 | Por que é um problema |
|---|---|---|
| Ciclo de vida da venda | Não existe. As regras só disparam ao criar, editar ou excluir um registro | Não há como representar "rascunho" e "concluída" (decisões 1 e 2) |
| Baixa de estoque e soma do fiado | Acontecem ao **criar** a venda ou o item | Precisam acontecer ao **concluir** a venda (decisão 2) |
| Desfazer efeitos | `reverter_ao_excluir`: desfaz quando o registro é excluído | Venda concluída não pode ser excluída, só **cancelada** (decisão 3). Também não há proteção contra desfazer duas vezes (decisão 4) |
| Campo "calculado" | `calculado: true` é usado com dois sentidos: `total` (calculado por fórmula) e `saldo_fiado` (acumulado por ação) | Não dá para exigir ao mesmo tempo "todo calculado tem fórmula" e "ação não mexe em calculado" |
| Testes | O teste do fiado grava `saldo_fiado` direto, como se fosse um cadastro comum | Contradiz a decisão 6: preparar campos protegidos precisa ser explícito e isolado |
| Coerência | Não existe validação de coerência | **Testado:** o contrato aceita uma regra que aponta para uma entidade e um campo inexistentes |
| Data e hora | O contrato declara `format: date-time` | A biblioteca `jsonschema` só confere esse formato com um pacote extra, que não está instalado. Hoje, na prática, a data não é conferida |

---

## 3. Mudanças mínimas no contrato (v0.1 → v0.2)

> **Em palavras simples:** o mapa ganha cinco coisas:
> - os "estados" de um registro (rascunho, concluída, cancelada) e as passagens entre eles;
> - uma etiqueta que diz **quem pode mudar cada campo**;
> - regras que disparam nessas passagens;
> - regras que valem "para cada item" da venda;
> - um espaço próprio nos testes para preparar dados especiais.

### 3.1 Ciclo de vida (opcional, por entidade)

```json
"ciclo_de_vida": {
  "campo": "situacao",
  "inicial": "rascunho",
  "estados": [
    { "id": "rascunho",  "nome": "Rascunho",  "editavel": true,  "excluivel": true },
    { "id": "concluida", "nome": "Concluída", "editavel": false, "excluivel": false },
    { "id": "cancelada", "nome": "Cancelada", "editavel": false, "excluivel": false, "final": true }
  ],
  "transicoes": [
    { "id": "concluir", "nome": "Concluir venda", "de": ["rascunho"],  "para": "concluida" },
    { "id": "cancelar", "nome": "Cancelar venda", "de": ["concluida"], "para": "cancelada", "estorna": "concluir" }
  ],
  "detalhes": ["venda_itens"]
}
```

Lendo o exemplo:
- **`campo`**: o campo da venda que guarda o estado atual (`situacao`).
- **`inicial`**: toda venda nasce como `rascunho`.
- **`estados`**: em cada estado, se a venda pode ser editada ou excluída. `final` indica que dali não se sai mais.
- **`transicoes`**: as passagens permitidas.
  - `concluir` só a partir de `rascunho`.
  - `cancelar` só a partir de `concluida`.
- **`estorna: "concluir"`**: cancelar desfaz tudo o que `concluir` fez com aquela venda.
- **`detalhes`**: os itens da venda seguem a venda. Se a venda não pode ser editada, os itens também não podem.

### 3.2 Origem de cada campo (quem pode alterar)

| `origem` | Quem altera | Exemplo na padaria |
|---|---|---|
| `usuario` (padrão) | O usuário na tela. Ações também podem alterar | `estoque`, `nome`, `preco` |
| `calculo` | Somente uma regra de cálculo | `total`, `subtotal` |
| `acao` | Somente ações | `saldo_fiado` |
| `estado` | Somente transições | `situacao` |

Na aplicação gerada, **apenas campos `usuario` aparecem editáveis** (decisão 5 [CONFIRMADO]).

### 3.3 Novos gatilhos e "para cada"
- **`transicoes`**: as regras de restrição e de ação passam a aceitar `"transicoes": ["concluir"]` além de `"eventos": ["criar", ...]`. Toda regra precisa ter pelo menos um dos dois.
- **`para_cada`**: aplica a regra a cada item de uma coleção. Exemplo: ao concluir a venda, baixar o estoque **para cada item** da venda.

### 3.4 Testes
- Passos ganham a ação **transição**: `{"acao": "transicao", "transicao": "concluir", "alvo": "@v1"}`.
- Testes ganham um bloco **`preparacao`**. É o único lugar onde **`forcar`** pode dar valor a campos protegidos (detalhes na seção 8).

### 3.5 Outros
- O relatório ganha `filtro` opcional, por exemplo para contar só vendas concluídas.
- `versao_mapa` passa a ser `"0.2"`.

### 3.6 O exemplo da padaria depois da mudança

| Elemento | Antes (v0.1) | Depois (v0.2) |
|---|---|---|
| `venda` | Sem estados | Campo `situacao` (`origem: estado`) + ciclo de vida da seção 3.1 |
| `total`, `subtotal` | `calculado: true` | `origem: "calculo"` |
| `saldo_fiado` | `calculado: true` (e alterado por ação: contraditório) | `origem: "acao"` |
| `r_baixa_estoque` | Na entidade `item_venda`, ao **criar** | Na entidade `venda`, na transição **`concluir`**, `para_cada: "itens"`, alvo `produto.estoque` |
| `r_soma_fiado` | Ao **criar** a venda | Na transição **`concluir`** |
| `r_limite_fiado` | Ao criar ou editar | Na transição **`concluir`** |
| `r_estoque_suficiente` | Ao criar ou editar o item | Na transição **`concluir`**, para cada item |
| Indicador "Vendas do dia" | Todas as vendas | Só `situacao = concluida` |
| Teste do fiado | Grava `saldo_fiado` em `dados` | Usa `preparacao` + `forcar`, depois a transição `concluir` |
| Testes novos | — | Rascunho não mexe no estoque; cancelar estorna; cancelar duas vezes é recusado; venda concluída não pode ser excluída |

### 3.7 Compatibilidade e migração

| v0.1 | v0.2 | Continua funcionando? |
|---|---|---|
| `calculado: true` | `origem: "calculo"` | **Sim.** Aceito como sinônimo antigo, com aviso `CAMPO_CALCULADO_OBSOLETO` |
| `eventos` | Mantido | Sim |
| `reverter_ao_excluir` | Mantido só para ações disparadas ao criar | Sim, em mapas sem ciclo de vida |
| `versao_mapa: "0.1"` | `"0.2"` | **Não.** Erro `VERSAO_NAO_SUPORTADA`, com mensagem que aponta esta tabela |
| `saldo_fiado` calculado e alterado por ação | `origem: "acao"` | **Não: incompatibilidade necessária.** É justamente o caso que os critérios mandam rejeitar |

**Migração proposta:** só existe um mapa (a padaria), então ele é migrado à mão, e a tabela fica documentada no README. Um script automático de migração não é necessário agora (pendência P9).

---

## 4. Estados e transições: eventos de domínio × operações CRUD

> **Em palavras simples:** há dois jeitos de mexer numa venda.
> - **Operações CRUD:** é o "mexer no cadastro". Criar, editar ou excluir a venda, ou incluir e remover itens. Só é permitido enquanto ela é rascunho.
> - **Eventos de domínio:** são as ações de negócio com nome, como "Concluir venda" e "Cancelar venda". São elas que mexem no estoque e no fiado.

| | Operações CRUD | Eventos de domínio (transições) |
|---|---|---|
| O que são | Criar, editar, excluir um registro | Ações de negócio com nome: `concluir`, `cancelar` |
| Quando são permitidas | Só se o estado atual permitir (`editavel` / `excluivel`) | Só se o estado atual estiver na lista `de` da transição |
| Efeitos em outros registros | Só ações ligadas a criar ou excluir | Ações ligadas à transição |
| Exemplo | Incluir um item numa venda em rascunho | Concluir a venda: baixa o estoque e soma o fiado |

### Regras de funcionamento
Todas são [PLANEJADO]: serão implementadas e testadas quando o motor existir. Agora elas só ficam documentadas.

1. **Tudo ou nada (atomicidade).** Ao concluir uma venda, o sistema confere as restrições, aplica as ações e muda o estado como uma operação única. Se qualquer coisa falhar (por exemplo, o estoque ficaria negativo, violando `min: 0`), **nada** é aplicado. Isso também cobre o caso de dois itens do mesmo produto que, somados, passam do estoque.
2. **Registro de efeitos.** Cada efeito aplicado é anotado: qual venda, qual transição, qual regra, qual valor. O cancelamento desfaz **exatamente o que foi anotado**, sem recalcular a regra. Assim o estorno fica correto mesmo que o preço do produto mude depois.
3. **Sem estorno duplicado** (decisão 4 [CONFIRMADO]). Há duas proteções:
   - **no mapa, verificável já neste marco:** `cancelar` só sai de `concluida`, e `cancelada` é um estado final;
   - **na execução, [PLANEJADO]:** cada efeito anotado só pode ser desfeito uma vez.
4. **Não excluir o que já teve efeito** (decisão 3 [CONFIRMADO]). Todo estado alcançado por uma transição que tem ações precisa ter `excluivel: false`. O validador impõe isso.

> **Limite honesto deste marco:** como o motor não existe, os testes vão provar que o mapa **consegue expressar** as decisões e que o validador **impõe as regras do mapa**. Nenhum teste vai afirmar que o cancelamento funciona de verdade num sistema rodando.

---

## 5. Validação semântica

> **Em palavras simples:** a validação acontece em duas etapas.
> 1. **Estrutural:** confere a forma (os campos certos estão no lugar certo?).
> 2. **Semântica:** confere o sentido (o que é citado existe? os tipos combinam? há fórmulas que dependem delas mesmas em círculo?).
>
> Se a forma estiver errada, a segunda etapa nem roda, para não gerar uma enxurrada de erros confusos.

**Princípio:** as expressões das regras são lidas como **árvore de dados** e **nunca executadas como código**. Não há `eval` (decisão 7 [CONFIRMADO]).

| Grupo | O que é conferido | Códigos de erro |
|---|---|---|
| Identificadores | Nada repetido (entidades, campos, relacionamentos, regras, telas, perfis, testes, estados, transições); nome de relacionamento não pode coincidir com nome de campo | `ID_DUPLICADO`, `NOME_CONFLITANTE` |
| Referências | Tudo o que é citado existe | `REF_ENTIDADE_INEXISTENTE`, `REF_CAMPO_INEXISTENTE`, `REF_RELACIONAMENTO_INEXISTENTE`, `REF_TELA_INEXISTENTE`, `REF_REGRA_INEXISTENTE`, `REF_ESTADO_INEXISTENTE`, `REF_TRANSICAO_INEXISTENTE` |
| Caminhos | Um caminho como `produto.estoque` é percorrido pelos relacionamentos até chegar a um valor ou a uma lista | `CAMINHO_INVALIDO`, `COLECAO_ONDE_SE_ESPERA_VALOR`, `AGREGACAO_SEM_COLECAO`, `PARA_CADA_INVALIDO` |
| Tipos | Contas só com números; comparações de ordem (`<`, `>`) só entre números ou datas; condições precisam resultar em sim/não; valor comparado a uma lista de opções precisa estar na lista | `TIPO_INCOMPATIVEL`, `CONDICAO_NAO_BOOLEANA`, `VALOR_FORA_DAS_OPCOES`, `CALCULO_TIPO_INCOMPATIVEL`, `ACAO_TIPO_INCOMPATIVEL` |
| Cálculos | Todo campo calculado tem **exatamente uma** fórmula; nenhuma fórmula em campo que não é calculado; nenhum círculo de dependência | `CALCULADO_SEM_REGRA`, `CALCULO_DUPLICADO`, `CALCULO_EM_CAMPO_NAO_CALCULADO`, `CICLO_DE_CALCULO` |
| Ações | Ação não altera campo calculado nem campo de estado; campo de origem `acao` precisa ter alguma ação que o altere | `ACAO_ALTERA_CALCULADO`, `ACAO_ALTERA_ESTADO`, `CAMPO_ACAO_SEM_ACAO`, `REVERTER_EM_TRANSICAO` |
| Regras | Sem id repetido; aviso para regras idênticas | `REGRA_DUPLICADA`, `REGRA_EQUIVALENTE` (aviso) |
| Ciclo de vida | Campo de estado coerente com a lista de estados; estado inicial existe; nada sai de estado final; estorno coerente; estado com efeitos não pode ser excluível | `CAMPO_ESTADO_INVALIDO`, `ESTADO_INICIAL_INEXISTENTE`, `TRANSICAO_DE_ESTADO_FINAL`, `ESTORNO_INVALIDO`, `EXCLUSAO_COM_EFEITOS`, `GATILHO_SEM_CICLO`, `DETALHE_INVALIDO`, `ESTADO_INALCANCAVEL` (aviso) |
| Telas e perfis | Campos, filtros e indicadores das telas existem e têm o tipo certo; perfis citam entidades existentes | `PERFIL_ENTIDADE_INEXISTENTE`, `PERFIL_SEM_ENTIDADE` (aviso) |
| Testes | `@ref` usada só depois de criada; nenhum campo protegido em `dados`; `forcar` só para campos protegidos; transição existe | `TESTE_REF_INDEFINIDA`, `TESTE_CAMPO_PROTEGIDO`, `FORCAR_CAMPO_DE_USUARIO`, `TESTE_TRANSICAO_INEXISTENTE` |
| Formatos | Datas válidas, conferidas pelo Python, sem pacote extra | `DATA_INVALIDA` |

### Exemplo de ciclo de cálculo
- `venda.total` é a soma de `item_venda.subtotal`.
- Se `subtotal` passasse a depender de `venda.total`, haveria um círculo sem fim.
- O validador acusa `CICLO_DE_CALCULO` e mostra o caminho: `venda.total → item_venda.subtotal → venda.total`.

---

## 6. Como o erro é informado

> **Em palavras simples:** cada problema encontrado vira um registro com:
> - um **código** fixo, bom para testes e para a IA corrigir;
> - o **endereço** exato no arquivo;
> - uma **mensagem** em português;
> - se é **erro** ou só **aviso**.

```python
@dataclass(frozen=True)
class ErroValidacao:
    codigo: str        # "REF_CAMPO_INEXISTENTE"
    caminho: str       # endereço no arquivo (JSON Pointer): "/regras/0/condicao/dir/campo"
    mensagem: str      # "O caminho 'produto.estoqe' não existe em 'item_venda'."
    severidade: str    # "erro" | "aviso"
    camada: str        # "estrutural" | "semantica"
    detalhes: dict     # opcional: {"valor": "produto.estoqe", "sugestoes": ["produto.estoque"]}
```

Exemplo de saída em JSON:
```json
[
  {
    "codigo": "REF_CAMPO_INEXISTENTE",
    "caminho": "/regras/0/condicao/dir/campo",
    "mensagem": "O caminho 'produto.estoqe' não existe em 'item_venda'.",
    "severidade": "erro",
    "camada": "semantica",
    "detalhes": { "valor": "produto.estoqe", "sugestoes": ["produto.estoque"] }
  }
]
```

- **Ordem sempre igual:** primeiro por caminho, depois por código.
- **Erros estruturais** (vindos do `jsonschema`) são convertidos para o mesmo formato, com código `ESQUEMA_<regra>` (ex.: `ESQUEMA_REQUIRED`).
- **Como rodar:** `python -m forja validar <mapa.json> [--json]`
- **Resultado do comando:**

| Código de saída | Significado |
|---|---|
| 0 | Mapa válido (pode ter avisos) |
| 1 | Mapa com erros |
| 2 | Arquivo ilegível ou JSON quebrado |

---

## 7. Plano de testes

> **Em palavras simples:** para cada regra do validador, haverá um teste que pega o mapa da padaria (válido), **estraga um único ponto** e confere se o validador acusa exatamente o erro esperado, no lugar esperado. Também há testes provando que o mapa correto passa sem erros.

| Arquivo (em `tests/forja/`) | O que testa |
|---|---|
| `conftest.py` | Carrega o mapa da padaria; função `mutar(mapa, alteração)` que copia o mapa e muda um único ponto |
| `test_estrutural.py` | O contrato é um JSON Schema 2020-12 válido; a padaria passa; cerca de 12 casos inválidos (os 8 já testados antes + `forcar` fora da preparação, passo de transição incompleto, ciclo de vida sem estado inicial, origem desconhecida, versão 0.1) |
| `test_semantica.py` | A padaria tem **0 erros** e os avisos esperados listados exatamente; um caso inválido **para cada código** da seção 5, conferindo código e endereço. Inclui todos os critérios de aceitação: referência inexistente, calculado sem fórmula, regra duplicada, ciclo direto e ciclo via soma, ação alterando calculado |
| `test_ciclo_de_vida.py` | Garantias do mapa: cancelar só a partir de concluída; estado final sem saída; estado com efeitos não excluível; regra de transição exige ciclo de vida; `detalhes` aponta para relacionamento da própria entidade |
| `test_erros.py` | Formato do erro; o endereço aponta de fato para algo no arquivo; ordem determinística; códigos de saída 0, 1 e 2; saída `--json` legível |

**Regra:** nenhum teste é declarado como aprovado sem ter sido executado. Os **45 testes atuais** do projeto anterior precisam continuar passando, sem alteração.

---

## 8. Preparar campos protegidos só nos testes (decisão 6)

> **Em palavras simples:** para testar o limite de fiado, é preciso começar com um cliente que já deve R$ 180. Esse valor normalmente só é criado por vendas. O teste ganha um jeito **explícito e separado** de "plantar" esse valor. Esse jeito **nunca** existe no sistema que vai para a loja.

- **No contrato** (será validado neste marco):
  - `forcar` só é aceito dentro de `testes_aceitacao[].preparacao[]`;
  - só vale para campos com origem `calculo`, `acao` ou `estado`;
  - campos protegidos dentro de `passos.dados` geram `TESTE_CAMPO_PROTEGIDO`.
- **No motor** [PLANEJADO]:
  - a preparação será feita por um **preparador de testes** que grava direto no banco de teste;
  - esse preparador é gerado **apenas no pacote de testes**;
  - o sistema publicado (telas e API) **não terá** nenhuma opção, rota ou parâmetro para gravar campos protegidos.
- **Verificação futura** [PLANEJADO]: um item a mais no checklist da prova offline (portão G1) confere que o pacote publicado não contém o preparador.

Exemplo de teste com preparação:
```json
{
  "id": "t_limite_fiado",
  "preparacao": [
    { "entidade": "cliente", "ref": "joao", "dados": { "nome": "João", "limite_fiado": 200 },
      "forcar": { "saldo_fiado": 180 } }
  ],
  "passos": [
    { "acao": "criar", "entidade": "produto", "ref": "bolo", "dados": { "nome": "Bolo", "preco": 30, "estoque": 5 } },
    { "acao": "criar", "entidade": "venda", "ref": "v1", "dados": { "data": "2026-11-02T09:00:00", "forma_pagamento": "fiado", "cliente": "@joao" } },
    { "acao": "criar", "entidade": "item_venda", "dados": { "venda": "@v1", "produto": "@bolo", "quantidade": 1, "preco_unitario": 30 } },
    { "acao": "transicao", "transicao": "concluir", "alvo": "@v1" }
  ],
  "esperado": { "resultado": "erro", "mensagem_contem": "limite de fiado" }
}
```

---

## 9. Arquivos que serão criados ou modificados

> **Em palavras simples:** será criado um pacote novo, `forja`, separado do projeto antigo (`tcc_exp`), que não é tocado. O contrato passa a morar dentro desse pacote, para existir uma única cópia oficial.

| Arquivo | Ação | Critério de aceitação |
|---|---|---|
| `src/forja/__init__.py` | criar | Pacote novo, isolado do `tcc_exp`; a descrição declara o escopo: só contrato e validação |
| `src/forja/contrato/mapa-do-sistema.schema.json` | criar (movido de `docs/forja/`, v0.2) | Validado como JSON Schema Draft 2020-12; é a **única** cópia do contrato |
| `src/forja/erros.py` | criar | `ErroValidacao` + catálogo de códigos; nenhum código fora do catálogo |
| `src/forja/caminhos.py` | criar | Percorre caminhos e descobre tipos, sem `eval` |
| `src/forja/estrutural.py` | criar | Etapa 1 (forma), resultado em ordem fixa |
| `src/forja/semantica.py` | criar | Etapa 2 (sentido), todas as verificações da seção 5 |
| `src/forja/__main__.py` | criar | Comando `python -m forja validar`, com os códigos de saída da seção 6 |
| `pyproject.toml` | modificar | Grupo opcional `forja = ["jsonschema>=4.18,<5"]` + inclusão do arquivo do contrato no pacote; dependências do `tcc_exp` intocadas |
| `docs/forja/mapa-do-sistema.schema.json` | remover | Evita duas cópias do contrato; o README aponta para o novo local |
| `docs/forja/exemplo-padaria.mapa.json` | modificar (v0.2) | Passa nas duas etapas; representa as decisões 1 a 6; inclui os testes novos da seção 3.6 |
| `docs/forja/ciclo-de-vida.md` | criar | Seção 4 completa, com cada decisão marcada como confirmada ou pendente |
| `docs/forja/validacao.md` | criar | Catálogo de códigos, formato do erro, comando, códigos de saída |
| `docs/forja/README.md` | modificar | Tabela **implementado × planejado**; migração 0.1 → 0.2; como validar e testar |
| `tests/forja/*.py` | criar | Seção 7, executados de verdade, com o resultado real relatado |
| `docs/proposta-v2-gerador-de-sistemas.md` | modificar (mínimo) | §4.0 aponta para o novo local do contrato e para o status real |
| Vault `Documentação TCC/` | modificar | Registro da sessão e ponto de parada atualizados |

**Não serão tocados:** `src/tcc_exp/`, `experiment/`, os testes existentes, a interface, o Ollama e o motor de geração.

**Sobre a dependência `jsonschema`:**
- **Por que ela:** é a implementação de referência do JSON Schema 2020-12 para Python.
- **Por que não pesa:** a versão 4.24.0 já está instalada na sua máquina, então não há instalação nova.
- **Onde fica declarada:** num grupo opcional (`pip install -e ".[forja]"`), para não afetar o projeto antigo.
- **O que não será adicionado:** o pacote extra de datas (`rfc3339-validator`). As datas são conferidas pelo próprio validador.

---

## 10. Decisões

### Confirmadas por você [CONFIRMADO]
1. Uma venda começa como rascunho.
2. A venda só movimenta estoque e financeiro quando é concluída.
3. Uma venda concluída não pode ser excluída diretamente. Deve ser cancelada, com estorno dos efeitos originais.
4. O cancelamento não pode produzir estornos duplicados.
5. Campos calculados não podem ser editados na aplicação normal.
6. Testes podem preparar valores iniciais de campos calculados por um mecanismo explícito, isolado do sistema publicado.
7. Expressões de regras permanecem estruturadas e nunca são executadas por `eval`.
8. O modo com IA e o modo guiado produzem o mesmo formato de mapa.

### Pendentes, aguardando a sua aprovação [PENDENTE]

| # | Pergunta | Recomendação | Por quê |
|---|---|---|---|
| P1 | Onde fica o contrato oficial? | Dentro do pacote (`src/forja/contrato/`); em `docs/` ficam só o exemplo e a documentação | Uma única cópia; o validador o encontra mesmo depois de instalado |
| P2 | Como marcar campos "automáticos"? | Campo `origem` (`usuario`, `calculo`, `acao`, `estado`); `calculado: true` continua aceito como sinônimo antigo, com aviso | Separa fórmula de acumulado e preserva a compatibilidade |
| P3 | Ações disparadas ao **editar** um registro? | Proibir no MVP (erro `ACAO_EM_EDICAO_NAO_SUPORTADA`) | O comportamento na edição é ambíguo, e com o ciclo de vida a venda não precisa disso |
| P4 | Quem pode executar cada transição (ex.: quem cancela)? | Incluir agora `permissoes_transicoes` opcional no perfil (no exemplo, só a dona cancela) | Cancelar mexe no estoque e no fiado; não deve ficar com qualquer perfil |
| P5 | Dois itens do mesmo produto que somados passam do estoque | Garantir pelo "tudo ou nada" + `min: 0` no estoque; a regra por item fica só para dar uma mensagem clara | Uma regra por item sozinha não pega a soma |
| P6 | Venda cancelada pode ser editada ou excluída? | Não; fica como histórico | Preserva a auditoria |
| P7 | Preço unitário sugerido a partir do produto | Fica para depois deste marco | Fora do escopo do contrato |
| P8 | O que é aviso e o que é erro? | Avisos: estado inalcançável, entidade sem perfil, regra equivalente; o resto é erro | Avisos não bloqueiam; erros bloqueiam |
| P9 | Script de migração 0.1 → 0.2? | Não fazer agora; só documentar a tabela | Existe um único mapa |

**Próximo passo:** com a sua aprovação (ou as mudanças que você indicar nas pendências), o plano é implementado, os testes são executados e os resultados reais são relatados.

---

## 11. Glossário

| Termo | Significado |
|---|---|
| **Mapa do sistema** | Arquivo JSON que descreve um sistema inteiro (dados, regras, telas, permissões, testes). É a "planta" da qual tudo é gerado |
| **Contrato / JSON Schema** | Arquivo que define como um mapa válido deve ser escrito. "Draft 2020-12" é a versão do padrão JSON Schema |
| **Validação estrutural** | Confere a **forma**: campos obrigatórios, tipos básicos, valores permitidos |
| **Validação semântica** | Confere o **sentido**: o que é citado existe, os tipos combinam, não há contradições nem círculos |
| **CRUD** | *Create, Read, Update, Delete*: criar, ler, editar e excluir registros. É o "mexer no cadastro" |
| **Evento de domínio / transição** | Ação de negócio com nome (concluir, cancelar) que muda o estado de um registro e pode ter efeitos |
| **Estado** | A situação atual de um registro (rascunho, concluída, cancelada) |
| **Estorno** | Desfazer os efeitos de uma transição anterior (devolver o estoque, abater o fiado) |
| **Atomicidade ("tudo ou nada")** | Uma operação acontece inteira ou não acontece; nunca pela metade |
| **Campo calculado** | Campo cujo valor vem de uma fórmula (ex.: total = soma dos subtotais) |
| **Ciclo de cálculo** | Fórmulas que dependem umas das outras em círculo, sem fim |
| **`eval`** | Executar um texto como se fosse código. É perigoso e proibido aqui |
| **JSON Pointer** | Endereço de um ponto dentro de um JSON. Ex.: `/regras/0/condicao` = a condição da primeira regra |
| **`@ref`** | Apelido de um registro criado num teste, para usá-lo nos passos seguintes (ex.: `@v1` = a venda criada antes) |
| **Código de saída** | Número que um comando devolve ao terminar (0 = sucesso), útil para automação |
| **Grupo opcional de dependências** | Pacotes instalados só quando pedidos (`pip install -e ".[forja]"`) |
| **MVP** | Primeira versão mínima e funcional do sistema |
