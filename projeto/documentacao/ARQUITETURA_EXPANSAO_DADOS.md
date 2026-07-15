# Arquitetura de Expansão do Ecossistema de Dados

Documento técnico de referência para expandir a plataforma além de Adzuna + Jooble +
IBGE (estado atual, já implementado e validado). Cobre: catálogo de fontes viáveis,
arquitetura de ingestão multi-fonte no Airflow, transformações Silver, modelo
dimensional Gold expandido, dicionário de dados, métodos de NLP, KPIs, governança e
princípios de implementação.

**Como usar este documento:** ele é deliberadamente mais amplo do que o necessário
para o TCC em si — é um mapa de possibilidades. A seção 11 (Roteiro Priorizado) indica
o que vale a pena implementar de fato dentro do prazo de um TCC e o que fica como
"trabalhos futuros" na redação. Nem tudo aqui precisa virar código.

---

## 1. Catálogo de Fontes

Cada fonte listada pelo usuário foi verificada quanto ao acesso real disponível hoje
(pesquisa de julho/2026), não apenas presumida. Organizado por viabilidade.

### 1.1 Tier A — Já integradas e validadas

| Fonte | Tipo de acesso | Documentação | Limites | Formato |
|---|---|---|---|---|
| Adzuna | API REST oficial | developer.adzuna.com | Não documentado publicamente; uso moderado observado sem bloqueio | JSON |
| Jooble | API REST oficial (POST) | jooble.org/api/about | 500 requisições (chave gratuita) | JSON |
| IBGE | API REST oficial (governo) | servicodados.ibge.gov.br/api/docs | Sem limite documentado | JSON |

### 1.2 Tier B — API pública real, sem aprovação/gate, prontas para integrar

Todas testáveis e utilizáveis imediatamente, sem cadastro (exceto USAJobs, que é
gratuito e automático).

| Fonte | Tipo de acesso | Documentação | Limites | Formato | Campos principais | Cobertura BR |
|---|---|---|---|---|---|---|
| RemoteOK | JSON público, sem auth | remoteok.com/api | Não documentado; uso razoável esperado | JSON | título, empresa, tags (tecnologias), salário, região, data | Vagas remotas globais; poucas explicitamente BR |
| Remotive | JSON público, sem auth | remotive.com/remote-jobs/api | Não documentado | JSON | título, empresa, categoria, tags, descrição, data | Remotas globais |
| Arbeitnow | JSON público, sem auth | arbeitnow.com/api/job-board-api | Paginado, sem limite documentado | JSON | título, empresa, tags, localização, remoto (bool), tipo | Europa-focado; baixa cobertura BR |
| WeWorkRemotely | Feed RSS público | weworkremotely.com/remote-jobs.rss (+ feeds por categoria) | Sem limite; é RSS, não JSON | XML/RSS | título, empresa, categoria, link, data | Remotas globais |
| USAJobs | API REST oficial (governo EUA) | developer.usajobs.gov | Gratuito, self-service, chave por e-mail, sem limite agressivo | JSON | cargo, órgão, salário (min/max reais, não estimado), localização, requisitos | Não é Brasil — útil só como benchmark internacional/comparativo |

**Restrições legais:** nenhuma — todas essas são APIs/feeds explicitamente publicados
pelos próprios provedores para consumo de terceiros.

**Frequência recomendada:** diária para RemoteOK/Remotive/Arbeitnow/WWR (baixo
volume, sem risco de cota); semanal para USAJobs (fonte secundária/comparativa).

### 1.3 Tier C — APIs públicas por empresa (ATS), requer curadoria manual

Greenhouse, Lever, Ashby, Workable e SmartRecruiters expõem os vagas de **cada
empresa cliente** via endpoint público, sem autenticação — mas não existe uma busca
agregada de mercado: é preciso saber o identificador ("board token"/"slug") de cada
empresa individualmente.

| ATS | Endpoint público | Autenticação | Parâmetros úteis |
|---|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{empresa}/jobs` | Nenhuma | `content=true` para descrição completa |
| Lever | `api.lever.co/v0/postings/{empresa}` | Nenhuma | `team`, `department`, `location`, `commitment`, `level` |
| Ashby | `jobs.ashbyhq.com/api/non-user-graphql` (ou feed público por empresa) | Nenhuma | `includeCompensation=true` traz faixa salarial estruturada |
| Workable | `apply.workable.com/api/v3/accounts/{empresa}/jobs` | Nenhuma | paginação por `state`/`department` |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{empresa}/postings` | Nenhuma | filtros por `department`, `location` |

