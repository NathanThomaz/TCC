# Guia — Conectar o Power BI ao modelo dimensional (camada Gold)

Roteiro para montar o dashboard a partir das tabelas Parquet geradas pelo pipeline,
cobrindo os cinco indicadores exigidos no Capítulo 3 (seção 3.7.2) e o painel de
qualidade de dados (Quadro 7). Assume que o pipeline já rodou pelo menos uma vez
(`projeto/dados/gold/` populado — ver `iniciar.bat`).

---

## Passo 1 — Conectar as tabelas

O Power BI Desktop lê Parquet nativamente (**Obter Dados → Mais → Arquivo → Parquet**).
Conecte cada tabela individualmente (não use o conector "Pasta", pois ele tenta
combinar arquivos com esquemas diferentes em uma única tabela):

| Tabela | Caminho do arquivo |
|---|---|
| `fato_vagas` | `projeto/dados/gold/fato_vagas/fato_vagas.parquet` |
| `dim_tempo` | `projeto/dados/gold/dim_tempo/dim_tempo.parquet` |
| `dim_localizacao` | `projeto/dados/gold/dim_localizacao/dim_localizacao.parquet` |
| `dim_empresa` | `projeto/dados/gold/dim_empresa/dim_empresa.parquet` |
| `dim_categoria` | `projeto/dados/gold/dim_categoria/dim_categoria.parquet` |
| `dim_habilidade` | `projeto/dados/gold/dim_habilidade/dim_habilidade.parquet` |
| `dim_fonte` | `projeto/dados/gold/dim_fonte/dim_fonte.parquet` |
| `dim_senioridade` | `projeto/dados/gold/dim_senioridade/dim_senioridade.parquet` |
| `dim_modalidade` | `projeto/dados/gold/dim_modalidade/dim_modalidade.parquet` |
| `ponte_vaga_habilidade` | `projeto/dados/gold/ponte_vaga_habilidade/ponte_vaga_habilidade.parquet` |
| `benchmark_salarial_categoria` | `projeto/dados/gold/benchmark_salarial_categoria/benchmark_salarial_categoria.parquet` |
| `metricas_qualidade` | `projeto/dados/gold/metricas_qualidade/metricas_qualidade.parquet` |

Use **Carregar** direto (sem transformações no Power Query — a limpeza já foi feita
nas camadas Silver/Gold do pipeline).

---

## Passo 2 — Relacionamentos (Model view)

Monte o esquema estrela exatamente como descrito no Capítulo 3 (seção 3.5):

```
dim_tempo (1)   dim_localizacao (1)   dim_senioridade (1)   dim_modalidade (1)
       \                |                    |                    /
        \               |                    |                   /
 dim_empresa (1) ──────────────────── fato_vagas (*) ──────────────────── dim_categoria (1)
                         |         \                                 dim_fonte (1)
                         |          \
             ponte_vaga_habilidade (*)
                         |
                         ▼
                 dim_habilidade (1)
```

Crie manualmente (**Gerenciar Relacionamentos**), um por vez:

| De | Para | Cardinalidade | Direção do filtro |
|---|---|---|---|
| `dim_tempo[id_tempo]` | `fato_vagas[id_tempo]` | 1 → * | Único |
| `dim_localizacao[id_localizacao]` | `fato_vagas[id_localizacao]` | 1 → * | Único |
| `dim_empresa[id_empresa]` | `fato_vagas[id_empresa]` | 1 → * | Único |
| `dim_categoria[id_categoria]` | `fato_vagas[id_categoria]` | 1 → * | Único |
| `dim_fonte[id_fonte]` | `fato_vagas[id_fonte]` | 1 → * | Único |
| `dim_senioridade[id_senioridade]` | `fato_vagas[id_senioridade]` | 1 → * | Único |
| `dim_modalidade[id_modalidade]` | `fato_vagas[id_modalidade]` | 1 → * | Único |
| `fato_vagas[id_vaga]` | `ponte_vaga_habilidade[id_vaga]` | 1 → * | **Ambas (bidirecional)** |
| `dim_habilidade[id_habilidade]` | `ponte_vaga_habilidade[id_habilidade]` | 1 → * | Único |

