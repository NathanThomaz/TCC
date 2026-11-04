import {
  createAccountLookup,
  parseServiceAccount,
  type AccountLookup,
} from "./auth/firebase-admin";
import { firebaseKeys, verifyFirebaseIdToken } from "./auth/firebase-token";
import type { RouterDeps } from "./http/router";
import { createRouter } from "./http/router";
import { systemClock } from "./lib/clock";
import { getPublicConfig } from "./modules/config";
import { getHealth } from "./modules/health";
import {
  cancelarAtendimento,
  agendar,
  concluirAtendimento,
  iniciarAtendimento,
  listarAgenda,
  remarcar,
} from "./modules/operacao/agenda";
import {
  criarCliente,
  criarProduto,
  criarProfissional,
  editarCliente,
  editarProduto,
  editarProfissional,
  listarClientes,
  listarProdutos,
  listarProfissionais,
  statusCliente,
  statusProduto,
  statusProfissional,
} from "./modules/operacao/cadastros";
import { obterApp } from "./modules/operacao/contexto";
import {
  corrigirSaldo,
  listarEstoque,
  listarMovimentos,
  registrarEntrada,
} from "./modules/operacao/estoque";
import {
  cancelarVenda,
  concluirVenda,
  criarVenda,
  descartarVenda,
  listarVendas,
  obterVenda,
  salvarItens,
} from "./modules/operacao/vendas";
import { getSession } from "./modules/session";
import {
  adicionarRequisito,
  confirmarRequisito,
  corrigirConfiguracao,
  descartarRequisito,
  editarRequisito,
  enviarMensagem,
  gerarConfiguracao,
  obterCriacao,
} from "./modules/criacao";
import { geminiDoAmbiente } from "./ia/gemini";
import {
  activateSystem,
  approveVersion,
  createSystem,
  createVersion,
  getSystem,
  listSystems,
} from "./modules/systems";

/** Base das rotas (seção 20): recursos de negócio ficam em `/api/v1/systems/:systemId/...`. */
export const API_BASE = "/api/v1";

// Uma consulta administrativa por isolate (guarda o token OAuth da conta de serviço).
let lookupCache: { key: string; lookup: AccountLookup } | undefined;

/**
 * Provedor real: exige o projeto Firebase E a conta de serviço. Sem a conta de serviço não há
 * como sincronizar a revogação externa, então a autenticação fica indisponível (fail closed).
 */
const firebaseAuth: NonNullable<RouterDeps["auth"]> = (env, clock) => {
  const projectId = env.FIREBASE_PROJECT_ID;
  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  if (!projectId || !serviceAccount) return undefined;
  const key = `${projectId}:${serviceAccount.client_email}`;
  if (lookupCache?.key !== key) {
    lookupCache = {
      key,
      lookup: createAccountLookup({
        projectId,
        serviceAccount,
        fetch: (input, init) => fetch(input, init),
        now: () => clock.now(),
      }),
    };
  }
  return {
    verify: (token) =>
      verifyFirebaseIdToken(token, { projectId, keys: firebaseKeys(), now: clock.now() }),
    lookup: lookupCache.lookup,
  };
};