**Como viabilizar:** montar uma lista curada de ~30–50 empresas de tecnologia
brasileiras/relevantes que usam esses ATS (identificável pela URL da página de
carreiras — ex.: `empresa.greenhouse.io`), e criar uma DAG que itera essa lista.
Diferente de Adzuna/Jooble, aqui o "board token" de cada empresa é configuração, não
descoberta automática — ganho real de qualidade (dados diretos da fonte, sem
intermediário), mas exige manutenção manual da lista de empresas.

**Restrições legais:** nenhuma — são endpoints públicos documentados pelos próprios
ATS para exibição de vagas em sites de terceiros (widgets de carreira).

⚠️ Os caminhos exatos de endpoint acima são indicativos — assim como aconteceu com o
parâmetro de localização da Jooble neste projeto, cada provedor pode alterar detalhes
de formato/versão sem aviso. **Testar com uma chamada real antes de codar em cima da
documentação**, seguindo a mesma disciplina já usada para Adzuna/Jooble/IBGE neste
projeto.

### 1.4 Tier D — Fontes de enriquecimento (não são vagas, complementam o modelo)

| Fonte | Tipo de acesso | Documentação | Uso no projeto |
|---|---|---|---|
| IBGE | API oficial | servicodados.ibge.gov.br/api/docs | Já integrado — geografia e população |
| BrasilAPI | API pública, comunidade | brasilapi.com.br | CNPJ (razão social, porte, CNAE/setor), CEP → coordenadas, câmbio |
| OpenStreetMap Nominatim | API pública, uso justo (1 req/s) | nominatim.org/release-docs | Geocodificação de textos de localização que não batem com a lista IBGE |

### 1.5 Tier E — Inviável ou alto risco legal (não recomendado)

| Fonte | Situação real (verificada) | Motivo |
|---|---|---|
| LinkedIn Jobs | Sem API pública para terceiros; só parceria Talent Solutions (NDA, contrato comercial) | Termos de uso proíbem scraping explicitamente (seção 8.2); a empresa investe ativamente em bloqueio anti-scraping |
| Indeed | Publisher API **descontinuada em 2023**; APIs atuais são só para empregadores publicarem vagas (não para ler) | Acesso de leitura só via parceria empresarial (gate de vendas, seis dígitos) |
| Glassdoor | API pública **fechada em 2024** | Só parceria enterprise, preço não divulgado |
| Dice, Monster | Nenhuma evidência de API pública de busca encontrada | Modelo comercial fechado |
| ZipRecruiter | Tem API, mas é para **empregadores distribuírem vagas**, não para terceiros lerem o mercado | Acesso de leitura é restrito a parceiros aprovados |
| Wellfound (ex-AngelList) | Sem API oficial pública encontrada | Só acesso via scrapers de terceiros (risco de ToS) |
| Catho, Vagas.com.br, InfoJobs, Gupy, Revelo, GeekHunter, Programathor | Nenhuma documentação de API pública encontrada em busca direta | Modelo comercial (cobram do empregador pela publicação); scraping não é endossado |

**Recomendação:** não implementar scraping não autorizado dessas fontes no TCC. Além
do risco legal, um scraper pode quebrar a qualquer momento (mudança de HTML) e
comprometer a reprodutibilidade do pipeline — contraria o próprio objetivo
metodológico do trabalho (Capítulo 3, "auditável e reprodutível"). Se alguma dessas
fontes for essencial para a narrativa, documentar como **limitação da pesquisa** no
Capítulo 5, não como integração técnica.

---

## 2. Arquitetura de Ingestão Multi-Fonte no Airflow

### 2.1 Princípio: uma DAG por fonte, configuração centralizada

O padrão já usado no projeto (`dag_bronze_adzuna`, `dag_bronze_jooble`,
`dag_bronze_ibge`) escala bem para novas fontes — mas com N fontes crescendo, faz
sentido introduzir um arquivo de configuração central em vez de constantes espalhadas
pelo código:

