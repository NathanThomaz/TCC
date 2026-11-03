# Nexus

Trabalho de Conclusão de Curso em Sistemas de Informação.

**Título:** Nexus: construção de sistemas de gestão web para pequenos negócios com IA generativa e módulos reutilizáveis.

**Pergunta de pesquisa:** como combinar IA generativa, módulos reutilizáveis e validação determinística para transformar necessidades de pequenos negócios em sistemas de gestão web que atendam aos requisitos confirmados pelo usuário?

## O que é

O Nexus será uma plataforma web conversacional. O dono do negócio descreve o que precisa; a IA faz perguntas, confirma cada regra e propõe uma configuração estruturada usando apenas módulos de um catálogo implementado e testado previamente (clientes, produtos, vendas, estoque, profissionais e agenda). Um validador determinístico confere a configuração e, depois da aprovação do administrador, o sistema passa a funcionar dentro da própria plataforma.

No desenho aprovado, a IA não gera código nem SQL: as regras de negócio serão executadas por código testado e continuarão funcionando sem a IA.

## Status

**Em desenvolvimento — fundação.** Já existem a base técnica (Worker único, D1 com a migration 0001 de identidade, sistemas e acessos, CI) e a prova técnica de atomicidade e concorrência no D1 ([`provas/d1-atomicidade`](provas/d1-atomicidade/README.md)). As funcionalidades do Nexus (catálogo, configuração, distribuidora, chat) ainda não foram implementadas. Entrega final: 20/11/2026.

Stack aprovada: React + TypeScript e API em TypeScript num único Cloudflare Worker, banco Cloudflare D1, Firebase Authentication e Gemini.

## Desenvolvimento

Requer Node 22 ou superior e **npm 11**: o npm 10 falha ao resolver as dependências do Vitest 5. Com o Node 22, use `npx npm@11 ...`.

| Para                         | Comando                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Instalar                     | `npm ci`                                                                               |
| Validar tudo (o mesmo do CI) | `npm run check` (formatação, lint, tipos, testes e build)                              |
| Rodar localmente             | `npm run dev`, com as migrations locais aplicadas antes por `npm run db:migrate:local` |

Os testes do Worker rodam no runtime real do Workers (workerd), com D1 local e as migrations aplicadas.

Estrutura: `src/worker` (API), `src/web` (React), `src/shared` (contratos HTTP), `migrations` (D1), `test`, `provas` (provas técnicas com resultado registrado).

## Histórico do repositório

Este repositório abrigou as versões anteriores do trabalho (Forja e Nexo, em Python), removidas em 2026-11-03 para o recomeço com o Nexus. O estado final dessas versões está preservado na tag [`legado-forja-nexo`](https://github.com/NathanThomaz/TCC/tree/legado-forja-nexo).

## Documentação

- Especificação, requisitos e planejamento: Notion do autor.
- Documentação técnica e histórico de sessões: [Vault do autor — TCC](https://github.com/NathanThomaz/ObisdianDocument/tree/main/01%20-%20Projetos/TCC).
