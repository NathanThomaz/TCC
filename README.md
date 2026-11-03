# Nexus

Trabalho de Conclusão de Curso em Sistemas de Informação.

**Título:** Nexus: construção de sistemas de gestão web para pequenos negócios com IA generativa e módulos reutilizáveis.

**Pergunta de pesquisa:** como combinar IA generativa, módulos reutilizáveis e validação determinística para transformar necessidades de pequenos negócios em sistemas de gestão web que atendam aos requisitos confirmados pelo usuário?

## O que é

O Nexus é uma plataforma web conversacional. O dono do negócio descreve o que precisa; a IA faz perguntas, confirma cada regra e propõe uma configuração estruturada usando apenas módulos de um catálogo já implementado e testado (clientes, produtos, vendas, estoque, profissionais e agenda). Um validador determinístico confere a configuração e, depois da aprovação do administrador, o sistema passa a funcionar dentro da própria plataforma.

A IA não gera código nem SQL: as regras de negócio são executadas por código testado e continuam funcionando sem a IA.

## Status

**Planejamento.** A especificação está consolidada; nenhuma funcionalidade do Nexus foi implementada ainda. Entrega final: 20/11/2026.

Stack aprovada: React + TypeScript e API em TypeScript num único Cloudflare Worker, banco Cloudflare D1, Firebase Authentication e Gemini.

## Histórico do repositório

Este repositório abrigou as versões anteriores do trabalho (Forja e Nexo, em Python), removidas em 2026-11-03 para o recomeço com o Nexus. O estado final dessas versões está preservado na tag [`legado-forja-nexo`](https://github.com/NathanThomaz/TCC/tree/legado-forja-nexo).

## Documentação

- Especificação, requisitos e planejamento: Notion do autor.
- Documentação técnica e histórico de sessões: [Vault do autor — TCC](https://github.com/NathanThomaz/ObisdianDocument/tree/main/01%20-%20Projetos/TCC).