```yaml
# src/comum/fontes.yaml
fontes:
  adzuna:
    tipo: api_paginada
    schedule: "@daily"
    cota_maxima_requisicoes: null
    dispara_silver: true
  jooble:
    tipo: api_por_palavra_chave
    schedule: "@weekly"
    cota_maxima_requisicoes: 500
    dispara_silver: false
  remoteok:
    tipo: api_lista_completa
    schedule: "@daily"
    cota_maxima_requisicoes: null
    dispara_silver: false
  ats_curadas:
    tipo: api_por_empresa
    schedule: "@weekly"
    empresas: ["empresa-a", "empresa-b"]
    dispara_silver: false
```

Cada DAG lê sua própria seção do YAML no `default_args`, e apenas **uma fonte**
(a de maior frequência/confiabilidade — hoje Adzuna) dispara a cascata Silver → Gold,
evitando cargas concorrentes. As demais alimentam a Bronze e são absorvidas na
próxima execução diária, exatamente como Jooble e IBGE hoje.

### 2.2 Tratamento de falhas e retries

Já implementado (retries=3, retry_delay, email_on_failure) — para múltiplas fontes,
reforçar com:

- **Circuit breaker por fonte:** se uma fonte falhar 3 execuções seguidas, pausar a
  DAG automaticamente (`airflow dags pause`) via `on_failure_callback` e notificar,
  em vez de continuar tentando indefinidamente e poluir os logs.
- **Isolamento de falha:** falha na ingestão de uma fonte **não** deve travar as
  demais — cada DAG é independente por design (já é o caso).
- **Idempotência:** toda ingestão grava em `dados/bronze/{fonte}/{data}/`; reexecutar
  no mesmo dia sobrescreve, não duplica (padrão já seguido).

### 2.3 Versionamento dos dados brutos

A Bronze já é particionada por `_data_ingestao` (rastreabilidade temporal). Para
crescer com segurança:

- Manter os metadados `_data_ingestao` e `_origem` em **toda** fonte nova (já é regra
  do projeto).
- Considerar reter histórico Bronze por N dias (hoje ilimitado — para um TCC isso é
  aceitável; em produção real, política de retenção evitaria custo de storage
  crescente indefinidamente).

### 2.4 Diagrama da arquitetura expandida

```text
┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌───────────────┐ ┌─────────────┐
│   Adzuna    │ │   Jooble    │ │  RemoteOK /  │ │  ATS curadas  │ │    IBGE     │
│  (diária)   │ │  (semanal)  │ │  Remotive /  │ │  (semanal)    │ │  (semanal)  │
│             │ │             │ │  Arbeitnow   │ │               │ │             │
└──────┬──────┘ └──────┬──────┘ └──────┬───────┘ └──────┬────────┘ └──────┬──────┘
       │               │               │                │                 │
       └───────────────┴───────────────┴────────┬───────┴─────────────────┘
                                                  ▼
                                       [ BRONZE ] dados/bronze/{fonte}/{data}/
                                                  │
                                    (disparado só pela Adzuna, diariamente)
                                                  ▼
                                       [ SILVER ] unificação, dedup entre
                                                  fontes, classificação,
                                                  enriquecimento (IBGE, BrasilAPI, OSM)
                                                  │
                                                  ▼
                                       [ GOLD ]  Star Schema expandido
                                                  │
                                                  ▼
                                            Power BI Dashboard
```

---

## 3. Transformações da Camada Silver