⚠️ **Ponto de atenção:** a relação `fato_vagas ↔ ponte_vaga_habilidade` precisa ser
**bidirecional**. Sem isso, ao filtrar por uma habilidade (ex.: "python"), o filtro
não propaga de volta para `fato_vagas` e a contagem de vagas fica errada. É o padrão
clássico de "tabela ponte" em modelos estrela com relação N:N (Kimball).

`benchmark_salarial_categoria` e `metricas_qualidade` ficam **sem relacionamento** —
são tabelas de referência, usadas isoladamente em seus próprios visuais.

---

## Passo 3 — Marcar dim_tempo como tabela de datas

Selecione `dim_tempo` → aba **Ferramentas de Tabela** → **Marcar como Tabela de
Datas** → coluna `data`. Isso habilita funções de inteligência de tempo do DAX
(úteis se depois você quiser comparar mês a mês).

⚠️ **Ponto de atenção:** o Power BI exige que a coluna de data seja **contínua**
(um registro para cada dia corrido, sem lacunas) — não apenas os dias em que houve
vaga publicada. O pipeline já gera `dim_tempo` como um calendário completo entre a
menor e a maior data de publicação (`construir_dim_tempo` em
`src/analitico/tabelas_gold.py`). Se aparecer o erro *"A coluna de data não pode
ter intervalos de datas"*, é sinal de que o Power BI está com uma versão antiga do
arquivo: rode a camada Gold de novo (`python -m src.analitico.tabelas_gold`) e dê
**Atualizar** na tabela antes de tentar de novo.

---

## Passo 4 — Medidas DAX essenciais

Crie estas medidas na tabela `fato_vagas` (**Nova Medida**):

```dax
Total de Vagas = SUM(fato_vagas[quantidade])

Salário Médio = AVERAGE(fato_vagas[salario_medio])

Salário Médio Mínimo = AVERAGE(fato_vagas[salario_min])

Salário Médio Máximo = AVERAGE(fato_vagas[salario_max])

Total de Empresas Distintas = DISTINCTCOUNT(fato_vagas[id_empresa])

Vagas por 100k Habitantes =
DIVIDE([Total de Vagas], SUM(dim_localizacao[populacao])) * 100000
```

> `dim_localizacao[vagas_por_100k_hab]` já vem calculado do pipeline (snapshot no
> momento da carga), mas não reage a outros filtros do relatório (ex.: filtrar por
> cargo). Para visuais interativos, prefira a medida `Vagas por 100k Habitantes`
> acima, que recalcula dinamicamente.

---

## Passo 5 — Um visual por indicador (Capítulo 3, seção 3.7.2)

| # | Indicador | Visual sugerido | Eixo / Legenda | Valores |
|---|---|---|---|---|
| 1 | Evolução do volume de vagas no tempo | Gráfico de linhas | `dim_tempo[ano_mes]` (ou `[trimestre]`) | `[Total de Vagas]` |
| 2 | Distribuição geográfica por UF/região | Mapa ou barras | `dim_localizacao[uf]` / `[regiao]` | `[Total de Vagas]`, `[Vagas por 100k Habitantes]` |
| 3 | Empresas com mais vagas | Barras horizontais (Top N = 10) | `dim_empresa[nome_empresa]` | `[Total de Vagas]` |
| 4 | Tecnologias/habilidades mais demandadas | Barras horizontais | `dim_habilidade[habilidade]` (filtrado por `dim_habilidade[categoria_skill]`) | `[Total de Vagas]` |
| 5 | Indicadores salariais por cargo e região | Matriz | Linhas: `dim_categoria[categoria]` · Colunas: `dim_localizacao[regiao]` | `[Salário Médio]` |

