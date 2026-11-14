import {
  createAccountAdmin,
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
  listarFornecedores,
  criarFornecedor,
  editarFornecedor,
  statusFornecedor,
  listarProdutos,
  listarProfissionais,
  statusCliente,
  statusProduto,
  statusProfissional,
} from "./modules/operacao/cadastros";
import { obterConsulta, perguntar } from "./modules/operacao/consulta";
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
import { editarPerfil, getSession } from "./modules/session";
import {
  importarClientes,
  importarProdutos,
  interpretarVenda,
  ultimaCompra,
} from "./modules/operacao/automacao";
import { ajustarColuna } from "./modules/colunas";
import { definirLimite, obterConsumo } from "./modules/consumo";
import {
  convidarConta,
  definirAcesso,
  definirStatusConta,
  listarContas,
  reenviarConvite,
  definirSenha,
} from "./modules/contas";
import {
  adicionarRequisito,
  confirmarRequisito,
  confirmarResumo,
  corrigirConfiguracao,
  descartarRequisito,
  editarRequisito,
  enviarMensagem,
  gerarConfiguracao,
  obterCriacao,
} from "./modules/criacao";
import { cancelarPedido, comentarPedido, criarPedido, listarPedidos } from "./modules/pedidos";
import { enviarLogotipo, obterLogotipo, removerLogotipo } from "./modules/logotipo";
import { obterPainel } from "./modules/operacao/painel";
import { cancelarCompra, criarCompra, listarCompras } from "./modules/operacao/compras";
import {
  baixarLancamento,
  cancelarLancamento,
  criarLancamento,
  listarLancamentos,
} from "./modules/operacao/financeiro";
import { geminiDoAmbiente } from "./ia/gemini";
import {
  activateSystem,
  approveVersion,
  createSystem,
  createVersion,
  getSystem,
  listSystems,
  obterInicio,
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
  const webApiKey = env.FIREBASE_WEB_API_KEY;
  return {
    verify: (token) =>
      verifyFirebaseIdToken(token, { projectId, keys: firebaseKeys(), now: clock.now() }),
    lookup: lookupCache.lookup,
    contas: webApiKey
      ? createAccountAdmin({
          projectId,
          serviceAccount,
          webApiKey,
          fetch: (input, init) => fetch(input, init),
          now: () => clock.now(),
        })
      : undefined,
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
      { method: "PATCH", path: `${API_BASE}/session`, handler: editarPerfil },
      // Consumo da IA por conta, só do dono do Nexus (ADR-009).
      { method: "GET", path: `${API_BASE}/consumo`, handler: obterConsumo },
      { method: "POST", path: `${API_BASE}/consumo/:id/limite`, handler: definirLimite },
      // Contas secundárias, só do administrador (seção 7).
      { method: "GET", path: `${API_BASE}/contas`, handler: listarContas },
      { method: "POST", path: `${API_BASE}/contas`, handler: convidarConta },
      { method: "POST", path: `${API_BASE}/contas/:id/convite`, handler: reenviarConvite },
      { method: "POST", path: `${API_BASE}/contas/:id/acessos`, handler: definirAcesso },
      { method: "POST", path: `${API_BASE}/contas/:id/status`, handler: definirStatusConta },
      { method: "POST", path: `${API_BASE}/contas/:id/senha`, handler: definirSenha },
      { method: "GET", path: `${API_BASE}/inicio`, handler: obterInicio },
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
      // Colunas das telas de um sistema ativo: renomear (só visual) ou incluir.
      { method: "POST", path: `${S}/:systemId/colunas`, handler: ajustarColuna },
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
      { method: "POST", path: `${O}/criacao/confirmar`, handler: confirmarResumo },
      { method: "POST", path: `${O}/criacao/gerar`, handler: gerarConfiguracao },
      { method: "POST", path: `${O}/criacao/corrigir`, handler: corrigirConfiguracao },
      // Logotipo (seções 5 e 29): PNG/JPEG até 200 KB no D1.
      { method: "GET", path: `${O}/logotipo`, handler: obterLogotipo },
      { method: "PUT", path: `${O}/logotipo`, handler: enviarLogotipo },
      { method: "DELETE", path: `${O}/logotipo`, handler: removerLogotipo },
      // Pedidos ao desenvolvedor (ADR-004).
      { method: "GET", path: `${O}/pedidos`, handler: listarPedidos },
      { method: "POST", path: `${O}/pedidos`, handler: criarPedido },
      { method: "POST", path: `${O}/pedidos/:pedidoId/comentarios`, handler: comentarPedido },
      { method: "POST", path: `${O}/pedidos/:pedidoId/cancelar`, handler: cancelarPedido },
      // Operação do sistema ativo (seções 10 a 14).
      { method: "GET", path: `${O}/app`, handler: obterApp },
      { method: "GET", path: `${O}/painel`, handler: obterPainel },
      { method: "GET", path: `${O}/consulta`, handler: obterConsulta },
      { method: "POST", path: `${O}/consulta/mensagens`, handler: perguntar },
      // Módulos opcionais (ADR-006): fornecedores e compras, financeiro.
      { method: "GET", path: `${O}/fornecedores`, handler: listarFornecedores },
      { method: "POST", path: `${O}/fornecedores`, handler: criarFornecedor },
      { method: "PATCH", path: `${O}/fornecedores/:id`, handler: editarFornecedor },
      { method: "POST", path: `${O}/fornecedores/:id/status`, handler: statusFornecedor },
      { method: "GET", path: `${O}/compras`, handler: listarCompras },
      { method: "POST", path: `${O}/compras`, handler: criarCompra },
      { method: "POST", path: `${O}/compras/:id/cancelar`, handler: cancelarCompra },
      { method: "GET", path: `${O}/financeiro`, handler: listarLancamentos },
      { method: "POST", path: `${O}/financeiro`, handler: criarLancamento },
      { method: "POST", path: `${O}/financeiro/:id/baixar`, handler: baixarLancamento },
      { method: "POST", path: `${O}/financeiro/:id/cancelar`, handler: cancelarLancamento },
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
      // Menos digitação (pedido do dono, 2026-11-14): venda ditada, última compra, planilhas.
      { method: "POST", path: `${O}/vendas/interpretar`, handler: interpretarVenda },
      { method: "GET", path: `${O}/clientes/:id/ultima-compra`, handler: ultimaCompra },
      { method: "POST", path: `${O}/produtos/importar`, handler: importarProdutos },
      { method: "POST", path: `${O}/clientes/importar`, handler: importarClientes },
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