| Transformação | Método recomendado | Status no projeto |
|---|---|---|
| Padronização de cargos | Classificador por palavras-chave (já implementado, 13 categorias); evoluir para taxonomia canônica + similaridade de embeddings quando o volume justificar | Implementado (básico) |
| Normalização de empresas | Strip de sufixos societários (LTDA, S.A., ME, EIRELI), lowercase, remoção de pontuação; *fuzzy matching* (RapidFuzz, `token_sort_ratio`) para agrupar variações do mesmo nome | Parcial (normalização de string simples) |
| Deduplicação entre plataformas | Fingerprint por (`empresa_normalizada` + `titulo_normalizado` + `municipio` + `data_publicacao` ± 3 dias); para casos ambíguos, similaridade de cosseno entre embeddings da descrição (limiar ~0.9) | Não implementado — necessário quando houver sobreposição real entre fontes |
| Classificação de senioridade | Regras por palavra-chave no título (júnior/pleno/sênior/especialista/estagiário) + extração regex de "X anos de experiência" na descrição como reforço | Não implementado |
| Extração de tecnologias | Lista controlada + `PhraseMatcher` (já implementado via substring; evoluir para spaCy `PhraseMatcher` evita falsos positivos de substring, ex.: "go" dentro de "algorithm") | Implementado (básico, ~100 termos) |
| Extração de soft skills | Lista controlada (comunicação, liderança, trabalho em equipe, proatividade, resolução de problemas) + mesmo mecanismo de matching das tecnologias | Não implementado |
| Extração de benefícios | Lista controlada (vale-refeição, vale-alimentação, plano de saúde, plano odontológico, home office, PLR, gympass, day off) | Não implementado |
| Modalidade de trabalho | Regras por palavra-chave em título+descrição ("remoto", "home office" → remoto; "híbrido" → híbrido; ausência de sinal → presencial, com "não informado" como padrão explícito) | Não implementado |
| Geocodificação | Prioridade: match direto contra lista IBGE (já implementado) → fallback OpenStreetMap Nominatim para textos livres não reconhecidos, com cache local para respeitar o limite de 1 req/s | Parcial (só match direto IBGE) |
| Tradução/padronização de idiomas | Detecção de idioma (`langdetect` ou `fasttext lid.176`) e marcação do campo `idioma`; tradução automática é opcional e cara — recomendado **detectar e marcar**, não traduzir, para não introduzir ruído de tradução automática nos dados | Não implementado |
| Enriquecimento IBGE | Município/UF/região/população | Implementado |
| Enriquecimento Receita Federal | Via BrasilAPI (`/api/cnpj/v1/{cnpj}`) quando a vaga expõe CNPJ, ou por correspondência aproximada de razão social — traz porte, CNAE (setor), situação cadastral | Não implementado |
| Enriquecimento OpenStreetMap | Geocodificação reversa/direta como fallback (ver acima) | Não implementado |

---

## 4. Modelo Dimensional Gold Expandido

Extensão do Star Schema já implementado (`fato_vagas` + `dim_tempo` +
`dim_localizacao` + `dim_empresa` + `dim_categoria` + `dim_habilidade` + `dim_fonte`
+ `ponte_vaga_habilidade` + `benchmark_salarial_categoria` + `metricas_qualidade`).

### 4.1 Novas dimensões propostas

| Tabela | Colunas | Observação |
|---|---|---|
| `dim_senioridade` | id_senioridade, nivel (estágio/júnior/pleno/sênior/especialista), ordem (INT, para ordenação correta em visuais) | Nova FK em `fato_vagas` |
| `dim_modalidade` | id_modalidade, modalidade (remoto/híbrido/presencial/não informado) | Nova FK em `fato_vagas` |
| `dim_beneficio` | id_beneficio, beneficio, categoria_beneficio (saúde/financeiro/flexibilidade) | Dimensão para nova tabela ponte |
| Extensão de `dim_habilidade` | adicionar coluna `tipo` (técnica/comportamental) em vez de criar `dim_softskill` separada — reaproveita a ponte já existente | Evita duplicar o padrão fato-ponte-dimensão para uma variação pequena |
| Extensão de `dim_empresa` | adicionar `cnpj`, `setor` (CNAE), `porte` (via BrasilAPI, quando disponível) | Enriquecimento, não nova tabela |

### 4.2 Nova tabela ponte

| Tabela | Colunas |
|---|---|
| `ponte_vaga_beneficio` | id_vaga (FK → fato_vagas), id_beneficio (FK → dim_beneficio) |

### 4.3 Diagrama atualizado

```text
   dim_tempo   dim_localizacao   dim_senioridade   dim_modalidade
        \             |                 |                /
         \            |                 |               /
dim_empresa ────────────────── fato_vagas ────────────────── dim_categoria
(+ cnpj/setor)         |         |        \                        |
                       |         |         \                  dim_fonte
              ponte_vaga_habilidade    ponte_vaga_beneficio
              (tipo: técnica/          |
               comportamental)         |
                       |               |
               dim_habilidade    dim_beneficio
```

### 4.4 Métricas derivadas sugeridas (para além dos 5 KPIs do Capítulo 3)

- **Taxa de sobreposição entre fontes** — % de vagas que aparecem em mais de uma
  fonte após deduplicação (indicador de qualidade da estratégia multi-fonte).
