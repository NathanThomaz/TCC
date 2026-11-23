// Cadastros fictícios da demonstração (pedido do dono, 2026-11-23): nomes inventados, telefones e
// e-mails fora de uso real (domínio example.com). Nada aqui vem de pessoas ou empresas reais.

/** Giro do produto: define a quantidade vendida e o estoque que a loja mantém. */
export type Giro = "alto" | "medio" | "baixo";

export interface ProdutoDemo {
  nome: string;
  /** Preços em reais (convertidos para centavos ao cadastrar). */
  varejo: number;
  atacado: number | null;
  caixa: number | null;
  custo: number;
  giro: Giro;
  /** Índice do fornecedor na lista do negócio. */
  fornecedor: number;
  /** Dias de validade de um lote novo; null = sem validade. */
  validadeDias: number | null;
  minimo: number;
}

const p = (
  nome: string,
  varejo: number,
  atacado: number | null,
  caixa: number | null,
  custo: number,
  giro: Giro,
  fornecedor: number,
  validadeDias: number | null,
  minimo: number,
): ProdutoDemo => ({
  nome,
  varejo,
  atacado,
  caixa,
  custo,
  giro,
  fornecedor,
  validadeDias,
  minimo,
});

// ---- Distribuidora de bebidas ----

export const FORNECEDORES_DISTRIBUIDORA = [
  "Cervejaria Vale Dourado",
  "Bebidas Atlântico Distribuição",
  "Águas da Serra Mineração",
  "Adega Bom Vinho Importadora",
  "Casa do Festeiro Descartáveis",
];