Adicione um **slicer** de `dim_categoria[categoria]` e outro de `dim_tempo[ano_mes]`
no topo da página para permitir filtrar todos os visuais ao mesmo tempo.

Para o indicador 3, use o filtro visual **Top N** (clique direito no campo →
**Filtro de Top N** → 10, por `[Total de Vagas]`) em vez de ordenar manualmente —
assim ele se atualiza sozinho a cada nova carga de dados.

⚠️ **Indicador 5 (salário):** filtre `dim_fonte[fonte] = "adzuna"` nesse visual (ou
use um slicer de `fonte`). Só a Adzuna tem salário preenchido — as demais fontes
misturam moedas de vários países em texto livre (ver seção 3.5.11 do Capítulo 3),
então ficam com salário nulo. Deixá-las de fora evita confusão sobre a cobertura do
indicador.

### Bônus: nacional x internacional, fonte, senioridade e modalidade

As dimensões `dim_localizacao[pais]`, `dim_fonte`, `dim_senioridade` e
`dim_modalidade` permitem cortes adicionais que não estavam nos cinco indicadores
originais, mas enriquecem bastante a apresentação:

- Um slicer de `dim_localizacao[pais]` para focar a análise geográfica só em vagas
  nacionais (a maioria dos visuais de UF/região só faz sentido para o Brasil).
- Um gráfico de `dim_fonte[portal_origem]` por `[Total de Vagas]`, mostrando a
  diversidade de portais agregados.
- Um gráfico de linhas de `[Total de Vagas]` por `dim_modalidade[modalidade]` ao
  longo de `dim_tempo[ano_mes]` — evolução remoto vs. híbrido vs. presencial.
- Uma matriz de `dim_senioridade[senioridade]` (ordenada por `dim_senioridade[ordem]`)
  × `dim_categoria[categoria]` com `[Total de Vagas]`, mostrando em quais áreas a
  demanda por senioridade é mais alta.

---

## Passo 6 — Painel de qualidade de dados (Quadro 7)

Conecte 6 cartões (**Cartão**) à tabela `metricas_qualidade`, um por métrica,
filtrando `metrica = "completude"`, `"consistencia"`, `"aproveitamento_bruto"`,
`"unicidade"`, `"acuracia_tipos"` e `"validade_empresa"` respectivamente,
exibindo `valor_percentual`. Aplique **formatação condicional** (verde/vermelho)
usando a coluna `atende_criterio` como regra — isso demonstra visualmente, na
apresentação, que a hipótese do Capítulo 3 está sendo cumprida a cada execução
do pipeline.

⚠️ `consistencia` e `aproveitamento_bruto` respondem perguntas diferentes: a
primeira mede perda **não justificada** (defeito real no pipeline — deve estar
sempre em 100%), a segunda mede o aproveitamento **bruto** de registros Bronze
até a Gold, sem distinguir a causa. Vale colocar os dois cartões lado a lado com
essa legenda, para a banca não interpretar `aproveitamento_bruto` mais baixo
como um problema — é esperado que ele seja menor, pois inclui perdas
justificadas (duplicatas, campos obrigatórios ausentes).

### Bônus: empresas verificadas por CNPJ

Um cartão com `COUNTROWS(FILTER(dim_empresa, dim_empresa[cnpj_verificado] = TRUE))`
mostra quantas empresas têm CNPJ validado na Receita Federal (ver seção 3.5.4.1
do Capítulo 3). Uma tabela filtrada por `dim_empresa[cnpj_verificado] = TRUE`
com as colunas `nome_empresa`, `razao_social`, `situacao_cadastral` e `porte` é
uma boa evidência visual de que "empresa real" não é uma afirmação vazia — é
verificável, célula por célula, contra a base pública da Receita Federal.

---

## Atualização dos dados

Com o Airflow rodando (`iniciar.bat`) e novas execuções das DAGs, os arquivos
Parquet em `dados/gold/` são sobrescritos. No Power BI Desktop, use
**Página Inicial → Atualizar** para reler os arquivos e recarregar o modelo.