- **Tempo médio de vaga aberta** — `data_fechamento - data_publicacao`, quando a
  fonte fornecer data de encerramento (Adzuna/Jooble não fornecem hoje; ATS
  curadas geralmente fornecem via campo `status`).
- **Índice de competitividade salarial regional** — salário médio da vaga vs. média
  da categoria na mesma região (z-score).

---

## 5. Dicionário de Dados Completo

| Atributo | Tabela.Coluna (Gold) | Tipo | Status |
|---|---|---|---|
| Empresa | `dim_empresa.nome_empresa` | STRING | Implementado |
| CNPJ | `dim_empresa.cnpj` | STRING | Proposto (via BrasilAPI) |
| Setor | `dim_empresa.setor` | STRING | Proposto (via BrasilAPI/CNAE) |
| Cargo (título) | `fato_vagas.titulo` | STRING | Implementado |
| Cargo (categoria) | `dim_categoria.categoria` | STRING | Implementado |
| Descrição | Silver `vagas.descricao` (não replicada na Gold por volume) | TEXT | Implementado (Silver) |
| Senioridade | `dim_senioridade.nivel` | STRING | Proposto |
| Salário mínimo | `fato_vagas.salario_min` | DECIMAL | Implementado (Adzuna) |
| Salário máximo | `fato_vagas.salario_max` | DECIMAL | Implementado (Adzuna) |
| Salário médio | `fato_vagas.salario_medio` | DECIMAL | Implementado (Adzuna) |
| Moeda | — | STRING | Proposto (hoje implícito BRL só para Adzuna) |
| Benefícios | `dim_beneficio.beneficio` via `ponte_vaga_beneficio` | STRING (N:N) | Proposto |
| Tecnologias/frameworks/BD/cloud | `dim_habilidade.habilidade` + `categoria_skill` via `ponte_vaga_habilidade` | STRING (N:N) | Implementado |
| Certificações | Extensão de `dim_habilidade` (categoria_skill = "certificacao") | STRING (N:N) | Proposto |
| Idioma | Novo campo `fato_vagas.idioma` ou dimensão própria | STRING | Proposto |
| Escolaridade | Extração regex/keyword da descrição → novo campo | STRING | Proposto |
| Anos de experiência | Extração regex da descrição → `fato_vagas.anos_experiencia` | INT | Proposto |
| Tipo de contrato | Campo Jooble `type` já coletado, não tratado ainda | STRING | Proposto |
| Modalidade | `dim_modalidade.modalidade` | STRING | Proposto |
| Localização | `dim_localizacao.municipio/uf/regiao/pais` | STRING | Implementado |
| Data de publicação | `dim_tempo.data` via `fato_vagas.id_tempo` | DATE | Implementado |
| Data de fechamento | — | DATE | Proposto (depende de fonte fornecer) |
| Fonte da vaga | `dim_fonte.fonte`, `dim_fonte.portal_origem` | STRING | Implementado |
| URL | Não persistida hoje (Adzuna/Jooble fornecem `link`) | STRING | Proposto (campo simples a adicionar em `fato_vagas` ou tabela auxiliar) |
| Indicadores de qualidade | `metricas_qualidade.*` | — | Implementado (nível agregado, não por vaga) |

---

## 6. Métodos de NLP para Extração Automática

Ordenados por complexidade crescente — recomenda-se começar pelo mais simples e só
evoluir se a precisão não for suficiente (mais fácil de auditar e defender na banca):

1. **Correspondência por palavras-chave (regras)** — já usado no projeto. Vantagem:
   100% determinístico e auditável (essencial para a métrica de "acurácia" do
   Capítulo 3). Desvantagem: não generaliza para termos não previstos.
2. **`PhraseMatcher` do spaCy** — evolução natural da correspondência por substring
   atual; evita falsos positivos (ex.: "r" dentro de outra palavra) e é
   ordens de magnitude mais rápido que regex em texto longo.
3. **NER customizado (spaCy `EntityRuler` ou modelo treinado)** — permite extrair
   entidades mais complexas (ex.: "5 anos de experiência com Python e AWS" →
   experiência=5, tecnologias=[Python, AWS]) em vez de matching isolado por termo.
4. **Embeddings + similaridade de cosseno (`sentence-transformers`,
   modelo `paraphrase-multilingual-MiniLM-L12-v2`)** — para deduplicação
   semântica entre vagas de fontes diferentes e para mapear títulos livres a uma
   taxonomia canônica de cargos.
