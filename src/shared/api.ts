// Contratos HTTP compartilhados entre o Worker e o front.
import type { PaymentMethod } from "./contract/catalog";
import type { ConfigDraft } from "./contract/schema";

/** Corpo de erro padronizado (seção 20 da especificação): sem detalhes internos nem segredos. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface SystemDto {
  id: string;
  nome: string;
  status: "draft" | "active" | "archived";
  versaoAtiva: string | null;
  criadoEm: number;
  atualizadoEm: number;
}

export interface VersionDto {
  id: string;
  versao: number;
  hash: string;
  origem: "formulario" | "chat";
  status: "valid" | "invalid" | "approved" | "superseded";
  criadoEm: number;
}

export interface IssueDto {
  code: string;
  severity: "bloqueante" | "aviso";
  path: string;
  message: string;
}

/** Respostas de /api/v1/systems/... (cada rota preenche só os campos dela). */
export interface SystemsApiBody {
  sistema?: SystemDto;
  sistemas?: SystemDto[];
  versao?: VersionDto | null;
  versoes?: VersionDto[];
  /** Configuração da versão mais recente (só para o administrador), ponto de partida do assistente. */
  ultimaConfig?: ConfigDraft | null;
  issues?: IssueDto[];
  error?: ApiErrorBody["error"];
}

// ---- Operação de um sistema ativo (/api/v1/systems/:systemId/...) ----

export type StatusCadastro = "active" | "inactive";
export type CamposInformativos = Record<string, string | number>;

/**
 * Números de cada cadastro para a tabela (só na listagem e só dos módulos ativos): compras
 * concluídas e não canceladas; atendimentos não cancelados.
 */
export interface ResumoPessoaDto {
  desde: number;
  compras?: number;
  totalCentavos?: number;
  ultimaCompra?: number | null;
  atendimentos?: number;
  proximoAtendimento?: number | null;
}

export interface ClienteDto {
  id: string;
  nome: string;
  status: StatusCadastro;
  campos: CamposInformativos;
  resumo?: ResumoPessoaDto;
}

export interface ProfissionalDto {
  id: string;
  nome: string;
  status: StatusCadastro;
  campos: CamposInformativos;
  resumo?: ResumoPessoaDto;
}

export interface ProdutoDto {
  id: string;
  nome: string;
  status: StatusCadastro;
  varejoCentavos: number;
  atacadoCentavos: number | null;
  unidadesPorCaixa: number | null;
  /** EST-05: disponível = físico − reservado ativo, calculado no instante da consulta. */
  fisico: number;
  reservado: number;
  disponivel: number;
  campos: CamposInformativos;
  /** Último custo de compra (módulo de fornecedores, ADR-006); null sem compra registrada. */
  custoCentavos: number | null;
}

export interface MovimentoDto {
  id: string;
  produto: string;
  tipo: "entrada" | "correcao" | "venda" | "estorno";
  /** Em unidades; negativo = saída. */
  delta: number;
  caixasInformadas: number | null;
  unidadesInformadas: number | null;
  saldoDepois: number;
  motivo: string | null;
  venda: string | null;
  autor: string;
  /** E-mail de quem registrou (EST-02: responsável). */
  autorEmail: string;
  criadoEm: number;
}

export interface ItemVendaDto {
  produto: string;
  nomeProduto: string;
  caixas: number;
  unidadesSoltas: number;
  unidadesPorCaixa: number | null;
  unidades: number;
  varejoCentavos: number;
  atacadoCentavos: number | null;
  totalCentavos: number;
}

export type StatusVenda = "draft" | "discarded" | "completed" | "cancelled";

