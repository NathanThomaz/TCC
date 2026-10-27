# Tarefa P4a — Importação falha com arquivos do Excel

**Tipo:** robustez da importação · **Tarefa de PILOTO** (não faz parte da coleta principal)

## Relato (cadastro)

> O fornecedor passou a mandar o catálogo exportado pelo Excel ("CSV UTF-8"). Agora toda
> importação falha com "Cabeçalho inválido", embora as colunas estejam certas.

## Regras da importação (vigentes + novas)

As regras originais estão no cabeçalho de `loja/etl.py`. A partir de agora, `importar_produtos_csv` também deve:
1. aceitar arquivos com **BOM UTF-8** e com quebras de linha do Windows;
2. ignorar **espaços ao redor dos nomes das colunas** no cabeçalho;
3. ignorar **linhas totalmente vazias**, sem contá-las como rejeitadas;
4. com **SKU repetido** no mesmo arquivo, considerar só a primeira ocorrência e rejeitar as seguintes com um motivo que contenha a palavra `duplicado`;
5. informar nas rejeições o número da **linha física** do arquivo (a linha 1 é o cabeçalho);
6. com cabeçalho inválido, continuar lançando `ValueError` sem importar nada.

## Critérios de aceitação

1. O caso relatado funciona (teste público).
2. Todas as regras acima são respeitadas. A entrega será avaliada também por cenários adicionais, derivados dessas regras, que não são mostrados.

## Como trabalhar

`exp testar <exec_id>` para os testes públicos e `exp entregar <exec_id>` para entregar. Não altere `testes_publicos/`.