5. **Classificação zero-shot (`facebook/bart-large-mnli` ou similar)** — último
   recurso para categorizar cargo/senioridade quando as regras falham; mais caro
   computacionalmente e menos auditável — usar como *fallback*, não como método
   principal, para preservar a rastreabilidade exigida pela metodologia.

**Recomendação para o TCC:** os métodos 1–2 já cobrem a maior parte do valor com
baixo custo de implementação e alta auditabilidade — compatível com o prazo e com a
exigência metodológica de resultados reprodutíveis. Os métodos 3–5 são bons como
"trabalhos futuros" no Capítulo 5.

---

## 7. Indicadores Analíticos, KPIs e Dashboards

Além dos 5 indicadores já exigidos pelo Capítulo 3 (seção 3.7.2), painéis adicionais
viáveis com o modelo expandido:

| Painel | Indicadores | Fonte de dados |
|---|---|---|
| Executivo (visão geral) | Total de vagas, empresas distintas, crescimento mês a mês (% MoM) | `fato_vagas` |
| Competências | Radar/matriz de habilidades por cargo e por senioridade | `ponte_vaga_habilidade` + `dim_categoria` + `dim_senioridade` |
| Remuneração | Salário médio por senioridade × cargo × região (só Adzuna) | `fato_vagas` filtrado por `dim_fonte = adzuna` |
| Modalidade de trabalho | Evolução remoto vs. híbrido vs. presencial ao longo do tempo | `dim_modalidade` + `dim_tempo` |
| Comparativo de fontes | Vagas por fonte/portal, taxa de sobreposição pós-dedup | `dim_fonte` |
| Qualidade de dados | Completude, consistência, unicidade, acurácia, validade, atualidade | `metricas_qualidade` (expandida — ver seção 8) |
| Benefícios | Benefícios mais oferecidos por categoria de empresa/setor | `ponte_vaga_beneficio` + `dim_empresa.setor` |

---

## 8. Governança de Dados

### 8.1 Métricas de qualidade — expansão do Quadro 7 (Capítulo 3)

O projeto já implementa 4 métricas (`src/qualidade/metricas.py`). Para um
ecossistema multi-fonte, recomenda-se adicionar:

| Métrica | Fórmula | Critério sugerido |
|---|---|---|
| Completude *(já implementada)* | campos obrigatórios preenchidos / esperado | ≥ 95% |
| Consistência *(já implementada)* | registros Gold / registros Bronze | ≥ 98% |
| Unicidade *(já implementada)* | (total − duplicatas) / total | = 100% |
| Acurácia de tipos *(já implementada)* | campos com tipo correto / total | = 100% |
| **Validade** (nova) | registros com valores dentro do domínio esperado (ex.: `uf` em uma UF válida, `salario_min ≤ salario_max`) / total | ≥ 98% |
| **Atualidade** (nova) | % de vagas com `data_publicacao` dentro dos últimos N dias no momento da carga | ≥ 90% (indica que as fontes não estão retornando dados obsoletos) |
| **Rastreabilidade** (já coberta implicitamente) | % de registros com `_origem`/`_data_ingestao`/`fonte` preenchidos | = 100% (deveria ser trivial, mas vale formalizar como métrica auditável) |

### 8.2 Catálogo de dados

Para o escopo de um TCC, um dicionário de dados versionado no próprio repositório
(seção 5 deste documento, formalizada como anexo do Capítulo 3) é suficiente e mais
defensável do que instalar uma ferramenta de catálogo dedicada. Ferramentas open
source como **DataHub** ou **OpenMetadata** existem e são de fato usadas em
produção, mas adicionam uma peça de infraestrutura inteira (mais containers, mais
complexidade operacional) sem benefício proporcional ao tamanho deste projeto —
mencionar como "trabalho futuro" no Capítulo 5 é mais honesto do que subutilizá-las.

### 8.3 Linhagem de dados

Já parcialmente coberta pela arquitetura em camadas (Bronze → Silver → Gold) e pelos
metadados `_origem`/`_data_ingestao`/`fonte`/`portal_origem` presentes em todo o
pipeline. Para tornar isso explícito e citável na defesa, recomenda-se documentar,
por tabela Gold, sua linhagem completa (quais tabelas Bronze/Silver a originaram e
quais transformações foram aplicadas) — o dicionário de dados da seção 5 já cumpre
parte disso ao listar a tabela/coluna de origem de cada atributo.

