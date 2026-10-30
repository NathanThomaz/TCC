# Nexo — da necessidade do pequeno negócio à especificação verificada

Trabalho de Conclusão de Curso em **Sistemas de Informação**.

**Tema:** Impacto da inteligência artificial generativa na agilidade e na qualidade do processo de desenvolvimento de software.

**Título provisório:** *Da linguagem natural à especificação verificável: IA generativa, modelos estruturados e validação determinística para sistemas de pequenos negócios.*

**Pergunta de pesquisa:** o mapa e a validação do Nexo tornam as especificações feitas por IA mais completas, consistentes e rastreáveis do que pedir direto à IA?
- Quanto a qualidade melhora?
- Que erros a validação pega, e quais escapam?
- Quanta correção ainda sobra?

## O que é o Nexo

Pequenos negócios precisam controlar estoque, vendas, clientes e contas. A parte difícil é traduzir o negócio em regras precisas, e é nessa tradução que os erros nascem. A IA entende o pedido, mas pode errar ou inventar.

O Nexo é uma ferramenta que transforma a descrição de um pequeno negócio numa **especificação de sistema verificada**:
- **A IA interpreta** o que o dono do negócio descreve;
- **o mapa do sistema estrutura** dados, regras e telas;
- **a validação verifica** se tudo é consistente.

O fluxo tem quatro etapas:

| Etapa | O que acontece |
|---|---|
| 1. Atender | Conversa com o dono do negócio; cada regra é confirmada com um exemplo |
| 2. Transformar | A IA monta o mapa do sistema e a validação confere |
| 3. Criar | O motor gera banco de dados, telas, regras, testes e manual a partir do mapa |
| 4. Disponibilizar | O sistema roda no computador do negócio, sem internet e sem mensalidade |

**Restrições do projeto:** custo zero e execução local (IA com modelo aberto rodando na própria máquina, sem API paga).

## Status

O motor está **em desenvolvimento**. A proposta aguarda o aval do orientador. Prazo final do TCC: **20/11/2026**.

| Parte | Situação |
|---|---|
| Contrato do mapa do sistema (v0.2, JSON Schema) | ✔ pronto |
| Validador estrutural e semântico, com 48 tipos de erro | ✔ pronto |
| Comando `python -m forja validar` | ✔ pronto |
| Testes automatizados do Nexo | ✔ 111 passando |
| Contrato v0.3 (requisitos ligados ao mapa) | ⏳ próximo |
| IA local que preenche o mapa e corrige pelos erros | ⏳ próximo |
| Geração do sistema a partir do mapa | ⏳ próximo |
| Avaliação: IA direta × IA + Nexo, com avaliador cego | ⏳ próximo |

> **Nenhum dado da avaliação foi coletado ainda.** Não há resultados neste repositório.

## Como usar

Requisitos: Python ≥ 3.11 e git.

```bash
pip install -e ".[dev,forja]"
```

Validar um mapa do sistema (exemplo: a padaria da Ana, um negócio fictício):

```bash
python -m forja validar tests/forja/dados/exemplo-padaria.mapa.json
# VÁLIDO: 0 erro(s), 0 aviso(s).
```

Quando o mapa tem problemas, o validador aponta o código do erro, o caminho no mapa e sugestões de correção.

Rodar os testes:

```bash
python -m pytest tests/forja    # só o Nexo
python -m pytest                # tudo, incluindo o projeto anterior
```

> O pacote do código ainda se chama `forja`, nome anterior do projeto.

## Estrutura

```
src/forja/                 Nexo: contrato do mapa e validador
  contrato/                  JSON Schema do mapa do sistema (v0.2)
  estrutural.py              validação da estrutura (schema)
  semantica.py               validação semântica (referências, regras, transições…)
  validacao.py, erros.py     orquestração e catálogo de erros
  __main__.py                comando `python -m forja validar`
tests/forja/               testes do Nexo; dados/ tem o mapa de exemplo da padaria
thesis/apresentacao/       apresentação da proposta (proposta-nexo.pptx)
```

## Documentação

Toda a documentação fica no vault central do Obsidian, no repositório [ObisdianDocument](https://github.com/NathanThomaz/ObisdianDocument), pasta [`01 - Projetos/TCC/`](https://github.com/NathanThomaz/ObisdianDocument/tree/main/01%20-%20Projetos/TCC):
- [`00 - Painel/`](https://github.com/NathanThomaz/ObisdianDocument/tree/main/01%20-%20Projetos/TCC/00%20-%20Painel): painel e ponto de retomada;
- [`01 - Projeto/`](https://github.com/NathanThomaz/ObisdianDocument/tree/main/01%20-%20Projetos/TCC/01%20-%20Projeto): tema, pergunta, objetivos e proposta;
- [`10 - Nexo - Contrato e Validação/`](https://github.com/NathanThomaz/ObisdianDocument/tree/main/01%20-%20Projetos/TCC/10%20-%20Nexo%20-%20Contrato%20e%20Valida%C3%A7%C3%A3o): contrato do mapa, validação e plano do Marco 1;
- [`09 - Registro de Trabalho/`](https://github.com/NathanThomaz/ObisdianDocument/tree/main/01%20-%20Projetos/TCC/09%20-%20Registro%20de%20Trabalho): registro integral de toda pergunta e resposta do trabalho.

## Projeto anterior (suspenso)

Antes do Nexo, o TCC era um experimento N-de-1 sobre o efeito de um assistente de IA no tempo, na qualidade e no retrabalho em tarefas de manutenção de software. Esse plano está **suspenso**, sem dados coletados. O material continua no repositório para consulta:
- `docs/`: planejamento e metodologia;
- `src/tcc_exp/`: instrumento de coleta (CLI `exp`);
- `experiment/`: aplicação-base `loja` e tarefas-piloto;
- `pesquisa/`: revisão bibliográfica.

## Princípios de integridade

- Nenhum resultado é escrito antes da coleta. Resultado positivo, negativo ou inconclusivo é igualmente válido.
- Nenhum dado, entrevista, fonte ou funcionalidade é apresentado como existente sem que exista.
- A validação confere a consistência do mapa; ela não garante que a regra de negócio esteja certa.
- Referências só entram no texto após verificação (ver o status em `pesquisa/`).