export const PRODUTOS_DISTRIBUIDORA: ProdutoDemo[] = [
  p("Cerveja Pilsen lata 350 ml", 4.49, 3.79, 12, 2.9, "alto", 0, 180, 120),
  p("Cerveja Puro Malte lata 350 ml", 5.29, 4.49, 12, 3.5, "alto", 0, 180, 96),
  p("Cerveja Pilsen long neck 330 ml", 6.49, 5.49, 24, 4.1, "medio", 0, 180, 48),
  p("Cerveja Puro Malte long neck 330 ml", 7.49, 6.29, 24, 4.8, "medio", 0, 180, 48),
  p("Cerveja Pilsen garrafa 600 ml", 9.9, 8.4, 24, 6.3, "alto", 0, 180, 48),
  p("Cerveja Pilsen litrão 1 L", 11.9, 9.9, 12, 7.6, "alto", 0, 180, 36),
  p("Cerveja sem álcool lata 350 ml", 4.99, 4.19, 12, 3.2, "baixo", 0, 180, 24),
  p("Cerveja IPA artesanal 500 ml", 18.9, 15.9, 12, 11.5, "baixo", 0, 120, 12),
  p("Cerveja Weiss artesanal 500 ml", 17.9, 14.9, 12, 10.9, "baixo", 0, 120, 12),
  p("Barril de chope Pilsen 30 L", 489, 449, null, 330, "baixo", 0, 30, 2),
  p("Barril de chope Pilsen 50 L", 749, 690, null, 510, "baixo", 0, 30, 2),
  p("Refrigerante cola 2 L", 10.99, 9.29, 6, 6.9, "alto", 1, 150, 36),
  p("Refrigerante cola lata 350 ml", 4.99, 4.19, 12, 3.1, "alto", 1, 150, 48),
  p("Refrigerante guaraná 2 L", 8.99, 7.49, 6, 5.4, "alto", 1, 150, 36),
  p("Refrigerante guaraná lata 350 ml", 4.49, 3.79, 12, 2.8, "alto", 1, 150, 48),
  p("Refrigerante laranja 2 L", 8.49, 6.99, 6, 5.1, "medio", 1, 150, 24),
  p("Refrigerante limão 2 L", 8.49, 6.99, 6, 5.1, "medio", 1, 150, 24),
  p("Água tônica lata 350 ml", 4.79, 3.99, 12, 2.95, "medio", 1, 150, 24),
  p("Suco de uva integral 1 L", 14.9, 12.9, 6, 9.2, "medio", 1, 240, 12),
  p("Suco de laranja 1 L", 9.9, 8.3, 6, 6.1, "medio", 1, 60, 12),
  p("Energético lata 473 ml", 9.99, 8.49, 6, 6.2, "medio", 1, 240, 24),
  p("Isotônico 500 ml", 5.99, 4.99, 6, 3.6, "medio", 1, 240, 24),
  p("Chá gelado de limão 1,5 L", 7.99, 6.59, 6, 4.7, "baixo", 1, 180, 12),
  p("Água mineral sem gás 500 ml", 2.49, 1.89, 12, 1.1, "alto", 2, 365, 96),
  p("Água mineral com gás 500 ml", 2.99, 2.29, 12, 1.4, "alto", 2, 365, 48),
  p("Água mineral 1,5 L", 4.49, 3.49, 6, 2.2, "medio", 2, 365, 36),
  p("Galão de água mineral 20 L", 16.9, 13.9, null, 9, "medio", 2, 90, 10),
  p("Gelo em cubos 5 kg", 14.9, 11.9, null, 6.5, "alto", 2, null, 30),
  p("Gelo em escamas 10 kg", 22.9, 18.9, null, 10.5, "medio", 2, null, 15),
  p("Vinho tinto seco 750 ml", 39.9, 33.9, 6, 22, "baixo", 3, 720, 12),
  p("Vinho branco suave 750 ml", 34.9, 29.9, 6, 19.5, "baixo", 3, 720, 12),
  p("Vinho rosé 750 ml", 42.9, 36.9, 6, 24, "baixo", 3, 720, 6),
  p("Espumante brut 750 ml", 49.9, 42.9, 6, 28, "baixo", 3, 540, 6),
  p("Cachaça prata 1 L", 24.9, 20.9, 12, 13, "medio", 3, null, 12),
  p("Cachaça ouro envelhecida 700 ml", 59.9, 51.9, 6, 34, "baixo", 3, null, 6),
  p("Vodka 1 L", 39.9, 33.9, 12, 22.5, "medio", 3, null, 12),
  p("Gin seco 750 ml", 89.9, 76.9, 6, 52, "baixo", 3, null, 6),
  p("Whisky 8 anos 1 L", 129.9, 112.9, 6, 78, "baixo", 3, null, 6),
  p("Rum prata 1 L", 44.9, 38.9, 6, 25, "baixo", 3, null, 6),
  p("Licor de chocolate 750 ml", 54.9, 46.9, 6, 31, "baixo", 3, 720, 4),
  p("Copo descartável 300 ml (pacote com 100)", 9.9, 7.9, 20, 4.8, "medio", 4, null, 20),
  p("Carvão vegetal 5 kg", 24.9, 19.9, null, 13, "medio", 4, null, 10),
  p("Guardanapo de papel (pacote com 50)", 4.5, 3.5, 40, 2.1, "baixo", 4, null, 20),
];

