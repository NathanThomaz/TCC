# Prova técnica — convite, e-mail confirmado e revogação no Firebase real

Prova da ADR-001, item 6 (Vault do TCC), no projeto Firebase `nexus-tcc-2026`. Foi usado um e-mail de teste autorizado pelo autor (mascarado nos resultados), e a conta foi apagada ao fim de cada fase.

## Perguntas

1. O backend consegue criar a conta sem senha (convite) usando só a conta de serviço, sem o SDK Admin para Node?
2. Concluir o link de "definir senha" (`PASSWORD_RESET`) marca o e-mail como confirmado (`emailVerified`)?
3. O ID token real passa na verificação que o Worker faz (`kid`, `email_verified`, `auth_time`)?
4. A revogação externa (`validSince`) faz o token anterior ser recusado?

## Como foi feita

[`run.js`](run.js), em três fases. Nada de senha, token ou chave é impresso ou gravado.

- `convidar`: cria a conta pela API administrativa (`accounts`, com OAuth da conta de serviço), sem senha, e pede o envio do link de definir senha (`accounts:sendOobCode`).
- `concluir <oobCode>`: o autor copiou o link do e-mail recebido, sem abrir. A fase define a senha (`accounts:resetPassword`), consulta a conta, faz o login (`signInWithPassword`), verifica o token com as chaves públicas do `securetoken` (RS256, aud e iss do projeto) e apaga a conta.
- `revogar`: cria a conta com senha, faz o login, espera 4 s, grava `validSince` com o **horário do servidor do Google** (cabeçalho `Date`), consulta e confere o `auth_time`, e apaga a conta.

## Resultado (2026-11-03)

| Pergunta                                     | Resultado                                                                                                                                                         | Evidência                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1. Criar conta sem senha pelo backend        | **Sim:** HTTP 200, `emailVerified: false`, sem senha                                                                                                              | `resultado-convidar.json`                             |
| 2. Definir senha pelo link confirma o e-mail | **Sim:** `emailVerified` passou de `false` para `true` logo após `resetPassword`                                                                                  | `resultado-convidar.json` e `resultado-concluir.json` |
| 3. Token real com as exigências do Worker    | **Sim, nos pontos testados:** assinatura RS256 pelas chaves do `securetoken`, aud e iss do projeto, `kid` presente, `email_verified: true` e `auth_time` numérico | `resultado-concluir.json`                             |
| 4. Revogação externa                         | **Sim, pela regra do Worker:** `validSince` gravado depois do `auth_time` (1793739673 > 1793739669)                                                               | `resultado-revogar.json`                              |

**Limites e ressalvas:**

- **Pergunta 3:** a prova não executou o `verifyFirebaseIdToken` do Worker; reproduziu as exigências centrais dele com a mesma biblioteca (`jose`). O verificador do Worker, inclusive `kid` obrigatório e `iat`/`auth_time` no passado, está coberto pelos testes unitários (`test/worker/auth.test.ts`). O `resultado-concluir.json` é da primeira versão do script, com os nomes de campos antigos.
- **Pergunta 4:** a recusa é concluída aplicando a regra do Worker (`auth_time < valid_since` ⇒ recusa, em `session.ts`) aos valores reais; a prova não observou uma resposta HTTP recusada. O fluxo completo da sessão está nos testes unitários.
- **Achado:** na primeira tentativa, o `validSince` foi gravado com o relógio desta máquina, que estava atrasado, e ficou **anterior** ao `auth_time`. A referência de tempo tem de ser a do servidor. O Worker usa o relógio da Cloudflare e só _lê_ o `validSince` gravado pelo Firebase.
- **Segurança do script (depois da revisão do Codex):**
  - só altera ou apaga contas com a marca da prova (`displayName`), e para se o e-mail já pertence a outra conta;
  - a conta criada é apagada num `finally`.
- **Não testado:**
  - página própria do Nexus para a ação do link (foi usada a padrão do Firebase);
  - se a redefinição de senha muda o `validSince` sozinha;
  - links expirados ou já usados.

## Conclusão

- **Fluxo de convite confirmado:**
  1. o administrador cadastra a conta (sem senha);
  2. o Nexus pede ao Firebase o link de definir senha;
  3. a pessoa define a senha pelo link, o que já confirma o e-mail;
  4. depois disso, entra com e-mail e senha.

  Não é preciso um e-mail de confirmação separado.

- O `accounts:lookup` devolve o `validSince` usado pela sincronização da revogação no Worker.