/** Monta o app; `deps` permite fixar o relógio e o provedor de identidade nos testes. */
export function createApp(
  deps: RouterDeps = { clock: systemClock, auth: firebaseAuth, ia: (env) => geminiDoAmbiente(env) },
) {
  const S = `${API_BASE}/systems`;
  const O = `${S}/:systemId`;
  return createRouter(
    [
      { method: "GET", path: `${API_BASE}/health`, handler: getHealth },
      { method: "GET", path: `${API_BASE}/config`, handler: getPublicConfig },
      { method: "GET", path: `${API_BASE}/session`, handler: getSession },
      { method: "GET", path: S, handler: listSystems },
      { method: "POST", path: S, handler: createSystem },
      { method: "GET", path: `${S}/:systemId`, handler: getSystem },
      { method: "POST", path: `${S}/:systemId/versions`, handler: createVersion },
      {
        method: "POST",
        path: `${S}/:systemId/versions/:versionId/approve`,
        handler: approveVersion,
      },
      { method: "POST", path: `${S}/:systemId/activate`, handler: activateSystem },
      // Criação por conversa (seção 8).
      { method: "GET", path: `${O}/criacao`, handler: obterCriacao },
      { method: "POST", path: `${O}/criacao/mensagens`, handler: enviarMensagem },
      { method: "POST", path: `${O}/criacao/requisitos`, handler: adicionarRequisito },
      {
        method: "POST",
        path: `${O}/criacao/requisitos/:codigo/confirmar`,
        handler: confirmarRequisito,
      },
      { method: "POST", path: `${O}/criacao/requisitos/:codigo/editar`, handler: editarRequisito },
      {
        method: "POST",
        path: `${O}/criacao/requisitos/:codigo/descartar`,
        handler: descartarRequisito,
      },
      { method: "POST", path: `${O}/criacao/gerar`, handler: gerarConfiguracao },
      { method: "POST", path: `${O}/criacao/corrigir`, handler: corrigirConfiguracao },
      // Operação do sistema ativo (seções 10 a 14).
      { method: "GET", path: `${O}/app`, handler: obterApp },
      { method: "GET", path: `${O}/clientes`, handler: listarClientes },
      { method: "POST", path: `${O}/clientes`, handler: criarCliente },
      { method: "PATCH", path: `${O}/clientes/:id`, handler: editarCliente },
      { method: "POST", path: `${O}/clientes/:id/status`, handler: statusCliente },
      { method: "GET", path: `${O}/profissionais`, handler: listarProfissionais },
      { method: "POST", path: `${O}/profissionais`, handler: criarProfissional },
      { method: "PATCH", path: `${O}/profissionais/:id`, handler: editarProfissional },
      { method: "POST", path: `${O}/profissionais/:id/status`, handler: statusProfissional },
      { method: "GET", path: `${O}/produtos`, handler: listarProdutos },
      { method: "POST", path: `${O}/produtos`, handler: criarProduto },
      { method: "PATCH", path: `${O}/produtos/:id`, handler: editarProduto },
      { method: "POST", path: `${O}/produtos/:id/status`, handler: statusProduto },
      { method: "GET", path: `${O}/estoque`, handler: listarEstoque },
      { method: "GET", path: `${O}/estoque/movimentos`, handler: listarMovimentos },
      { method: "POST", path: `${O}/estoque/entradas`, handler: registrarEntrada },
      { method: "POST", path: `${O}/estoque/correcoes`, handler: corrigirSaldo },
      { method: "GET", path: `${O}/vendas`, handler: listarVendas },
      { method: "POST", path: `${O}/vendas`, handler: criarVenda },
      { method: "GET", path: `${O}/vendas/:id`, handler: obterVenda },
      { method: "POST", path: `${O}/vendas/:id/itens`, handler: salvarItens },
      { method: "POST", path: `${O}/vendas/:id/descartar`, handler: descartarVenda },
      { method: "POST", path: `${O}/vendas/:id/concluir`, handler: concluirVenda },
      { method: "POST", path: `${O}/vendas/:id/cancelar`, handler: cancelarVenda },
      { method: "GET", path: `${O}/agenda`, handler: listarAgenda },
      { method: "POST", path: `${O}/agenda`, handler: agendar },
      { method: "POST", path: `${O}/agenda/:id/remarcar`, handler: remarcar },
      { method: "POST", path: `${O}/agenda/:id/iniciar`, handler: iniciarAtendimento },
      { method: "POST", path: `${O}/agenda/:id/concluir`, handler: concluirAtendimento },
      { method: "POST", path: `${O}/agenda/:id/cancelar`, handler: cancelarAtendimento },
    ],
    deps,
  );
}
