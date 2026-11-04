import type { ConfigDraft } from "../../src/shared/contract/schema";

// Caso demonstrativo (seção 26) com dados fictícios: distribuidora de bebidas com atacado a
// partir de R$ 1.000, caixa de 12, reserva de 30 minutos e par instalação/retirada de chopeira.
export const DISTRIBUIDORA: ConfigDraft = {
  modelo: "comercio_com_servicos",
  modulos: ["clientes", "produtos", "vendas", "estoque", "profissionais", "agenda"],
  aparencia: {
    nome: "Distribuidora Exemplo",
    cor_primaria: "#1f4e79",
    cor_destaque: "#f2a900",
    titulo: "Distribuidora Exemplo",
  },
  requisitos: [
    { id: "REQ-01", texto: "Vender bebidas com estoque e clientes", status: "confirmado" },
    { id: "REQ-02", texto: "Atacado a partir de R$ 1.000 a preço de varejo", status: "confirmado" },
    { id: "REQ-03", texto: "Cerveja vendida avulsa ou na caixa com 12", status: "confirmado" },
    { id: "REQ-04", texto: "Pedido aberto segura o estoque por 30 minutos", status: "confirmado" },
    {
      id: "REQ-05",
      texto: "Instalação e retirada da chopeira pelo mesmo técnico, uma hora cada",
      status: "confirmado",
    },
  ],
  campos: [
    { id: "telefone", entidade: "clientes", rotulo: "Telefone", tipo: "texto", obrigatorio: false },
    {
      id: "endereco",
      entidade: "agendamentos",
      rotulo: "Endereço do evento",
      tipo: "texto",
      obrigatorio: true,
    },
  ],
  tipos_atendimento: [
    { id: "instalacao", rotulo: "Instalação da chopeira", duracao_minutos: 60 },
    { id: "retirada", rotulo: "Retirada da chopeira", duracao_minutos: 60 },
  ],
  regras: [
    { tipo: "limite_atacado", valor_centavos: 100_000, requisitos: ["REQ-02"] },
    { tipo: "unidades_por_caixa", unidades: 12, requisitos: ["REQ-03"] },
    { tipo: "prazo_reserva", minutos: 30, requisitos: ["REQ-04"] },
    {
      tipo: "par_atendimento",
      primeiro: "instalacao",
      segundo: "retirada",
      requisitos: ["REQ-05"],
    },
  ],
  fora_do_catalogo: [],
};