/** Clientes pessoa jurídica (compram em caixas, alguns a prazo). */
export const EMPRESAS = [
  "Bar do Zeca",
  "Bar da Tia Nena",
  "Bar e Petiscaria Esquina Carioca",
  "Boteco do Alemão",
  "Bar Ponto de Encontro",
  "Bar do Português",
  "Botequim Lapa Velha",
  "Bar Recanto do Samba",
  "Quiosque Pé na Areia",
  "Quiosque Sol e Mar",
  "Quiosque Maré Alta",
  "Restaurante Sabor Mineiro",
  "Restaurante Tempero da Vó",
  "Restaurante Mar Azul",
  "Restaurante Cantinho Nordestino",
  "Churrascaria Fogo de Chão Grande",
  "Pizzaria Forno a Lenha Bella",
  "Pizzaria Nápoles do Méier",
  "Hamburgueria Brasa Burger",
  "Lanchonete Ponto Certo",
  "Lanchonete Estação",
  "Lanchonete Pão Quente",
  "Padaria Trigo de Ouro",
  "Padaria Nova Aurora",
  "Mercadinho Bom Preço",
  "Mercadinho São Jorge",
  "Mercadinho Vila Nova",
  "Minimercado Família",
  "Empório Santa Clara",
  "Adega Bom Gosto",
  "Adega Rio Antigo",
  "Buffet Alegria Festas",
  "Buffet Sonho Encantado",
  "Buffet Estrela Eventos",
  "Espaço de Festas Jardim Verde",
  "Salão de Festas Primavera",
  "Clube Recreativo Bandeirantes",
  "Associação dos Moradores do Grajaú",
  "Petiscaria Boa Prosa",
  "Petiscaria Canto do Peixe",
  "Pastelaria Sabor do Bairro",
  "Sorveteria Gelato Bom",
  "Açaí da Praça",
  "Food Truck Rota 66 Grill",
  "Cervejaria de Garagem Lúpulo Bom",
  "Casa de Shows Batuque",
  "Hotel Pousada Beira Rio",
  "Academia Corpo em Forma",
  "Choperia Barril de Ouro",
  "Restaurante Bistrô da Praça",
  "Bar Esporte Clube Tijuca",
  "Bar Toca do Coelho",
  "Lanchonete Sabor da Esquina",
  "Mercearia do Seu Antônio",
  "Conveniência Posto Avenida",
  "Conveniência 24 Horas Centro",
  "Quiosque Point do Surf",
  "Bar Cantinho da Vila",
  "Restaurante Grelha Nobre",
  "Buffet Doce Encontro",
];

export const NOMES = [
  "Ana",
  "Bruno",
  "Camila",
  "Daniel",
  "Eduarda",
  "Felipe",
  "Gabriela",
  "Henrique",
  "Isabela",
  "João",
  "Juliana",
  "Lucas",
  "Mariana",
  "Mateus",
  "Natália",
  "Otávio",
  "Patrícia",
  "Rafael",
  "Renata",
  "Rodrigo",
  "Sabrina",
  "Thiago",
  "Vanessa",
  "Vinícius",
  "Larissa",
  "Gustavo",
  "Aline",
  "Leonardo",
  "Beatriz",
  "Marcelo",
  "Carla",
  "Diego",
  "Fernanda",
  "André",
  "Priscila",
  "Fábio",
  "Letícia",
  "Ricardo",
  "Tatiane",
  "Paulo",
];

export const SOBRENOMES = [
  "Silva",
  "Santos",
  "Oliveira",
  "Souza",
  "Rodrigues",
  "Ferreira",
  "Alves",
  "Pereira",
  "Lima",
  "Gomes",
  "Costa",
  "Ribeiro",
  "Martins",
  "Carvalho",
  "Almeida",
  "Lopes",
  "Soares",
  "Fernandes",
  "Vieira",
  "Barbosa",
  "Rocha",
  "Dias",
  "Nascimento",
  "Andrade",
  "Moreira",
  "Nunes",
  "Marques",
  "Machado",
  "Mendes",
  "Freitas",
  "Cardoso",
  "Ramos",
  "Gonçalves",
  "Santana",
  "Teixeira",
  "Moura",
  "Araújo",
  "Campos",
  "Pinto",
  "Correia",
];

export const TECNICOS = [
  ["Carlos", "Mendonça"],
  ["Ana Paula", "Ribeiro"],
  ["Sérgio", "Lacerda"],
] as const;

export const RUAS = [
  "Rua das Laranjeiras",
  "Rua Conde de Bonfim",
  "Avenida Maracanã",
  "Rua Barão de Mesquita",
  "Rua Uruguai",
  "Rua Haddock Lobo",
  "Rua São Francisco Xavier",
  "Avenida Paulo de Frontin",
  "Rua Dias da Cruz",
  "Rua Voluntários da Pátria",
];

// ---- Restaurante (controle de estoque de insumos) ----

export const FORNECEDORES_RESTAURANTE = [
  "Mercearia Atacado Rio",
  "Laticínios Serra Verde",
  "Hortifruti Bom Preço",
  "Carnes Boi Bom",
];

/** Insumo: uso médio por dia de funcionamento (unidades). */
export interface InsumoDemo extends ProdutoDemo {
  usoDia: number;
}