export interface VendaDto {
  id: string;
  cliente: string;
  nomeCliente: string;
  status: StatusVenda;
  /** Rascunho com reserva vencida (RES-05): consultável, precisa ser regravado para concluir. */
  expirada: boolean;
  revisao: number;
  expiraEm: number;
  limiteAtacadoCentavos: number | null;
  prazoReservaMinutos: number;
  subtotalVarejoCentavos: number;
  totalCentavos: number;
  faixa: "varejo" | "atacado";
  itens: ItemVendaDto[];
  campos: CamposInformativos;
  criadoEm: number;
  concluidaEm: number | null;
  canceladaEm: number | null;
  motivoCancelamento: string | null;
  /** Forma registrada na conclusão (módulo de pagamentos, ADR-006). */
  formaPagamento: PaymentMethod | null;
}

/** Fornecedor: mesma forma do cliente (ADR-006). */
export type FornecedorDto = ClienteDto;

export interface ItemCompraDto {
  produto: string;
  nomeProduto: string;
  caixas: number;
  unidadesSoltas: number;
  unidades: number;
  custoUnitarioCentavos: number;
  totalCentavos: number;
}

export interface CompraDto {
  id: string;
  fornecedor: string;
  nomeFornecedor: string;
  status: "completed" | "cancelled";
  totalCentavos: number;
  observacao: string | null;
  itens: ItemCompraDto[];
  /** Conta a pagar gerada pela compra (com o financeiro). */
  conta: string | null;
  criadoEm: number;
  canceladaEm: number | null;
  motivoCancelamento: string | null;
}

export type TipoLancamento = "receber" | "pagar";
export type StatusLancamento = "pendente" | "pago" | "cancelado";

export interface LancamentoDto {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valorCentavos: number;
  /** Data local AAAA-MM-DD. */
  vencimento: string;
  status: StatusLancamento;
  /** Pendente com vencimento antes de hoje (no fuso do Nexus). */
  vencido: boolean;
  pagoEm: number | null;
  canceladoEm: number | null;
  motivoCancelamento: string | null;
  venda: string | null;
  compra: string | null;
  cliente: string | null;
  fornecedor: string | null;
  /** Nome da contraparte (cliente ou fornecedor), quando houver. */
  contraparte: string | null;
  criadoEm: number;
}

export type StatusAtendimento = "scheduled" | "in_progress" | "done" | "cancelled";

export interface AtendimentoDto {
  id: string;
  cliente: string;
  nomeCliente: string;
  profissional: string;
  nomeProfissional: string;
  tipo: string;
  inicio: number;
  fim: number;
  status: StatusAtendimento;
  /** Horário passado sem início registrado: continua agendado e aparece como atrasado (ADR-002). */
  atrasado: boolean;
  par: string | null;
  posicaoNoPar: 1 | 2 | null;
  venda: string | null;
  campos: CamposInformativos;
  motivoCancelamento: string | null;
}

/** Falta de estoque ao reservar (RES-02/RES-06): o que foi pedido e o que havia disponível. */
export interface FaltaDto {
  produto: string;
  nomeProduto: string;
  pedido: number;
  disponivel: number;
}

/** Respostas da operação (cada rota preenche só os campos dela). */
export interface OperacaoApiBody {
  sistema?: SystemDto;
  config?: ConfigDraft;
  /** Papel de quem opera (a correção de saldo é só do administrador). */
  papel?: "admin" | "secondary";
  clientes?: ClienteDto[];
  cliente?: ClienteDto;
  produtos?: ProdutoDto[];
  produto?: ProdutoDto;
  profissionais?: ProfissionalDto[];
  profissional?: ProfissionalDto;
  movimentos?: MovimentoDto[];
  movimento?: MovimentoDto;
  vendas?: VendaDto[];
  venda?: VendaDto;
  /** CAN-02: a venda já estava cancelada; nada foi estornado de novo. */
  jaCancelada?: boolean;
  atendimentos?: AtendimentoDto[];
  faltas?: FaltaDto[];
  /** CAN-04/CAN-05: serviços vinculados que pedem confirmação ou bloqueiam o cancelamento. */
  servicos?: AtendimentoDto[];
  fornecedores?: FornecedorDto[];
  fornecedor?: FornecedorDto;
  compras?: CompraDto[];
  compra?: CompraDto;
  lancamentos?: LancamentoDto[];
  lancamento?: LancamentoDto;
  error?: ApiErrorBody["error"];
}

