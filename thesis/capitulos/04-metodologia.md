# 4 METODOLOGIA

> Rascunho v0.1 (2026-10-27), no futuro do indicativo. Fonte: `docs/protocolo-experimental.md`. Passar ao passado após a coleta e relatar todos os desvios.

## 4.1 Caracterização da pesquisa

A pesquisa será **aplicada**, de abordagem **quantitativa**, com objetivo **explicativo**. O procedimento técnico será o **experimento controlado** (WOHLIN et al., 2012), complementado por uma revisão estruturada da literatura e por uma análise qualitativa das transcrições de uso da IA.

## 4.2 Desenho experimental

O estudo adotará um **desenho de caso único randomizado**: um mesmo executor realizará pares de tarefas equivalentes (gêmeas), uma em cada condição.
- **Condição A:** sem assistente de IA.
- **Condição B:** com o assistente de IA definido no protocolo.

Em cada par, um sorteio definirá qual gêmea será executada com IA e em que ordem, com metade dos pares iniciando pela condição B. A ordem dos pares também será sorteada, intercalando os tipos de tarefa. O plano de randomização e sua semente serão versionados antes da primeira sessão.

A escolha do desenho decorre de três razões:
1. o foco do trabalho está no processo e na qualidade da entrega, e não na variação entre pessoas;
2. a randomização no nível da tarefa, com o mesmo desenvolvedor nas duas condições, tem precedente em Becker et al. (2025);
3. o desenho é viável dentro dos recursos de um TCC.

A principal limitação é a impossibilidade de generalizar para outros desenvolvedores, discutida na Seção 4.8.

## 4.3 Tarefas

As tarefas serão de quatro tipos:
- T1, correção de defeito em regra de negócio;
- T2, implementação de funcionalidade especificada;
- T3, correção de consulta SQL;
- T4, robustez de uma rotina de importação de dados.

Haverá três pares por tipo, totalizando 24 execuções. As tarefas serão aplicadas sobre uma aplicação de pedidos e estoque em Python com SQLite. Para evitar contaminação, as tarefas da coleta principal serão produzidas por terceiros, mantidas fora do alcance do executor e seladas por *hash*. Cada tarefa terá:
- um enunciado com regras explícitas;
- testes públicos;
- testes de avaliação ocultos, derivados das mesmas regras, cada um com severidade definida previamente.

## 4.4 Variáveis e métricas

As variáveis dependentes primárias serão:
- (H1) o tempo ativo até a entrega aceita;
- (H2) a proporção de testes ocultos aprovados na primeira entrega;
- (H3) o tempo de retrabalho após a devolutiva.

As definições operacionais completas estão no Apêndice [X] (`docs/metricas.md`).

## 4.5 Instrumento de coleta

Será utilizado um instrumento de linha de comando desenvolvido para esta pesquisa. O instrumento:
- registra eventos com carimbo de tempo em arquivo somente-acréscimo, encadeado por *hash*;
- versiona o código a cada evento com git;
- executa os testes públicos e ocultos;
- gera a devolutiva padronizada;
- calcula as métricas.

O instrumento não interage com nenhuma API de IA: ele apenas registra a ferramenta, o modelo e a versão em uso. O próprio instrumento possui testes automatizados.

## 4.6 Procedimento

[Descrever: familiarização, prática com a ferramenta, piloto, congelamento do protocolo, sessões (roteiro em `docs/guia-sessao.md`), regras de interrupção e registro de desvios.]

## 4.7 Análise dos dados

Para cada variável primária, será calculada a diferença pareada B − A (em escala logarítmica para o tempo) e estimado o efeito por:
- estimador de Hodges-Lehmann;
- intervalo de confiança de 95% por *bootstrap*;
- teste de randomização exato por inversão de sinais.

O teste de randomização é válido pelo próprio desenho, sem suposição de normalidade [VERIFICAR: Edgington e Onghena]. O teste de Wilcoxon pareado será usado como verificação, e a correção de Holm controlará as três comparações primárias. As execuções não aceitas serão tratadas como censuradas no tempo-limite, com análise de sensibilidade. A hipótese H4 será analisada apenas de forma descritiva.

## 4.8 Ameaças à validade

[Consolidar a partir de `docs/plano-execucao.md` §10 e `docs/ferramentas-ia.md` §6, organizadas em validade de conclusão, interna, de constructo e externa (WOHLIN et al., 2012).]

## 4.9 Aspectos éticos

[Conforme D7: necessidade ou não de submissão ao CEP; ausência de dados pessoais de terceiros; declaração de uso de IA na elaboração do trabalho.]
