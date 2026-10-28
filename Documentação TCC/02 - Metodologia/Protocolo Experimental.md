---
tipo: metodologia
status: v0.9-rascunho (NÃO congelado)
fonte: docs/protocolo-experimental.md
atualizado: 2026-10-28
tags: [tcc, metodologia, protocolo]
---

# Protocolo Experimental

Fonte: [protocolo-experimental.md](https://github.com/NathanThomaz/TCC/blob/main/docs/protocolo-experimental.md)
**Versão:** 0.9-rascunho (27/10/2026) · **Status:** em elaboração, **não congelado**. Congela na E5 com a tag git `protocolo-v1.0`; depois disso toda mudança vira [[Desvios do Protocolo|desvio]] + entrada em [[Decisões Metodológicas]]. Terminologia: Wohlin et al. (2012).

## 1. Objetivo (GQM)
Analisar **o uso de um assistente de IA generativa**, com o propósito de **avaliar** seu efeito sobre **tempo até a entrega aceita, qualidade funcional da 1ª entrega e retrabalho após a devolutiva**, do ponto de vista **do desenvolvedor e do processo de manutenção**, no contexto de **tarefas de manutenção de uma aplicação Python/SQL de pequeno porte, por um único desenvolvedor sob protocolo controlado**.

## 2–3. Hipóteses e variáveis
Ver [[Hipóteses e Variáveis]].

## 4. Unidade e amostra
- Unidade: execução (tarefa × condição).
- Planejado: 12 pares (24 execuções). Mínimo: 9 pares (menor p possível ≈ 2/2⁹ ≈ 0,004).
- Reservas: 1 par por tipo, para abortos por falha de ambiente.

## 5. Tarefas
- Tipos T1–T4 (ver [[Tarefas do Piloto]]).
- **Inclusão:** `exp validar-tarefa` ok (estado inicial falha em ≥ 1 oculto; referência passa 100%); enunciado com regras explícitas das quais **todos** os ocultos derivam; referência altera 3–60 linhas; tempo estimado 20–60 min.
- **Exclusão:** exige conhecimento externo; gêmea compartilha defeito, função ou solução.
- Formato, equivalência e selagem: [[Tarefas Principais e Selagem]].

## 6. Randomização
`exp sortear --pares <pares.toml> --semente <N>` → `plano-principal.csv` + `.sha256` versionados **antes** da 1ª sessão. O plano **não é refeito**; aborto → reserva do mesmo tipo, mesma condição, registrado como desvio. Ver [[Plano de Randomização]].

## 7. Preparação (antes da coleta principal)
1. Familiarização com a aplicação-base (sem tarefas, duração registrada).
2. Prática com a ferramenta de IA ≥ 3 h em tarefas **não relacionadas**.
3. Piloto (dados em `data/raw/piloto`, fora da análise principal). *O texto do protocolo ainda diz "pares P1 e P2"; hoje são P1–P4 — ver [[Inconsistências do Repositório]].*
4. Ajustes pós-piloto registrados → congelamento.

## 8. Procedimento de cada sessão
Resumo (roteiro completo em [[Guia de Sessão]]):
1. checklist do ambiente da condição sorteada;
2. `exp abrir` → workspace + enunciado;
3. leitura → `exp iniciar`;
4. trabalho, `exp testar` à vontade; pausas só para interrupções externas;
5. `exp entregar` → avaliação oculta: aceita → fim; falhas → devolutiva → correção → nova entrega (máx. 2 rodadas);
6. 90 min ativos → `exp encerrar-limite` (censura);
7. `exp percepcao`, `exp questionario` e, em B, `exp anexar <transcrição>`.

## 9. Plano de análise
Ver [[Plano de Análise Estatística]].

## 10. Interrupções e desvios

| Situação | Ação |
|---|---|
| Falha de ambiente | `exp abortar`; reserva na próxima sessão; desvio |
| IA indisponível em B | `exp abortar --motivo "IA indisponível"`; remarcar. **Nunca** fazer sem IA |
| Interrupção externa > 10 min | `exp pausar` / `exp retomar` + nota |
| Violação da condição (ex.: IA em A) | Mantida nos brutos, marcada como desvio, análise com e sem |
| Modelo diferente do configurado | Registrado via `--modelo`; se persistir, desvio + decisão |

## 11. Ameaças
Ver [[Ameaças à Validade]].

## 12. Ética
- Único participante = o próprio pesquisador. Necessidade de CEP **a confirmar com a instituição** (D7). Na replicação com colegas, CEP + TCLE são pré-requisitos.
- Nenhum dado pessoal de terceiros; transcrições só contêm código da aplicação fictícia.
