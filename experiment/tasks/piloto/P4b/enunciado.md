# Tarefa P4b — Preços inválidos importados com valor errado

**Tipo:** robustez da importação · **Tarefa de PILOTO** (não faz parte da coleta principal)

## Relato (financeiro)

> Um produto veio no arquivo do fornecedor com preço "12.50" (ponto decimal, padrão
> americano) e foi cadastrado como R$ 1.250,00. Preço em formato errado deve ser
> **rejeitado**, nunca interpretado de outra forma.

## Regras de formato de preço (`preco_br_para_centavos`)

Valores aceitos:
- dígitos, com separador de milhar `.` **opcional**, em grupos de **exatamente 3 dígitos** após o primeiro grupo (1 a 3 dígitos);
- vírgula decimal opcional, seguida de **1 ou 2** dígitos;
- prefixo `R$` opcional e espaços ao redor, que são ignorados.

| Aceito | Centavos |
|---|---|
| `10` | 1000 |
| `10,5` | 1050 |
| `1.234,56` | 123456 |
| `R$ 3,99` | 399 |

Qualquer outro formato → `ValueError`. Exemplos: `12.50`, `1.23,45`, `-1,00`, vazio.

Na importação (`importar_produtos_csv`), a linha com preço inválido é rejeitada (com número e motivo), e as demais seguem normalmente. Esse comportamento já existe.

## Critérios de aceitação

1. O caso relatado (`12.50`) é rejeitado (teste público).
2. Todas as regras acima são respeitadas. A entrega será avaliada também por cenários adicionais, derivados dessas regras, que não são mostrados.

## Como trabalhar

`exp testar <exec_id>` para os testes públicos e `exp entregar <exec_id>` para entregar. Não altere `testes_publicos/`.
