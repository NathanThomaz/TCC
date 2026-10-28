---
tipo: registro
fonte: docs/desvios.md
atualizado: 2026-10-28
tags: [tcc, desvios]
---

# Desvios do Protocolo

Fonte: [desvios.md](https://github.com/NathanThomaz/TCC/blob/main/docs/desvios.md)

Todo evento fora do previsto no [[Protocolo Experimental]] é registrado **no repositório** (`docs/desvios.md`), inclusive os pequenos. Desvios **não são apagados**.

**Situação em 28/10/2026:** nenhum desvio registrado (nenhuma sessão executada).

## Formato (colunas do arquivo)
| Data | Fase | exec_id | Descrição | Ação tomada | Impacto esperado na análise |
|---|---|---|---|---|---|

## Quando registrar
- `exp abortar` por falha de ambiente ou IA indisponível;
- uso de IA na condição A (violação da condição);
- modelo diferente do configurado que persiste;
- atualização da extensão/editor durante a coleta;
- interrupção externa > 10 min;
- uso de tarefa reserva;
- qualquer mudança no protocolo depois da tag `protocolo-v1.0`.

Relacionadas: [[Decisões Metodológicas]] · [[Guia de Sessão]]
