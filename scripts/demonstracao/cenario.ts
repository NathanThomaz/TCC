// Massa de dados da demonstração (pedido do dono, 2026-11-23, para a defesa de 02/12): três
// negócios fictícios com cerca de 3 meses de movimento, gerados PELA API do Nexus com o relógio
// simulado. Cada venda, compra, saída e conta passa pelas mesmas validações, gatilhos e regras do
// uso real; nada é gravado direto no banco. O sorteio é determinístico (mesma semente = mesmos
// dados), e quem chama decide o banco (local ou produção) e a identidade.
import type { OperacaoApiBody, PainelDto, SystemsApiBody } from "../../src/shared/api";
import type { ConfigDraft, Rule } from "../../src/shared/contract/schema";
import {
  EMPRESAS,
  FORNECEDORES_DISTRIBUIDORA,
  FORNECEDORES_RESTAURANTE,
  INSUMOS_RESTAURANTE,
  NOMES,
  PLANOS_ESTUDIO,
  PRODUTOS_DISTRIBUIDORA,
  RUAS,
  SOBRENOMES,
  TECNICOS,
  type InsumoDemo,
  type ProdutoDemo,
} from "./dados";

export type Corpo = OperacaoApiBody &
  SystemsApiBody & { painel?: PainelDto; error?: { code?: string; message?: string } };
export type Metodo = "GET" | "POST" | "PATCH";
export interface Resposta {
  status: number;
  body: Corpo;
}
export type Chamar = (metodo: Metodo, caminho: string, corpo?: unknown) => Promise<Resposta>;

export interface OpcoesCenario {
  chamar: Chamar;
  /** Ajusta o relógio que a API usa (ms desde 1970). */
  relogio: (instante: number) => void;
  /** Último dia do histórico (AAAA-MM-DD, horário de Brasília). */
  ate: string;
  /** Instante real da carga: nada é gravado depois dele. */
  limite?: number;
  /** Quantos dias de histórico (padrão 90). */
  dias?: number;
  semente?: number;
  /** Nome da conta mostrado no perfil. */
  nomeConta?: string;
  log?: (mensagem: string) => void;
}

export interface ResumoCenario {
  sistemas: { nome: string; id: string }[];
  contagem: Record<string, number>;
  recusas: Record<string, number>;
}

export const NOMES_SISTEMAS = {
  distribuidora: "Boa Sede Bebidas",
  estudio: "Studio Equilíbrio Pilates",
  restaurante: "Restaurante Sabor da Casa",
} as const;

// ---------------------------------------------------------------- tempo e sorteio

const MIN = 60_000;
const DIA_MS = 24 * 60 * MIN;
/** Brasília (UTC−3, sem horário de verão). */
const FUSO = 3 * 60 * MIN;

export function instante(dia: string, hora: number, minuto = 0): number {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return Date.UTC(a, m - 1, d, hora, minuto) + FUSO;
}
export function somarDias(dia: string, n: number): string {
  return new Date(instante(dia, 12) - FUSO + n * DIA_MS).toISOString().slice(0, 10);
}
const diaDaSemana = (dia: string) => new Date(instante(dia, 12) - FUSO).getUTCDay();
const diaDoMes = (dia: string) => Number(dia.slice(8, 10));
const NOMES_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const nomeDoMes = (dia: string) => NOMES_MESES[Number(dia.slice(5, 7)) - 1] ?? "";

class Sorteio {
  private estado: number;
  constructor(semente: number) {
    this.estado = semente >>> 0;
  }
  /** mulberry32: rápido, determinístico e suficiente para dados de exemplo. */
  numero(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }
  inteiro(min: number, max: number): number {
    return min + Math.floor(this.numero() * (max - min + 1));
  }
  entre(min: number, max: number): number {
    return min + this.numero() * (max - min);
  }
  chance(p: number): boolean {
    return this.numero() < p;
  }
  escolher<T>(lista: readonly T[]): T {
    const item = lista[Math.floor(this.numero() * lista.length)];
    if (item === undefined) throw new Error("lista vazia no sorteio");
    return item;
  }
  ponderado<T>(lista: readonly T[], peso: (item: T) => number): T {
    const total = lista.reduce((s, x) => s + peso(x), 0);
    let alvo = this.numero() * total;
    for (const item of lista) {
      alvo -= peso(item);
      if (alvo <= 0) return item;
    }
    return this.escolher(lista);
  }
  embaralhar<T>(lista: readonly T[]): T[] {
    const copia = [...lista];
    for (let k = copia.length - 1; k > 0; k--) {
      const j = Math.floor(this.numero() * (k + 1));
      [copia[k], copia[j]] = [copia[j] as T, copia[k] as T];
    }
    return copia;
  }
}

