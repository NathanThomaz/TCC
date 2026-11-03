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

| Pergunta                                     | Resultado                                                                                            | Evidência                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1. Criar conta sem senha pelo backend        | **Sim:** HTTP 200, `emailVerified: false`, sem senha                                                 | `resultado-concluir.json` (fase anterior: 200) |
| 2. Definir senha pelo link confirma o e-mail | **Sim:** `emailVerified: true` logo após `resetPassword`                                             | `resultado-concluir.json`                      |
| 3. Token real verificado como no Worker      | **Sim:** `kid` presente, `email_verified: true`, `auth_time` numérico; assinatura, aud e iss válidos | `resultado-concluir.json`                      |
| 4. Revogação externa recusa o token anterior | **Sim:** `validSince` 1793738487 > `auth_time` 1793738483                                            | `resultado-revogar.json`                       |

**Achado da 1ª tentativa de revogação:** gravar `validSince` com o relógio **desta máquina**, 1,5 s depois do login, deu um valor 1 s **anterior** ao `auth_time` (`resultado-concluir.json`). O relógio local estava atrasado em relação ao do Google, e o token não seria recusado. Por isso a referência de tempo tem de ser a do servidor. No Worker isso já acontece: o relógio da Cloudflare é sincronizado, e o Worker só _lê_ o `validSince` gravado pelo Firebase. Se o próprio Nexus revogar uma sessão, vale gravar o instante com folga de alguns segundos.

## Conclusão

- **Fluxo de convite confirmado:**
  1. o administrador cadastra a conta (sem senha);
  2. o Nexus pede ao Firebase o link de definir senha;
  3. a pessoa define a senha pelo link, o que já confirma o e-mail;
  4. depois disso, entra com e-mail e senha.

  Não é preciso um e-mail de confirmação separado.

- O ID token real é compatível com a verificação do Worker, e a revogação por `validSince` funciona com o `accounts:lookup`.
- **Limites desta prova:**
  - o link usou a página padrão de ação do Firebase (`firebaseapp.com/__/auth/action`), e uma página própria do Nexus fica para depois;
  - não foi medido se a redefinição de senha altera o `validSince` sozinha;
  - não foram testados links expirados ou já usados.