// ---- Chat de consulta, somente leitura (/api/v1/systems/:id/consulta, seção 15) ----

export interface MensagemConsultaDto {
  id: string;
  papel: "usuario" | "assistente";
  texto: string;
  /** Na resposta: o que foi consultado, com quais filtros e de onde vieram os números. */
  intencao: string | null;
  filtros: string[];
  origem: string | null;
  criadoEm: number;
}

export interface ConsultaApiBody {
  mensagens?: MensagemConsultaDto[];
  iaDisponivel?: boolean;
  error?: ApiErrorBody["error"];
}

// ---- Contas secundárias (/api/v1/contas), só do administrador (seção 7) ----

export interface ContaDto {
  id: string;
  email: string;
  nome: string | null;
  /** pending = convidada, ainda sem primeiro acesso; disabled = desativada (não entra). */
  status: "pending" | "active" | "disabled";
  /** Sistemas do administrador e se esta conta tem acesso a cada um. */
  sistemas: { id: string; nome: string; ativo: boolean }[];
}

export interface ContasApiBody {
  contas?: ContaDto[];
  conta?: ContaDto;
  /** O convite (link de definir senha) foi pedido ao Firebase com sucesso. */
  conviteEnviado?: boolean;
  error?: ApiErrorBody["error"];
}

// ---- Criação por conversa (/api/v1/systems/:systemId/criacao) ----

// ---- Painel do sistema ativo (/api/v1/systems/:systemId/painel) ----

export interface PainelDto {
  /** Data de hoje no fuso do Nexus (AAAA-MM-DD). Cada bloco só vem com o módulo ativo. */
  hoje: string;
  vendas?: {
    hoje: { quantidade: number; totalCentavos: number };
    mes: { quantidade: number; totalCentavos: number };
    abertas: number;
    canceladasNoMes: number;
    /** Clientes diferentes com venda concluída no mês. */
    clientesNoMes: number;
    ultimas: { id: string; cliente: string; totalCentavos: number; concluidaEm: number }[];
  };
  estoque?: {
    produtosAtivos: number;
    semEstoque: number;
    /** Estoque mínimo da regra (null sem a regra) e quantos estão abaixo dele. */
    minimo: number | null;
    abaixoDoMinimo: number | null;
    criticos: { id: string; nome: string; fisico: number; reservado: number; disponivel: number }[];
    /** Unidades físicas e valor delas a preço de varejo (produtos ativos). */
    unidades: number;
    valorVarejoCentavos: number;
  };
  clientes?: { ativos: number; inativos: number; novosNoMes: number };
  /** Vendas concluídas no mês por forma de pagamento (módulo de pagamentos). */
  pagamentos?: { forma: PaymentMethod; quantidade: number; totalCentavos: number }[];
  /** Fornecedores e compras: compras do mês e valor do estoque pelo último custo. */
  compras?: {
    noMes: { quantidade: number; totalCentavos: number };
    fornecedoresAtivos: number;
    valorCustoCentavos: number;
  };
  /** Financeiro: pendentes, vencidos (antes de hoje) e o que entrou e saiu no mês. */
  financeiro?: {
    aReceber: { quantidade: number; totalCentavos: number };
    aPagar: { quantidade: number; totalCentavos: number };
    vencidosReceber: { quantidade: number; totalCentavos: number };
    vencidosPagar: { quantidade: number; totalCentavos: number };
    recebidoNoMesCentavos: number;
    pagoNoMesCentavos: number;
    proximos: {
      id: string;
      tipo: TipoLancamento;
      descricao: string;
      valorCentavos: number;
      vencimento: string;
    }[];
  };
  agenda?: {
    hoje: { agendados: number; emAtendimento: number; concluidos: number };
    /** Agendados nos próximos 7 dias, a partir de agora. */
    proximos7Dias: number;
    concluidosNoMes: number;
    canceladosNoMes: number;
    profissionaisAtivos: number;
    proximos: { id: string; inicio: number; tipo: string; cliente: string; profissional: string }[];
  };
}