---

## 9. Princípios de Implementação

| Princípio | Como já é aplicado | Como escalar |
|---|---|---|
| **Escalabilidade** | Uma DAG por fonte, camadas independentes | Configuração centralizada (`fontes.yaml`, seção 2.1) em vez de constantes hardcoded por fonte |
| **Modularidade** | `src/comum` (config), `ingestao` (Bronze), `tratamento` (Silver), `analitico` (Gold), `qualidade` — cada camada não conhece detalhes internos das outras | Novas fontes adicionam um `cliente_{fonte}.py` + `ingestao_{fonte}.py` sem tocar nos módulos existentes; novas transformações Silver viram funções puras testáveis isoladamente |
| **Reprodutibilidade** | Docker Compose com versões fixadas, transformações determinísticas (regras, não modelos probabilísticos) | Manter a preferência por métodos determinísticos (seção 6) sempre que a precisão for equivalente — mais fácil de defender e de reproduzir |
| **Boas práticas de Engenharia de Dados** | Métricas de qualidade automatizadas, rastreabilidade por metadados, star schema documentado | Adicionar testes automatizados (`pytest`) para os módulos de tratamento (hoje validados manualmente) e um workflow de CI (GitHub Actions) rodando `py_compile`/`pytest` a cada push — eleva o rigor sem exigir infraestrutura nova |

---

## 10. Riscos e Limitações a Documentar no TCC

Transparência acadêmica exige registrar isto no Capítulo 5 (Limitações), não
esconder:

- **Cobertura por fonte é desigual.** Adzuna é 100% Brasil; Jooble mistura
  internacional; RemoteOK/Remotive/Arbeitnow são majoritariamente vagas remotas
  globais com baixa granularidade de UF brasileira.
- **Moeda/salário não é comparável entre todas as fontes** — já tratado no modelo
  atual (só Adzuna alimenta as medidas salariais).
- **Fontes comerciais brasileiras (Catho, Gupy etc.) ficam de fora** por ausência de
  API pública, não por limitação técnica do pipeline — isso é uma escolha
  metodológica defensável (ética/legal), não uma lacuna a esconder.
- **Cotas de API** (Jooble: 500 requisições totais) limitam a frequência de
  atualização dessas fontes — documentar como restrição operacional real, com o
  design de DAG semanal como mitigação.

---

## 11. Roteiro Priorizado (o que vale implementar de fato)

Dado o prazo de um TCC, nem todas as 11 seções acima precisam virar código. Sugestão
de priorização:

| Fase | Escopo | Esforço estimado | Valor para a defesa |
|---|---|---|---|
| **Fase 1 (feito)** | Adzuna + Jooble + IBGE, Star Schema, qualidade | — | Já implementado e validado |
| **Fase 2** | Adicionar RemoteOK + Remotive + Arbeitnow (Tier B, sem gate) | Baixo — mesmo padrão de cliente/ingestão já usado 3x | Alto — amplia "múltiplas fontes públicas" da hipótese com esforço mínimo |
| **Fase 3** | Modalidade de trabalho + senioridade (regras de palavra-chave) | Baixo — mesmo padrão do classificador de cargo já implementado | Alto — vira 2 dimensões novas e um KPI extra facilmente demonstrável |
| **Fase 4** | Enriquecimento CNPJ/setor via BrasilAPI para `dim_empresa` | Médio — depende de dados de CNPJ nas vagas (nem sempre disponível) | Médio — bom para narrativa, mas cobertura pode ser baixa |
| **Fase 5** | ATS curadas (Greenhouse/Lever/Ashby) | Médio-alto — exige curar lista de empresas | Médio — mais interessante como estudo de caso do que como fonte de volume |
| **Fase 6 (trabalhos futuros)** | Deduplicação semântica, NLP avançado (NER/embeddings/zero-shot), catálogo de dados dedicado | Alto | Documentar como direção futura no Capítulo 5 é mais realista do que implementar sob pressão de prazo |

**Recomendação direta:** Fases 2 e 3 têm a melhor relação esforço/benefício e reaproveitam
exatamente os padrões de código já validados neste projeto (cliente HTTP → ingestão
Bronze → unificação Silver → dimensão Gold). Posso implementar qualquer uma delas
agora, sob demanda.