const i = (
  nome: string,
  preco: number,
  fornecedor: number,
  validadeDias: number | null,
  minimo: number,
  usoDia: number,
): InsumoDemo => ({
  // O controle de estoque não vende em caixas: o insumo entra e sai por unidade.
  ...p(nome, preco, null, null, preco, "medio", fornecedor, validadeDias, minimo),
  usoDia,
});

export const INSUMOS_RESTAURANTE: InsumoDemo[] = [
  i("Arroz tipo 1 (pacote 5 kg)", 28.9, 0, 365, 6, 1.6),
  i("Feijão carioca (pacote 1 kg)", 8.9, 0, 240, 8, 2.2),
  i("Feijão preto (pacote 1 kg)", 9.5, 0, 240, 4, 0.8),
  i("Óleo de soja 900 ml", 7.9, 0, 300, 6, 1.5),
  i("Azeite extravirgem 500 ml", 39.9, 0, 540, 2, 0.3),
  i("Açúcar refinado (pacote 1 kg)", 4.9, 0, 540, 4, 0.7),
  i("Sal refinado (pacote 1 kg)", 2.9, 0, null, 3, 0.4),
  i("Farinha de trigo (pacote 1 kg)", 5.9, 0, 180, 4, 0.9),
  i("Farinha de mandioca (pacote 1 kg)", 7.5, 0, 180, 3, 0.5),
  i("Macarrão espaguete 500 g", 4.9, 0, 365, 6, 1.4),
  i("Café torrado 500 g", 18.9, 0, 180, 3, 0.6),
  i("Molho de tomate 340 g", 3.9, 0, 365, 10, 2.5),
  i("Vinagre 750 ml", 3.5, 0, 720, 2, 0.3),
  i("Detergente 500 ml", 2.9, 0, null, 6, 1.2),
  i("Embalagem marmitex nº 8 (pacote com 100)", 34.9, 0, null, 2, 0.4),
  i("Leite integral 1 L", 5.49, 1, 120, 12, 3),
  i("Queijo muçarela (peça 1 kg)", 42, 1, 30, 3, 0.8),
  i("Manteiga 500 g", 24.9, 1, 60, 2, 0.4),
  i("Creme de leite 200 g", 3.9, 1, 180, 8, 1.5),
  i("Requeijão 400 g", 12.9, 1, 45, 3, 0.5),
  i("Ovos (bandeja com 30)", 22.9, 1, 21, 3, 0.9),
  i("Tomate (saco 3 kg)", 18, 2, 7, 3, 1.1),
  i("Cebola (saco 3 kg)", 12, 2, 20, 3, 0.9),
  i("Alho (pacote 1 kg)", 32, 2, 30, 2, 0.3),
  i("Batata (saco 5 kg)", 22, 2, 20, 3, 0.8),
  i("Alface crespa (unidade)", 3.5, 2, 5, 6, 2.5),
  i("Limão (saco 2 kg)", 9, 2, 15, 2, 0.5),
  i("Cenoura (saco 2 kg)", 8, 2, 15, 2, 0.5),
  i("Banana prata (dúzia)", 8.5, 2, 6, 3, 0.8),
  i("Peito de frango congelado (pacote 1 kg)", 19.9, 3, 90, 8, 2.4),
  i("Carne moída congelada (pacote 1 kg)", 36.9, 3, 90, 5, 1.3),
  i("Alcatra (peça 1 kg)", 52.9, 3, 90, 4, 1),
  i("Linguiça toscana (pacote 1 kg)", 24.9, 3, 60, 3, 0.7),
  i("Filé de tilápia congelado (pacote 1 kg)", 44.9, 3, 120, 3, 0.6),
  i("Bacon em cubos (pacote 500 g)", 21.9, 3, 60, 2, 0.4),
  i("Pão francês congelado (pacote 2 kg)", 26.9, 0, 60, 2, 0.6),
  i("Guardanapo de papel (pacote com 50)", 4.5, 0, null, 6, 1.2),
];

// ---- Estúdio de pilates (controle financeiro) ----

export const PLANOS_ESTUDIO = [
  { nome: "2 vezes por semana", valor: 280 },
  { nome: "3 vezes por semana", valor: 340 },
  { nome: "Livre", valor: 390 },
];