/** Número estável em [0, 1) para um texto: decide o destino de uma conta pelo id dela. */
function estavel(texto: string, semente: number): number {
  let h = 2166136261 ^ semente;
  for (let k = 0; k < texto.length; k++) {
    h ^= texto.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4_294_967_296;
}

const centavos = (reais: number) => Math.round(reais * 100);

/** EAN-13 fictício com prefixo do Brasil e dígito verificador correto. */
function ean(sequencia: number): string {
  const base = `7890${String(100000000 + sequencia).slice(1)}`;
  const soma = [...base].reduce((s, c, k) => s + Number(c) * (k % 2 === 0 ? 1 : 3), 0);
  return base + String((10 - (soma % 10)) % 10);
}

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

// ---------------------------------------------------------------- fila de eventos

interface Evento {
  t: number;
  seq: number;
  fazer: () => Promise<unknown>;
}

class Linha {
  private itens: Evento[] = [];
  private seq = 0;
  em(t: number, fazer: () => Promise<unknown>) {
    const ev = { t, seq: this.seq++, fazer };
    let lo = 0;
    let hi = this.itens.length;
    while (lo < hi) {
      const meio = (lo + hi) >> 1;
      const x = this.itens[meio] as Evento;
      if (x.t < t || (x.t === t && x.seq < ev.seq)) lo = meio + 1;
      else hi = meio;
    }
    this.itens.splice(lo, 0, ev);
  }
  proximo(): Evento | undefined {
    return this.itens.shift();
  }
}

// ---------------------------------------------------------------- cenário

interface Produto {
  id: string;
  dados: ProdutoDemo;
  disponivel: number;
  alvo: number;
  validade: string | null;
  /** Restaurante: uso acumulado ainda não lançado. */
  acumulado: number;
}

interface Cliente {
  id: string;
  nome: string;
  empresa: boolean;
  peso: number;
  fiado: boolean;
  /** Último dia em que ainda compra (cliente que parou). */
  ultimoDia: string | null;
  evento: boolean;
}

export async function executarCenario(o: OpcoesCenario): Promise<ResumoCenario> {
  const dias = o.dias ?? 90;
  const semente = o.semente ?? 20261202;
  const s = new Sorteio(semente);
  const log = o.log ?? (() => undefined);
  const inicio = somarDias(o.ate, -(dias - 1));
  // Nada depois do fim do último dia nem depois do instante real da carga (dado no futuro).
  const fim = Math.min(instante(o.ate, 23, 59), o.limite ?? Number.POSITIVE_INFINITY);
  const linha = new Linha();
  const contagem: Record<string, number> = {};
  const recusas: Record<string, number> = {};
  const contar = (chave: string, n = 1): void => {
    contagem[chave] = (contagem[chave] ?? 0) + n;
  };
  const recusar = (chave: string): void => {
    recusas[chave] = (recusas[chave] ?? 0) + 1;
  };

  async function api(metodo: Metodo, caminho: string, corpo?: unknown): Promise<Resposta> {
    return o.chamar(metodo, caminho, corpo);
  }
  function exigir(r: Resposta, contexto: string): Corpo {
    if (r.status >= 400) {
      throw new Error(
        `${contexto}: HTTP ${r.status} ${JSON.stringify(r.body.error ?? r.body).slice(0, 600)}`,
      );
    }
    return r.body;
  }

  const diasDoPeriodo: string[] = [];
  for (let k = 0; k < dias; k++) diasDoPeriodo.push(somarDias(inicio, k));

  // ---- conta e sistemas (no primeiro dia, das 6h, antes do primeiro evento da fila) ----
  let relogioDaPreparacao = instante(inicio, 6, 0);
  const passo = () => {
    relogioDaPreparacao += 2_000;
    o.relogio(relogioDaPreparacao);
  };
  passo();
  if (o.nomeConta) exigir(await api("PATCH", "/session", { nome: o.nomeConta }), "nome da conta");

  async function criarSistema(nome: string, rascunho: ConfigDraft): Promise<string> {
    passo();
    const criado = exigir(await api("POST", "/systems", { nome }), `criar ${nome}`);
    const id = criado.sistema?.id;
    if (!id) throw new Error(`criar ${nome}: resposta sem id`);
    const v = exigir(
      await api("POST", `/systems/${id}/versions`, { origem: "formulario", rascunho }),
      `versão de ${nome}`,
    ).versao;
    if (v?.status !== "valid") {
      throw new Error(`configuração de ${nome} inválida: ${JSON.stringify(v).slice(0, 1500)}`);
    }
    exigir(
      await api("POST", `/systems/${id}/versions/${v.id}/approve`, { hash: v.hash }),
      `aprovar ${nome}`,
    );
    exigir(await api("POST", `/systems/${id}/activate`, { versao: v.id }), `ativar ${nome}`);
    contar("sistemas");
    return id;
  }

  const requisitos = (textos: string[]) =>
    textos.map((texto, k) => ({
      id: `REQ-${String(k + 1).padStart(2, "0")}`,
      texto,
      status: "confirmado" as const,
    }));
  const req = (...n: number[]) => n.map((k) => `REQ-${String(k).padStart(2, "0")}`);

  const D = await criarSistema(NOMES_SISTEMAS.distribuidora, rascunhoDistribuidora());
  const E = await criarSistema(NOMES_SISTEMAS.estudio, rascunhoEstudio());
  const R = await criarSistema(NOMES_SISTEMAS.restaurante, rascunhoRestaurante());
  log(`sistemas ativos: ${D}, ${E}, ${R}`);

  function rascunhoDistribuidora(): ConfigDraft {
    const regras: Rule[] = [
      { tipo: "limite_atacado", valor_centavos: 100_000, requisitos: req(2) },
      { tipo: "unidades_por_caixa", unidades: 12, requisitos: req(3) },
      { tipo: "prazo_reserva", minutos: 30, requisitos: req(4) },
      { tipo: "par_atendimento", primeiro: "instalacao", segundo: "retirada", requisitos: req(5) },
      {
        tipo: "formas_pagamento",
        formas: ["dinheiro", "pix", "cartao_credito", "cartao_debito", "a_prazo"],
        prazo_dias: 28,
        requisitos: req(6),
      },
      { tipo: "limite_credito", valor_centavos: 500_000, requisitos: req(7) },
      { tipo: "cliente_sem_comprar", dias: 30, requisitos: req(8) },
      { tipo: "validade_produto", dias_aviso: 30, requisitos: req(9) },
      {
        tipo: "saida_manual",
        motivos: ["Quebra", "Vencido", "Consumo interno", "Degustação"],
        requisitos: req(10),
      },
      {
        tipo: "categorias_financeiras",
        despesas: [
          "Aluguel",
          "Folha de pagamento",
          "Energia e água",
          "Combustível",
          "Impostos",
          "Manutenção",
          "Serviços",
          "Internet e telefone",
        ],
        receitas: ["Vendas", "Locação de chopeira", "Outras receitas"],
        requisitos: req(11),
      },
      { tipo: "aviso_vencimento", dias: 7, requisitos: req(12) },
      {
        tipo: "orcamento_mensal",
        limites: [
          { categoria: "Combustível", valor_centavos: 220_000 },
          { categoria: "Manutenção", valor_centavos: 100_000 },
          { categoria: "Energia e água", valor_centavos: 170_000 },
        ],
        requisitos: req(13),
      },
      {
        tipo: "multa_juros_atraso",
        multa_percentual: 2,
        juros_mes_percentual: 1,
        requisitos: req(14),
      },
      { tipo: "estoque_minimo", unidades: 24, requisitos: req(16) },
    ];
    return {
      modelo: "comercio_com_servicos",
      modulos: [
        "clientes",
        "produtos",
        "vendas",
        "estoque",
        "profissionais",
        "agenda",
        "pagamentos",
        "fornecedores",
        "financeiro",
      ],
      aparencia: {
        nome: NOMES_SISTEMAS.distribuidora,
        titulo: NOMES_SISTEMAS.distribuidora,
        cor_primaria: "#1f4e79",
        cor_destaque: "#f2a900",
      },
      requisitos: requisitos([
        "Vender bebidas com estoque e cadastro de clientes",
        "Atacado a partir de R$ 1.000 a preço de varejo",
        "Cerveja vendida avulsa ou na caixa",
        "Pedido aberto segura o estoque por 30 minutos",
        "Instalação e retirada da chopeira pelo mesmo técnico",
        "Dinheiro, Pix, cartões e venda a prazo para empresas, com 28 dias",
        "Limite de crédito de R$ 5.000 por cliente na venda a prazo",
        "Avisar clientes que pararam de comprar há 30 dias",
        "Avisar produtos a 30 dias do vencimento",
        "Registrar quebras e perdas de estoque com motivo",
        "Contas a pagar e a receber por categoria",
        "Avisar contas que vencem nos próximos 7 dias",
        "Orçamento mensal de combustível, manutenção, energia e água",
        "Multa de 2% e juros de 1% ao mês no atraso",
        "Comprar dos fornecedores com entrada automática no estoque",
        "Avisar quando um produto ficar abaixo do estoque mínimo",
      ]),
      campos: [
        {
          id: "telefone",
          entidade: "clientes",
          rotulo: "Telefone",
          tipo: "texto",
          obrigatorio: false,
        },
        { id: "email", entidade: "clientes", rotulo: "E-mail", tipo: "texto", obrigatorio: false },
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
      regras,
      fora_do_catalogo: [],
    };
  }

  function rascunhoEstudio(): ConfigDraft {
    return {
      modelo: "controle_financeiro",
      modulos: ["financeiro"],
      aparencia: {
        nome: NOMES_SISTEMAS.estudio,
        titulo: NOMES_SISTEMAS.estudio,
        cor_primaria: "#5b3a8c",
        cor_destaque: "#2bb3a3",
      },
      requisitos: requisitos([
        "Controlar mensalidades, aulas avulsas e despesas do estúdio",
        "Separar receitas e despesas por categoria",
        "Avisar contas que vencem nos próximos 5 dias",
        "Orçamento mensal de marketing, materiais e contas de consumo",
        "Multa de 2% e juros de 1% ao mês na mensalidade atrasada",
      ]),
      campos: [],
      tipos_atendimento: [],
      regras: [
        {
          tipo: "categorias_financeiras",
          despesas: [
            "Aluguel",
            "Salários",
            "Contas de consumo",
            "Materiais",
            "Marketing",
            "Serviços",
            "Impostos",
          ],
          receitas: ["Mensalidades", "Aulas avulsas", "Workshops"],
          requisitos: req(2),
        },
        { tipo: "aviso_vencimento", dias: 5, requisitos: req(3) },
        {
          tipo: "orcamento_mensal",
          limites: [
            { categoria: "Marketing", valor_centavos: 70_000 },
            { categoria: "Materiais", valor_centavos: 40_000 },
            { categoria: "Contas de consumo", valor_centavos: 80_000 },
          ],
          requisitos: req(4),
        },
        {
          tipo: "multa_juros_atraso",
          multa_percentual: 2,
          juros_mes_percentual: 1,
          requisitos: req(5),
        },
      ],
      fora_do_catalogo: [],
    };
  }

  function rascunhoRestaurante(): ConfigDraft {
    return {
      modelo: "controle_estoque",
      modulos: ["produtos", "estoque", "fornecedores"],
      aparencia: {
        nome: NOMES_SISTEMAS.restaurante,
        titulo: NOMES_SISTEMAS.restaurante,
        cor_primaria: "#8c3a1f",
        cor_destaque: "#e8a33d",
      },
      requisitos: requisitos([
        "Controlar o estoque de insumos da cozinha",
        "Registrar saídas para a cozinha, perdas, vencidos e doações",
        "Avisar insumos a 7 dias do vencimento",
        "Avisar insumos abaixo do estoque mínimo",
        "Comprar dos fornecedores com entrada automática no estoque",
      ]),
      campos: [],
      tipos_atendimento: [],
      regras: [
        {
          tipo: "saida_manual",
          motivos: ["Uso na cozinha", "Perda", "Vencido", "Doação"],
          requisitos: req(2),
        },
        { tipo: "validade_produto", dias_aviso: 7, requisitos: req(3) },
        { tipo: "estoque_minimo", unidades: 3, requisitos: req(4) },
      ],
      fora_do_catalogo: [],
    };
  }

  const em = (sistema: string, caminho: string) => `/systems/${sistema}${caminho}`;

  // ---- cadastros ----

  /** Campos que a edição regrava (os ausentes viram vazios); validade e mínimo vêm à parte. */
  const cadastroDoProduto = (dados: ProdutoDemo) => ({
    nome: dados.nome,
    varejoCentavos: centavos(dados.varejo),
    atacadoCentavos: dados.atacado === null ? null : centavos(dados.atacado),
    unidadesPorCaixa: dados.caixa,
  });

  async function cadastrarProdutos(
    sistema: string,
    lista: readonly ProdutoDemo[],
    alvo: (x: ProdutoDemo) => number,
    seqBase: number,
  ): Promise<Produto[]> {
    const produtos: Produto[] = [];
    for (const [k, dados] of lista.entries()) {
      passo();
      const quantidade = alvo(dados);
      const validade =
        dados.validadeDias === null
          ? null
          : somarDias(inicio, Math.round(dados.validadeDias * s.entre(0.6, 1)));
      const r = exigir(
        await api("POST", em(sistema, "/produtos"), {
          ...cadastroDoProduto(dados),
          estoqueMinimo: dados.minimo,
          estoqueInicial: quantidade,
          codigoBarras: ean(seqBase + k),
          custoCentavos: centavos(dados.custo),
          ...(validade ? { validade } : {}),
        }),
        `produto ${dados.nome}`,
      );
      const id = r.produto?.id;
      if (!id) throw new Error(`produto ${dados.nome}: resposta sem id`);
      produtos.push({
        id,
        dados,
        disponivel: quantidade,
        alvo: quantidade,
        validade,
        acumulado: 0,
      });
      contar("produtos");
    }
    return produtos;
  }

  async function cadastrarFornecedores(sistema: string, nomes: readonly string[]) {
    const ids: string[] = [];
    for (const nome of nomes) {
      passo();
      const r = exigir(
        await api("POST", em(sistema, "/fornecedores"), { nome }),
        `fornecedor ${nome}`,
      );
      const id = r.fornecedor?.id;
      if (!id) throw new Error(`fornecedor ${nome}: resposta sem id`);
      ids.push(id);
      contar("fornecedores");
    }
    return ids;
  }

  // Número que não existe: no plano de numeração do Brasil, o assinante nunca começa com 1.
  const telefone = () => `(21) 10000-${String(s.inteiro(0, 9999)).padStart(4, "0")}`;

  // Distribuidora: produtos, fornecedores, técnicos e a base de clientes do primeiro dia.
  const alvoDistribuidora = (x: ProdutoDemo) => {
    if (x.nome.startsWith("Barril")) return 8;
    if (x.caixa === null) return x.giro === "alto" ? 100 : x.giro === "medio" ? 40 : 10;
    const base = x.giro === "alto" ? 480 : x.giro === "medio" ? 144 : 36;
    return Math.ceil(base / x.caixa) * x.caixa;
  };
  const produtosD = await cadastrarProdutos(D, PRODUTOS_DISTRIBUIDORA, alvoDistribuidora, 1);
  const fornecedoresD = await cadastrarFornecedores(D, FORNECEDORES_DISTRIBUIDORA);
  const tecnicos: string[] = [];
  for (const [nome, sobrenome] of TECNICOS) {
    passo();
    const r = exigir(
      await api("POST", em(D, "/profissionais"), { nome: `${nome} ${sobrenome}` }),
      "técnico",
    );
    if (!r.profissional?.id) throw new Error("técnico: resposta sem id");
    tecnicos.push(r.profissional.id);
    contar("profissionais");
  }

  // 60 empresas + 90 pessoas; 2/3 já são clientes no primeiro dia, o resto chega ao longo do período.
  const pessoasUsadas = new Set<string>();
  function pessoa(): { nome: string; sobrenome: string } {
    for (;;) {
      const nome = s.escolher(NOMES);
      const sobrenome = `${s.escolher(SOBRENOMES)}${s.chance(0.3) ? ` ${s.escolher(SOBRENOMES)}` : ""}`;
      const chave = `${nome} ${sobrenome}`;
      if (!pessoasUsadas.has(chave)) {
        pessoasUsadas.add(chave);
        return { nome, sobrenome };
      }
    }
  }
  interface ClientePlano {
    nome: string;
    sobrenome: string | null;
    empresa: boolean;
    desde: number;
  }
  const planos: ClientePlano[] = [
    ...EMPRESAS.map((nome) => ({ nome, sobrenome: null, empresa: true, desde: 0 })),
    ...Array.from({ length: 90 }, () => ({ ...pessoa(), empresa: false, desde: 0 })),
  ];
  for (const plano of planos) {
    plano.desde = s.chance(0.67) ? 0 : s.inteiro(5, dias - 3);
  }
  const clientes: Cliente[] = [];
  const parados = new Set(
    s.embaralhar(planos.filter((x) => x.empresa && x.desde === 0).map((x) => x.nome)).slice(0, 8),
  );
  async function cadastrarCliente(plano: ClientePlano): Promise<Cliente> {
    const contato = semAcento(plano.sobrenome ? `${plano.nome} ${plano.sobrenome}` : plano.nome);
    const r = exigir(
      await api("POST", em(D, "/clientes"), {
        nome: plano.nome,
        ...(plano.sobrenome ? { sobrenome: plano.sobrenome } : {}),
        campos: {
          telefone: telefone(),
          ...(s.chance(plano.empresa ? 0.8 : 0.5) ? { email: `${contato}@example.com` } : {}),
        },
      }),
      `cliente ${plano.nome}`,
    );
    if (!r.cliente?.id) throw new Error(`cliente ${plano.nome}: resposta sem id`);
    contar("clientes");
    const evento =
      !plano.empresa ||
      /Buffet|Festas|Clube|Associação|Espaço|Choperia|Casa de Shows/.test(plano.nome);
    const cliente: Cliente = {
      id: r.cliente.id,
      nome: plano.nome,
      empresa: plano.empresa,
      peso: plano.empresa ? s.entre(2.5, 6) : s.entre(0.3, 1),
      fiado: plano.empresa && s.chance(0.55),
      ultimoDia: parados.has(plano.nome) ? somarDias(o.ate, -s.inteiro(31, 45)) : null,
      evento,
    };
    clientes.push(cliente);
    return cliente;
  }
  for (const plano of planos.filter((x) => x.desde === 0)) {
    passo();
    await cadastrarCliente(plano);
  }
  for (const plano of planos.filter((x) => x.desde > 0)) {
    const dia = diasDoPeriodo[plano.desde] ?? inicio;
    linha.em(instante(dia, 8, s.inteiro(0, 50)), async () => {
      await cadastrarCliente(plano);
    });
  }
  log(`distribuidora: ${produtosD.length} produtos, ${clientes.length} clientes no primeiro dia`);

  // Restaurante: insumos e fornecedores.
  const alvoInsumo = (x: ProdutoDemo) => {
    const ins = x as InsumoDemo;
    const perecivel = ins.validadeDias !== null && ins.validadeDias <= 21;
    return Math.max(ins.minimo + 2, Math.ceil(ins.usoDia * (perecivel ? 5 : 12)) + ins.minimo);
  };
  const insumos = await cadastrarProdutos(R, INSUMOS_RESTAURANTE, alvoInsumo, 500);
  const fornecedoresR = await cadastrarFornecedores(R, FORNECEDORES_RESTAURANTE);
  log(`restaurante: ${insumos.length} insumos`);

  // ---- distribuidora: vendas ----

  const pesoGiro = (x: Produto) => (x.dados.giro === "alto" ? 5 : x.dados.giro === "medio" ? 2 : 1);
  const vendaveis = produtosD.filter((x) => !x.dados.nome.startsWith("Barril"));
  const barris = produtosD.filter((x) => x.dados.nome.startsWith("Barril"));
  const porNome = (trecho: string) => {
    const achado = produtosD.find((x) => x.dados.nome.includes(trecho));
    if (!achado) throw new Error(`produto da demonstração não encontrado: ${trecho}`);
    return achado;
  };

  interface Item {
    produto: Produto;
    caixas: number;
    unidades: number;
  }
  const unidadesDo = (x: Item) => x.caixas * (x.produto.dados.caixa ?? 1) + x.unidades;

  function itensDaVenda(cliente: Cliente, dia: string): Item[] {
    const grande = cliente.empresa && s.chance(0.15);
    const n = cliente.empresa ? (grande ? s.inteiro(5, 9) : s.inteiro(2, 6)) : s.inteiro(1, 4);
    const itens: Item[] = [];
    const usados = new Set<string>();
    for (let k = 0; k < n * 2 && itens.length < n; k++) {
      const produto = s.ponderado(vendaveis, pesoGiro);
      if (usados.has(produto.id)) continue;
      if (produto.validade !== null && produto.validade < dia) continue; // lote vencido não sai
      usados.add(produto.id);
      const caixa = produto.dados.caixa;
      let caixas = 0;
      let unidades = 0;
      if (cliente.empresa) {
        if (caixa === null) unidades = s.inteiro(2, 12);
        else if (produto.dados.giro === "alto")
          caixas = grande ? s.inteiro(4, 12) : s.inteiro(1, 5);
        else if (produto.dados.giro === "medio")
          caixas = grande ? s.inteiro(2, 5) : s.inteiro(1, 2);
        else unidades = s.inteiro(2, 6);
      } else if (caixa !== null && produto.dados.giro !== "baixo" && s.chance(0.2)) {
        caixas = 1;
      } else {
        unidades =
          produto.dados.giro === "baixo"
            ? s.inteiro(1, 2)
            : caixa === null
              ? s.inteiro(1, 3)
              : s.inteiro(2, 12);
      }
      const item = { produto, caixas, unidades };
      if (unidadesDo(item) <= produto.disponivel) itens.push(item);
    }
    return itens;
  }

  function formaDePagamento(cliente: Cliente): string {
    if (cliente.fiado && s.chance(0.4)) return "a_prazo";
    const u = s.numero();
    if (cliente.empresa)
      return u < 0.55
        ? "pix"
        : u < 0.75
          ? "cartao_debito"
          : u < 0.9
            ? "cartao_credito"
            : "dinheiro";
    return u < 0.45 ? "pix" : u < 0.65 ? "cartao_debito" : u < 0.85 ? "cartao_credito" : "dinheiro";
  }

  const corpoItens = (itens: Item[]) =>
    itens.map((x) => ({ produto: x.produto.id, caixas: x.caixas, unidades: x.unidades }));
  const reservar = (itens: Item[], sinal: 1 | -1) => {
    for (const x of itens) x.produto.disponivel -= sinal * unidadesDo(x);
  };

  /**
   * Cria o rascunho agora e agenda a conclusão (ou o descarte) para minutos depois, como um evento
   * da fila: assim o relógio só anda para a frente e o histórico do estoque fica em ordem.
   */
  async function vender(
    cliente: Cliente,
    itens: Item[],
    t: number,
    depois?: (venda: string, quando: number) => Promise<void>,
  ): Promise<void> {
    // O desfecho (conclusão ou descarte) é sorteado antes: se cair depois do fim da carga, a venda
    // nem começa, para não sobrar rascunho segurando estoque.
    const descartar = s.chance(0.02);
    const quando = t + (descartar ? 3 : s.inteiro(2, 8)) * MIN;
    if (quando > fim) return;
    const criada = await api("POST", em(D, "/vendas"), {
      cliente: cliente.id,
      itens: corpoItens(itens),
    });
    if (criada.status >= 400 || !criada.body.venda) {
      recusar(`venda: ${criada.body.error?.code ?? criada.status}`);
      return;
    }
    reservar(itens, 1);
    const venda = criada.body.venda;
    if (descartar) {
      linha.em(quando, async () => {
        exigir(await api("POST", em(D, `/vendas/${venda.id}/descartar`), {}), "descartar venda");
        reservar(itens, -1);
        contar("vendas descartadas");
      });
      return;
    }
    linha.em(quando, async () => {
      let forma = formaDePagamento(cliente);
      let concluida = await api("POST", em(D, `/vendas/${venda.id}/concluir`), {
        revisao: venda.revisao,
        formaPagamento: forma,
      });
      if (concluida.status >= 400 && forma === "a_prazo") {
        // Limite de crédito estourado: o cliente paga no Pix, como faria no balcão.
        recusar(`a prazo recusado: ${concluida.body.error?.code ?? concluida.status}`);
        forma = "pix";
        concluida = await api("POST", em(D, `/vendas/${venda.id}/concluir`), {
          revisao: venda.revisao,
          formaPagamento: forma,
        });
      }
      exigir(concluida, `concluir venda de ${cliente.nome}`);
      contar("vendas concluídas");
      contar(`pagamento ${forma}`);
      if (concluida.body.venda?.faixa === "atacado") contar("vendas no atacado");
      if (depois) await depois(venda.id, quando);
    });
  }

  for (const dia of diasDoPeriodo) {
    const semana = diaDaSemana(dia);
    if (semana === 0) continue; // domingo fechado
    const quantas = semana === 5 || semana === 6 ? s.inteiro(8, 12) : s.inteiro(5, 8);
    const horarios = Array.from(
      { length: quantas },
      () => instante(dia, 8, 30) + s.inteiro(0, 600) * MIN,
    ).sort((a, b) => a - b);
    for (const t of horarios) {
      linha.em(t, async () => {
        const ativos = clientes.filter((c) => c.ultimoDia === null || c.ultimoDia >= dia);
        if (ativos.length === 0) return;
        const cliente = s.ponderado(ativos, (c) => c.peso);
        const itens = itensDaVenda(cliente, dia);
        if (itens.length === 0) return recusar("venda sem estoque");
        await vender(cliente, itens, t, (id, quando) => {
          if (s.chance(0.02)) {
            linha.em(quando + s.inteiro(30, 300) * MIN, async () => {
              exigir(
                await api("POST", em(D, `/vendas/${id}/cancelar`), {
                  motivo: s.escolher([
                    "Cliente desistiu do pedido",
                    "Pedido lançado em duplicidade",
                    "Produto avariado na entrega",
                  ]),
                  cancelarServicos: true,
                }),
                "cancelar venda",
              );
              reservar(itens, -1);
              contar("vendas canceladas");
            });
          }
          return Promise.resolve();
        });
      });
    }

    // Eventos com chope: sexta e sábado (às vezes quinta), com instalação e retirada da chopeira.
    const eventos =
      semana === 5 || semana === 6 ? s.inteiro(0, 2) : semana === 4 && s.chance(0.4) ? 1 : 0;
    for (let e = 0; e < eventos; e++) {
      const t = instante(dia, 9, 0) + s.inteiro(0, 480) * MIN;
      linha.em(t, async () => {
        const candidatos = clientes.filter(
          (c) => c.evento && (c.ultimoDia === null || c.ultimoDia >= dia),
        );
        if (candidatos.length === 0) return;
        const cliente = s.escolher(candidatos);
        const barril = s.escolher(barris);
        if (barril.disponivel < 1) return recusar("evento sem barril");
        const quantos = s.chance(0.25) && barril.disponivel >= 2 ? 2 : 1;
        const itens: Item[] = [{ produto: barril, caixas: 0, unidades: quantos }];
        const extras = [porNome("Copo descartável"), porNome("Gelo em cubos"), porNome("Carvão")];
        for (const extra of extras) {
          const item = { produto: extra, caixas: 0, unidades: s.inteiro(2, 6) };
          if (s.chance(0.7) && unidadesDo(item) <= extra.disponivel) itens.push(item);
        }
        await vender(cliente, itens, t, (venda) => agendarChopeira(cliente, venda, dia));
      });
    }
  }

  async function agendarChopeira(cliente: Cliente, venda: string, dia: string) {
    const diaEvento = somarDias(dia, s.inteiro(1, 3));
    const hora = s.escolher([9, 10, 14, 16]);
    const inicioEv = instante(diaEvento, hora, 0);
    const retirada = instante(somarDias(diaEvento, 1), s.escolher([10, 15]), 0);
    const endereco = `${s.escolher(RUAS)}, ${s.inteiro(10, 999)} - Bairro Exemplo`;
    for (const tecnico of s.embaralhar(tecnicos)) {
      const r = await api("POST", em(D, "/agenda"), {
        cliente: cliente.id,
        profissional: tecnico,
        tipo: "instalacao",
        inicio: inicioEv,
        inicioSegundo: retirada,
        venda,
        campos: { endereco },
      });
      // Técnico ocupado nesse horário: tenta o próximo. Qualquer outro erro interrompe a carga.
      if (r.status === 409 && r.body.error?.code === "conflito_agenda") {
        recusar("agenda: conflito_agenda");
        continue;
      }
      const atendimentos = exigir(r, "agendar chopeira").atendimentos ?? [];
      if (atendimentos.length !== 2) throw new Error("agendar chopeira: o par não foi criado");
      contar("atendimentos agendados", atendimentos.length);
      for (const at of atendimentos) {
        linha.em(at.inicio, async () => {
          exigir(await api("POST", em(D, `/agenda/${at.id}/iniciar`), {}), "iniciar atendimento");
          contar("atendimentos iniciados");
        });
        linha.em(at.inicio + s.inteiro(40, 58) * MIN, async () => {
          exigir(await api("POST", em(D, `/agenda/${at.id}/concluir`), {}), "concluir atendimento");
          contar("atendimentos concluídos");
        });
      }
      // A locação da chopeira é cobrada à parte, no dia do evento.
      await lancar(D, {
        tipo: "receber",
        descricao: `Locação de chopeira - ${cliente.nome}`,
        valorCentavos: 18_000,
        vencimento: diaEvento,
        categoria: "Locação de chopeira",
        cliente: cliente.id,
      });
      return;
    }
    // Os três técnicos ocupados: a venda fica sem o serviço (o painel mostra a venda normalmente).
    recusar("agenda: sem técnico livre");
  }

  // ---- distribuidora: compras, validade e saídas ----

  async function comprar(
    sistema: string,
    fornecedor: string,
    produtos: Produto[],
    dia: string,
    reposicao: (x: Produto) => number,
    vencimentoDias: number | null,
  ) {
    const itens = produtos
      .filter((x) => x.disponivel < reposicao(x))
      .map((x) => {
        const falta = x.alvo - x.disponivel;
        const caixa = x.dados.caixa;
        return caixa === null
          ? { produto: x, caixas: 0, unidades: falta }
          : { produto: x, caixas: Math.ceil(falta / caixa), unidades: 0 };
      })
      .filter((x) => unidadesDo(x) > 0);
    if (itens.length === 0) return;
    const r = exigir(
      await api("POST", em(sistema, "/compras"), {
        fornecedor,
        itens: itens.map((x) => ({
          produto: x.produto.id,
          caixas: x.caixas,
          unidades: x.unidades,
          custoUnitarioCentavos: Math.round(centavos(x.produto.dados.custo) * s.entre(0.96, 1.04)),
        })),
        observacao: "Pedido de reposição",
        ...(vencimentoDias === null ? {} : { vencimento: somarDias(dia, vencimentoDias) }),
      }),
      "compra",
    );
    void r;
    contar("compras");
    for (const x of itens) {
      x.produto.disponivel += unidadesDo(x);
      const validadeDias = x.produto.dados.validadeDias;
      if (validadeDias === null) continue;
      const nova = somarDias(dia, validadeDias);
      // Lote novo: atualiza a validade quando a antiga já passou de 40% do prazo.
      if (
        x.produto.validade === null ||
        x.produto.validade < somarDias(dia, Math.round(validadeDias * 0.6))
      ) {
        exigir(
          await api("PATCH", em(sistema, `/produtos/${x.produto.id}`), {
            ...cadastroDoProduto(x.produto.dados),
            validade: nova,
          }),
          "validade do lote",
        );
        x.produto.validade = nova;
        contar("validades atualizadas");
      }
    }
  }

  async function saida(
    sistema: string,
    produto: Produto,
    unidades: number,
    motivo: string,
    observacao?: string,
  ): Promise<boolean> {
    const n = Math.min(unidades, produto.disponivel);
    if (n < 1) return false;
    const r = await api("POST", em(sistema, "/estoque/saidas"), {
      produto: produto.id,
      caixas: 0,
      unidades: n,
      motivo,
      ...(observacao ? { observacao } : {}),
    });
    if (r.status >= 400) {
      recusar(`saída: ${r.body.error?.code ?? r.status}`);
      return false;
    }
    produto.disponivel -= n;
    contar(`saídas (${motivo})`);
    return true;
  }

  for (const dia of diasDoPeriodo) {
    const semana = diaDaSemana(dia);
    if (semana === 1) {
      for (const [f, fornecedor] of fornecedoresD.entries()) {
        linha.em(instante(dia, 9, 5 + f * 7), () =>
          comprar(
            D,
            fornecedor,
            produtosD.filter((x) => x.dados.fornecedor === f),
            dia,
            (x) => x.alvo * 0.5,
            21,
          ),
        );
      }
    }
    if (semana === 4) {
      // Água, gelo e chope voltam duas vezes por semana.
      for (const f of [0, 2]) {
        const fornecedor = fornecedoresD[f] as string;
        linha.em(instante(dia, 9, 10 + f), () =>
          comprar(
            D,
            fornecedor,
            produtosD.filter(
              (x) =>
                x.dados.fornecedor === f && (x.dados.caixa === null || x.dados.giro === "alto"),
            ),
            dia,
            (x) => x.alvo * 0.4,
            14,
          ),
        );
      }
    }
    if ((semana === 2 || semana === 6) && s.chance(0.7)) {
      linha.em(instante(dia, 16, 20), async () => {
        const quebraveis = produtosD.filter((x) =>
          /garrafa|long neck|Vinho|litrão|Espumante/.test(x.dados.nome),
        );
        await saida(
          D,
          s.escolher(quebraveis),
          s.inteiro(1, 3),
          "Quebra",
          "Garrafa quebrada no depósito",
        );
      });
    }
    if (semana === 1) {
      linha.em(instante(dia, 8, 10), () =>
        saida(
          D,
          porNome("Água mineral sem gás 500 ml"),
          s.inteiro(6, 12),
          "Consumo interno",
          "Água da equipe",
        ),
      );
    }
    if (diaDoMes(dia) === 15) {
      linha.em(instante(dia, 17, 0), () =>
        saida(
          D,
          porNome(s.chance(0.5) ? "IPA" : "Weiss"),
          s.inteiro(4, 6),
          "Degustação",
          "Degustação para clientes",
        ),
      );
    }
    linha.em(instante(dia, 7, 50), async () => {
      // Lote vencido no depósito: sai do estoque com o motivo.
      for (const x of produtosD) {
        if (x.validade !== null && x.validade < dia && x.disponivel > 0) {
          // Só esquece a validade se o lote saiu mesmo; senão ele continua fora das vendas.
          if (await saida(D, x, x.disponivel, "Vencido", "Lote vencido")) x.validade = null;
        }
      }
    });
  }

  // ---- financeiro (distribuidora e estúdio) ----

  async function lancar(
    sistema: string,
    corpo: {
      tipo: "receber" | "pagar";
      descricao: string;
      valorCentavos: number;
      vencimento: string;
      categoria: string;
      cliente?: string;
      fornecedor?: string;
    },
  ) {
    const r = await api("POST", em(sistema, "/financeiro"), corpo);
    if (r.status >= 400) return recusar(`lançamento: ${r.body.error?.code ?? r.status}`);
    contar(`contas a ${corpo.tipo} lançadas`);
  }

  /** Conta fixa do mês: lançada alguns dias antes do vencimento. */
  function contaFixa(
    sistema: string,
    diaVencimento: number,
    antecedencia: number,
    gerar: (vencimento: string) => Parameters<typeof lancar>[1],
  ) {
    const limite = somarDias(o.ate, 40);
    for (let k = 0; k < dias + 40; k++) {
      const vencimento = somarDias(inicio, k);
      if (vencimento > limite || diaDoMes(vencimento) !== diaVencimento) continue;
      const lancamento = somarDias(vencimento, -antecedencia);
      const quando = lancamento < inicio ? inicio : lancamento;
      linha.em(instante(quando, 8, s.inteiro(5, 55)), () => lancar(sistema, gerar(vencimento)));
    }
  }

  const reais = (min: number, max: number) => centavos(s.entre(min, max));
  const despesa = (
    descricao: string,
    categoria: string,
    valorCentavos: number,
    vencimento: string,
  ) => ({
    tipo: "pagar" as const,
    descricao,
    categoria,
    valorCentavos,
    vencimento,
  });

  // Distribuidora
  contaFixa(D, 5, 10, (v) => despesa(`Aluguel do galpão - ${nomeDoMes(v)}`, "Aluguel", 480_000, v));
  contaFixa(D, 5, 10, (v) =>
    despesa(`Folha de pagamento - ${nomeDoMes(v)}`, "Folha de pagamento", 1_140_000, v),
  );
  contaFixa(D, 12, 8, (v) =>
    despesa(`Energia elétrica - ${nomeDoMes(v)}`, "Energia e água", reais(980, 1350), v),
  );
  contaFixa(D, 15, 8, (v) =>
    despesa(`Água e esgoto - ${nomeDoMes(v)}`, "Energia e água", reais(210, 290), v),
  );
  contaFixa(D, 10, 10, (v) =>
    despesa(`Internet e telefone - ${nomeDoMes(v)}`, "Internet e telefone", 18_990, v),
  );
  contaFixa(D, 10, 10, (v) =>
    despesa(`Honorários do contador - ${nomeDoMes(v)}`, "Serviços", 65_000, v),
  );
  contaFixa(D, 20, 10, (v) =>
    despesa(`Simples Nacional - ${nomeDoMes(v)}`, "Impostos", reais(3200, 4200), v),
  );
  for (const dia of diasDoPeriodo) {
    if (diaDaSemana(dia) === 1) {
      linha.em(instante(dia, 7, 40), () =>
        lancar(D, despesa("Combustível dos caminhões", "Combustível", reais(380, 620), dia)),
      );
    }
  }
  const meio = diasDoPeriodo[Math.floor(dias / 2)] ?? inicio;
  linha.em(instante(meio, 10, 0), () =>
    lancar(
      D,
      despesa("Revisão do caminhão de entregas", "Manutenção", 125_000, somarDias(meio, 7)),
    ),
  );
  const terco = diasDoPeriodo[Math.floor(dias / 3)] ?? inicio;
  linha.em(instante(terco, 11, 0), () =>
    lancar(D, despesa("Manutenção das chopeiras", "Manutenção", 32_000, somarDias(terco, 5))),
  );

  // Estúdio: alunos com mensalidade (alguns entram e saem no período), aulas avulsas e despesas.
  const alunos = Array.from({ length: 44 }, (_, k) => {
    const { nome, sobrenome } = pessoa();
    return {
      nome: `${nome} ${sobrenome.split(" ")[0] ?? ""}`,
      plano: s.escolher(PLANOS_ESTUDIO),
      entra: k < 36 ? inicio : somarDias(inicio, s.inteiro(20, dias - 10)),
      sai: k >= 38 ? somarDias(inicio, s.inteiro(30, dias - 5)) : null,
    };
  });
  {
    // Mensalidades: vencem no dia 10 e são lançadas no dia 1, uma por aluno ativo.
    const limite = somarDias(o.ate, 40);
    for (let k = 0; k < dias + 40; k++) {
      const vencimento = somarDias(inicio, k);
      if (vencimento > limite || diaDoMes(vencimento) !== 10) continue;
      const lancamento = somarDias(vencimento, -9);
      const quando = lancamento < inicio ? inicio : lancamento;
      for (const [n, aluno] of alunos.entries()) {
        if (aluno.entra > vencimento || (aluno.sai !== null && aluno.sai < lancamento)) continue;
        linha.em(instante(quando, 8, 0) + n * 30_000, () =>
          lancar(E, {
            tipo: "receber",
            descricao: `Mensalidade de ${nomeDoMes(vencimento)} - ${aluno.nome} (${aluno.plano.nome})`,
            valorCentavos: centavos(aluno.plano.valor),
            vencimento,
            categoria: "Mensalidades",
          }),
        );
      }
    }
  }
  contaFixa(E, 5, 10, (v) => despesa(`Aluguel da sala - ${nomeDoMes(v)}`, "Aluguel", 320_000, v));
  contaFixa(E, 5, 10, (v) =>
    despesa(`Salário da instrutora Camila - ${nomeDoMes(v)}`, "Salários", 260_000, v),
  );
  contaFixa(E, 5, 10, (v) =>
    despesa(`Salário do instrutor Rodrigo - ${nomeDoMes(v)}`, "Salários", 240_000, v),
  );
  contaFixa(E, 12, 8, (v) =>
    despesa(`Energia elétrica - ${nomeDoMes(v)}`, "Contas de consumo", reais(380, 470), v),
  );
  contaFixa(E, 15, 8, (v) =>
    despesa(`Água - ${nomeDoMes(v)}`, "Contas de consumo", reais(110, 140), v),
  );
  contaFixa(E, 10, 8, (v) => despesa(`Internet - ${nomeDoMes(v)}`, "Contas de consumo", 11_990, v));
  contaFixa(E, 10, 10, (v) => despesa(`Contabilidade - ${nomeDoMes(v)}`, "Serviços", 45_000, v));
  contaFixa(E, 20, 10, (v) =>
    despesa(`Simples Nacional - ${nomeDoMes(v)}`, "Impostos", reais(900, 1100), v),
  );
  contaFixa(E, 3, 3, (v) => despesa("Anúncios nas redes sociais", "Marketing", reais(280, 420), v));
  contaFixa(E, 18, 3, (v) =>
    despesa("Anúncios nas redes sociais", "Marketing", reais(250, 400), v),
  );
  contaFixa(E, 8, 4, (v) =>
    despesa("Bolas, faixas elásticas e tapetes", "Materiais", reais(160, 420), v),
  );
  for (const dia of diasDoPeriodo) {
    const semana = diaDaSemana(dia);
    if (semana !== 0 && s.chance(0.5)) {
      const { nome, sobrenome } = pessoa();
      linha.em(instante(dia, 18, s.inteiro(0, 50)), () =>
        lancar(E, {
          tipo: "receber",
          descricao: `Aula avulsa - ${nome} ${sobrenome.split(" ")[0] ?? ""}`,
          valorCentavos: 7_000,
          vencimento: dia,
          categoria: "Aulas avulsas",
        }),
      );
    }
    if (semana === 6 && diaDoMes(dia) >= 15 && diaDoMes(dia) <= 21) {
      linha.em(instante(dia, 9, 0), () =>
        lancar(E, {
          tipo: "receber",
          descricao: s.escolher([
            "Workshop de pilates para gestantes",
            "Workshop de alongamento e postura",
            "Workshop de pilates com bola",
          ]),
          valorCentavos: reais(1350, 2100),
          vencimento: dia,
          categoria: "Workshops",
        }),
      );
    }
  }
  linha.em(instante(meio, 15, 0), () =>
    lancar(
      E,
      despesa("Manutenção dos aparelhos de pilates", "Serviços", 35_000, somarDias(meio, 3)),
    ),
  );

  // Baixas do dia: cada conta pendente tem um destino estável (em dia, atrasada ou em aberto).
  function diaDePagamento(
    l: {
      tipo: string;
      descricao: string;
      vencimento: string;
      valorCentavos: number;
      venda: string | null;
    },
    sistema: string,
  ) {
    // Pela conta em si (não pelo id, que a API sorteia): a mesma semente dá as mesmas baixas.
    const chave = `${sistema === E ? "E" : "D"}|${l.tipo}|${l.descricao}|${l.vencimento}|${l.valorCentavos}`;
    const u = estavel(chave, semente);
    const v = estavel(`${chave}:dias`, semente);
    if (l.tipo === "pagar")
      return u < 0.9 ? l.vencimento : somarDias(l.vencimento, 1 + Math.floor(v * 4));
    if (l.venda) {
      if (u < 0.72) return somarDias(l.vencimento, -Math.floor(v * 4));
      if (u < 0.95) return somarDias(l.vencimento, 3 + Math.floor(v * 18));
      return null;
    }
    if (sistema === E) {
      if (u < 0.8) return somarDias(l.vencimento, -Math.floor(v * 8));
      if (u < 0.95) return somarDias(l.vencimento, 2 + Math.floor(v * 14));
      return null;
    }
    return l.vencimento;
  }
  for (const dia of diasDoPeriodo) {
    for (const [n, sistema] of [D, E].entries()) {
      linha.em(instante(dia, 17, 40 + n * 5), async () => {
        const lista = exigir(
          await api("GET", em(sistema, "/financeiro?status=pendente")),
          "contas pendentes",
        );
        for (const l of lista.lancamentos ?? []) {
          const quando = diaDePagamento(l, sistema);
          if (quando === null || quando > dia) continue;
          const r = await api("POST", em(sistema, `/financeiro/${l.id}/baixar`), {});
          if (r.status >= 400) {
            recusar(`baixa: ${r.body.error?.code ?? r.status}`);
            continue;
          }
          contar(`contas a ${l.tipo} pagas`);
        }
      });
    }
  }

  // ---- restaurante: uso diário, perdas, vencidos, doações e compras ----

  const perecivel = (x: Produto) => x.dados.validadeDias !== null && x.dados.validadeDias <= 21;
  for (const dia of diasDoPeriodo) {
    const semana = diaDaSemana(dia);
    if (semana === 0) continue;
    linha.em(instante(dia, 10, 15), async () => {
      for (const x of insumos) {
        const uso = (x.dados as InsumoDemo).usoDia;
        x.acumulado += uso * s.entre(0.6, 1.4);
        const limiar = Math.max(3, uso * 4);
        if (x.acumulado < limiar) continue;
        if (x.validade !== null && x.validade < dia) continue; // vencido não vai para a cozinha
        const n = Math.floor(x.acumulado);
        x.acumulado -= n;
        await saida(R, x, n, "Uso na cozinha", "Retirada para a cozinha");
      }
    });
    if (s.chance(0.35)) {
      linha.em(instante(dia, 21, 30), async () => {
        const x = s.escolher(insumos.filter(perecivel));
        await saida(R, x, s.inteiro(1, 2), "Perda", "Estragou antes do uso");
      });
    }
    linha.em(instante(dia, 7, 30), async () => {
      for (const x of insumos) {
        if (x.validade !== null && x.validade < dia && x.disponivel > 0) {
          if (await saida(R, x, x.disponivel, "Vencido", "Passou da validade")) x.validade = null;
        }
      }
    });
    if (diaDoMes(dia) === 28) {
      linha.em(instante(dia, 16, 0), () =>
        saida(
          R,
          s.escolher(insumos.filter((x) => /Banana|Pão/.test(x.dados.nome))),
          s.inteiro(2, 4),
          "Doação",
          "Doação para o abrigo do bairro",
        ),
      );
    }
    const pedidos: [number, number][] = [];
    if (semana === 1 || semana === 4) pedidos.push([2, 8]); // hortifruti
    if (semana === 2 || semana === 5) pedidos.push([1, 8]); // laticínios
    if (semana === 3) pedidos.push([0, 9]); // mercearia
    if (semana === 2) pedidos.push([3, 9]); // carnes
    for (const [f, hora] of pedidos) {
      const t = instante(dia, hora, 10 + f * 5);
      linha.em(t, () =>
        comprar(
          R,
          fornecedoresR[f] as string,
          insumos.filter((x) => x.dados.fornecedor === f),
          dia,
          (x) => (x.dados as InsumoDemo).usoDia * (perecivel(x) ? 3 : 5) + x.dados.minimo,
          null,
        ),
      );
    }
  }

  // ---- executa em ordem cronológica ----
  let executados = 0;
  let marco = 0;
  let ultimo = relogioDaPreparacao;
  for (let ev = linha.proximo(); ev; ev = linha.proximo()) {
    if (ev.t > fim) continue; // depois do fim: fica no futuro (agenda e contas a vencer)
    if (ev.t < ultimo) throw new Error("evento antes do anterior: o relógio não pode voltar");
    ultimo = ev.t;
    o.relogio(ev.t);
    await ev.fazer();
    executados++;
    if (ev.t - marco >= 7 * DIA_MS) {
      marco = ev.t;
      log(`${new Date(ev.t - FUSO).toISOString().slice(0, 10)}: ${executados} eventos`);
    }
  }
  o.relogio(fim);
  return {
    sistemas: [
      { nome: NOMES_SISTEMAS.distribuidora, id: D },
      { nome: NOMES_SISTEMAS.estudio, id: E },
      { nome: NOMES_SISTEMAS.restaurante, id: R },
    ],
    contagem,
    recusas,
  };
}