/** Assuntos da entrevista guiada (ADR-004), na ordem em que a IA conduz. */
export type AssuntoDto =
  "negocio" | "produtos_precos" | "pedidos_estoque" | "clientes" | "atendimentos" | "aparencia";

export interface MensagemDto {
  id: string;
  papel: "usuario" | "assistente";
  texto: string;
  perguntas: string[];
  /** Mensagens anteriores à entrevista guiada (o que hoje vira pedido ao desenvolvedor). */
  foraDoCatalogo: string[];
  respostasRapidas: string[];
  assunto: AssuntoDto | null;
  /** Códigos dos requisitos sugeridos nesta mensagem e ids dos pedidos que ela registrou. */
  sugestoes: string[];
  pedidos: string[];
  criadoEm: number;
}

export interface RequisitoDto {
  codigo: string;
  texto: string;
  status: "pendente" | "confirmado" | "substituido";
  origem: "ia" | "usuario";
  assunto: AssuntoDto | null;
  titulo: string | null;
  /** Valor proposto pela IA sem o dono ter dito: só vale depois que o usuário o aceita. */
  sugestao: boolean;
}

export type EstadoPedidoDto = "aberto" | "em_analise" | "implementado" | "recusado" | "cancelado";

export interface PedidoDto {
  id: string;
  titulo: string;
  assunto: AssuntoDto | null;
  origem: "conversa" | "formulario";
  pedidoOriginal: string;
  contexto: string | null;
  regraProposta: string | null;
  exemplos: { situacao: string; esperado: string }[];
  criteriosAceite: string[];
  estado: EstadoPedidoDto;
  historico: { estado: EstadoPedidoDto; em: number; nota: string | null }[];
  comentarios: { texto: string; em: number }[];
  criadoEm: number;
}

export interface PedidosApiBody {
  pedidos?: PedidoDto[];
  pedido?: PedidoDto;
  error?: ApiErrorBody["error"];
}

export interface CriacaoApiBody {
  /** Revisão do estado da criação: toda ação envia a que viu; se mudou, nada é gravado. */
  revisao?: number;
  mensagens?: MensagemDto[];
  /** Requisitos vivos (pendentes e confirmados), em ordem de código. */
  requisitos?: RequisitoDto[];
  /** Assunto da última pergunta da IA e se ela considera a entrevista pronta para revisar. */
  assuntoAtual?: AssuntoDto | null;
  prontoParaRevisar?: boolean;
  pedidos?: PedidoDto[];
  /** Se a IA está configurada neste ambiente (sem ela, o formulário manual continua). */
  iaDisponivel?: boolean;
  /** Última versão gravada (formulário ou conversa) e o diagnóstico dela. */
  versao?: VersionDto | null;
  issues?: IssueDto[];
  /** Configuração exata dessa versão (a prévia mostra o que será aprovado). */
  config?: ConfigDraft | null;
  error?: ApiErrorBody["error"];
}

/** GET /api/v1/config — configuração pública do front. `firebase` nulo = login indisponível. */
export interface PublicConfig {
  environment: string;
  firebase: { apiKey: string; authDomain: string; projectId: string; appId: string } | null;
}

/** GET /api/v1/session — quem está logado, segundo o backend (nunca segundo o navegador). */
export interface SessionResponse {
  usuario: { id: string; email: string; papel: "admin" | "secondary" };
}

export interface HealthResponse {
  status: "ok" | "degraded";
  environment: string;
  time: string;
  checks: {
    database: "ok" | "error";
  };
}
