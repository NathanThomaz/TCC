import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, PackagePlus, Pencil, Plus, Scale } from "lucide-react";
import { toast } from "sonner";
import type { CamposInformativos, ProdutoDto } from "../../../shared/api";
import { formatarCentavos } from "../../../shared/dominio/precos";
import {
  corrigirSaldo,
  criarProduto,
  editarProduto,
  listarProdutos,
  mudarStatus,
  registrarEntrada,
} from "@/api/operacao";
import { CamposForm, ErroApi, Tabela, useChavePorConteudo } from "@/components/app/Comum";
import { BotaoCamera } from "@/components/app/VendaRapida";
import { ColunaEditavel, NovaColuna } from "@/components/app/Colunas";
import { ImportarPlanilha } from "@/components/app/ImportarPlanilha";
import { CampoDinheiro } from "@/components/nexus/CampoDinheiro";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { centavosParaReais, reaisParaCentavos, rotuloCampo } from "@/lib/nexus";
import { rotuloModulo, useApp } from "./Aplicacao";

// Produtos e saldos (seções 10 e 11). Físico, reservado e disponível vêm do backend, calculados
// no instante da consulta (EST-05). Correção de saldo é só do administrador (EST-03).

type Dialogo =
  | { tipo: "produto"; atual: ProdutoDto | null }
  | { tipo: "entrada"; produto: ProdutoDto }
  | { tipo: "correcao"; produto: ProdutoDto };

/** Margem sobre o preço de venda ("35%"); null sem valor de compra. */
export function margem(vendaCentavos: number, custoCentavos: number | null): string | null {
  if (custoCentavos === null || vendaCentavos <= 0) return null;
  return `${Math.round(((vendaCentavos - custoCentavos) / vendaCentavos) * 100)}%`;
}

/** Prévia no formulário: margem e lucro por unidade, enquanto a pessoa digita. */
function margemDaTela(venda: string, custo: string): string | null {
  const v = reaisParaCentavos(venda);
  const c = custo.trim() === "" ? null : reaisParaCentavos(custo);
  if (v === null || v <= 0 || c === null) return null;
  const lucro = v - c;
  return lucro >= 0
    ? `Margem de ${margem(v, c)}: ${formatarCentavos(lucro)} de lucro por unidade.`
    : `Atenção: o preço de venda está ${formatarCentavos(-lucro)} abaixo do valor de compra.`;
}

export function Produtos() {
  const app = useApp();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["app", app.id, "produtos"],
    queryFn: () => listarProdutos(app.id),
  });
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const temEstoque = app.config.modulos.includes("estoque");
  const temAtacado = app.config.regras.some((r) => r.tipo === "limite_atacado");
  const temCaixa = app.config.regras.some((r) => r.tipo === "unidades_por_caixa");

  const status = useMutation({
    mutationFn: (p: ProdutoDto) =>
      mudarStatus(app.id, "produtos", p.id, p.status === "active" ? "inactive" : "active"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["app", app.id, "produtos"] }),
    onError: (e) => toast.error(e.message),
  });

  const campos = app.config.campos.filter((c) => c.entidade === "produtos");
  const col = (c: Parameters<typeof rotuloCampo>[1]) => (
    <ColunaEditavel chave={c} rotulo={rotuloCampo(app.config, c)} />
  );
  const cabecalho = [
    col("produtos.item"),
    col("produtos.varejo"),
    "Compra",
    "Margem",
    ...(temAtacado ? [col("produtos.atacado")] : []),
    ...(temCaixa ? [col("produtos.caixa")] : []),
    ...campos.map((c) => <ColunaEditavel chave={`campo:produtos:${c.id}`} rotulo={c.rotulo} />),
    ...(temEstoque ? ["Físico", "Reservado", "Disponível", "Mínimo"] : []),
    <span className="sr-only">Ações</span>,
  ];

  return (
    <>
      <PageHeader
        titulo={rotuloModulo(app, "produtos")}
        descricao={
          temEstoque
            ? "Disponível = físico − reservado em rascunhos de venda ainda no prazo."
            : undefined
        }
        acoes={
          <>
            <ImportarPlanilha tipo="produtos" />
            <NovaColuna entidade="produtos" />
            <Button onClick={() => setDialogo({ tipo: "produto", atual: null })}>
              <Plus aria-hidden /> Novo {rotuloCampo(app.config, "produtos.item").toLowerCase()}
            </Button>
          </>
        }
      />
      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icone={Package}
          titulo="Nenhum produto ainda"
          descricao="Cadastre os produtos; o estoque começa em zero e cresce pelas entradas."
        />
      ) : (
        <Tabela cabecalho={cabecalho}>
          {q.data.map((p) => (
            <tr
              key={p.id}
              className={p.status === "inactive" ? "text-muted-foreground" : undefined}
            >
              <td className="px-4 py-2 font-medium">
                {p.nome}
                {p.status === "inactive" && <span className="ml-2 text-xs">(inativo)</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                {formatarCentavos(p.varejoCentavos)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                {p.custoCentavos === null ? "—" : formatarCentavos(p.custoCentavos)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                {margem(p.varejoCentavos, p.custoCentavos) ?? "—"}
              </td>
              {temAtacado && (
                <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                  {p.atacadoCentavos === null ? "—" : formatarCentavos(p.atacadoCentavos)}
                </td>
              )}
              {temCaixa && (
                <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                  {p.unidadesPorCaixa === null ? "—" : `${p.unidadesPorCaixa} un.`}
                </td>
              )}
              {campos.map((c) => (
                <td key={c.id} className="px-4 py-2">
                  {p.campos[c.id] === undefined ? "—" : String(p.campos[c.id])}
                </td>
              ))}
              {temEstoque && (
                <>
                  <td className="px-4 py-2 tabular-nums">{p.fisico}</td>
                  <td className="px-4 py-2 tabular-nums">{p.reservado}</td>
                  <td
                    className={cn(
                      "px-4 py-2 font-medium tabular-nums",
                      p.estoqueMinimo !== null &&
                        p.disponivel < p.estoqueMinimo &&
                        "text-destructive",
                    )}
                  >
                    {p.disponivel}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">
                    {p.estoqueMinimo ?? "—"}
                  </td>
                </>
              )}
              <td className="px-4 py-2">
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Editar ${p.nome}`}
                    onClick={() => setDialogo({ tipo: "produto", atual: p })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  {temEstoque && p.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDialogo({ tipo: "entrada", produto: p })}
                    >
                      <PackagePlus aria-hidden /> Entrada
                    </Button>
                  )}
                  {temEstoque && app.papel === "admin" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDialogo({ tipo: "correcao", produto: p })}
                    >
                      <Scale aria-hidden /> Corrigir
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={status.isPending}
                    onClick={() => status.mutate(p)}
                  >
                    {p.status === "active" ? "Inativar" : "Reativar"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Tabela>
      )}
      {dialogo?.tipo === "produto" && (
        <ProdutoDialog atual={dialogo.atual} onFechar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === "entrada" && (
        <EntradaDialog produto={dialogo.produto} onFechar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === "correcao" && (
        <CorrecaoDialog produto={dialogo.produto} onFechar={() => setDialogo(null)} />
      )}
    </>
  );
}

function useInvalidarProdutos() {
  const app = useApp();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["app", app.id, "produtos"] });
    void qc.invalidateQueries({ queryKey: ["app", app.id, "movimentos"] });
  };
}

function ProdutoDialog({ atual, onFechar }: { atual: ProdutoDto | null; onFechar: () => void }) {
  const app = useApp();
  const invalidar = useInvalidarProdutos();
  const chave = useChavePorConteudo();
  const regraCaixa = app.config.regras.find((r) => r.tipo === "unidades_por_caixa");
  const temAtacado = app.config.regras.some((r) => r.tipo === "limite_atacado");
  const [nome, setNome] = useState(atual?.nome ?? "");
  const [varejo, setVarejo] = useState(atual ? centavosParaReais(atual.varejoCentavos) : "");
  const [atacado, setAtacado] = useState(
    atual?.atacadoCentavos ? centavosParaReais(atual.atacadoCentavos) : "",
  );
  // PRE-05: a regra sugere o fator; cada produto guarda o seu (vazio = só unidades).
  const [caixa, setCaixa] = useState(
    atual ? String(atual.unidadesPorCaixa ?? "") : regraCaixa ? String(regraCaixa.unidades) : "",
  );
  const [campos, setCampos] = useState<CamposInformativos>(atual?.campos ?? {});
  const temEstoque = app.config.modulos.includes("estoque");
  const [inicial, setInicial] = useState("");
  const [minimo, setMinimo] = useState(atual?.estoqueMinimo ? String(atual.estoqueMinimo) : "");
  const [codigo, setCodigo] = useState(atual?.codigoBarras ?? "");
  const [custo, setCusto] = useState(
    atual && atual.custoCentavos !== null ? centavosParaReais(atual.custoCentavos) : "",
  );
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const item = rotuloCampo(app.config, "produtos.item").toLowerCase();

  const m = useMutation({
    mutationFn: () => {
      const v = reaisParaCentavos(varejo);
      const a = temAtacado ? reaisParaCentavos(atacado) : null;
      if (v === null || v <= 0) {
        throw new Error(`Informe o ${rotuloCampo(app.config, "produtos.varejo").toLowerCase()}.`);
      }
      if (temAtacado && (a === null || a <= 0)) throw new Error("Informe o preço de atacado.");
      const c = custo.trim() === "" ? null : reaisParaCentavos(custo);
      if (custo.trim() !== "" && c === null) throw new Error("Valor de compra inválido.");
      const qtd = (t: string) => (t.trim() === "" ? null : Number(t));
      const estoqueInicial = qtd(inicial);
      const estoqueMinimo = qtd(minimo);
      for (const n of [estoqueInicial, estoqueMinimo]) {
        if (n !== null && (!Number.isInteger(n) || n < 1)) {
          throw new Error("Quantidades de estoque são números inteiros a partir de 1.");
        }
      }
      const dados = {
        nome: nome.trim(),
        varejoCentavos: v,
        atacadoCentavos: a,
        unidadesPorCaixa: regraCaixa && caixa.trim() !== "" ? Number(caixa) : null,
        campos,
        estoqueMinimo: temEstoque ? estoqueMinimo : null,
        codigoBarras: codigo.trim() || null,
        // Na edição, só manda o custo se a pessoa mudou: o campo vem com o custo em uso (talvez
        // o da última compra), que não deve virar "valor informado" só por salvar o nome.
        ...(!atual || c !== atual.custoCentavos ? { custoCentavos: c } : {}),
        ...(!atual && temEstoque && estoqueInicial !== null ? { estoqueInicial } : {}),
      };
      return atual
        ? editarProduto(app.id, atual.id, dados)
        : criarProduto(app.id, dados, chave(dados));
    },
    onMutate: () => setErroLocal(null),
    onSuccess: () => {
      invalidar();
      toast.success(
        atual
          ? "Produto atualizado. O preço novo vale para itens adicionados daqui em diante."
          : "Produto criado.",
      );
      onFechar();
    },
    onError: (e) => setErroLocal(e.message),
  });

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{atual ? `Editar ${atual.nome}` : `Novo ${item}`}</DialogTitle>
            <DialogDescription>
              {atual ? "Atualize os dados" : "Cadastre o nome, o preço"}
              {temEstoque && !atual ? " e quanto já tem em estoque" : ""}.
              {regraCaixa ? " Na caixa, o preço é o da unidade × unidades por caixa." : ""}
            </DialogDescription>
          </DialogHeader>
          {/* Grade única: os campos curtos ficam lado a lado e o formulário não cresce para baixo. */}
          <div className="grid grid-cols-2 items-start gap-x-3 gap-y-4 sm:grid-cols-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="produto-nome">{rotuloCampo(app.config, "produtos.nome")}</Label>
              <Input
                id="produto-nome"
                value={nome}
                maxLength={120}
                required
                autoFocus
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="produto-varejo">
                {rotuloCampo(app.config, "produtos.varejo")} (R$)
              </Label>
              <CampoDinheiro
                id="produto-varejo"
                placeholder="0,00"
                valor={varejo}
                required
                onValor={setVarejo}
              />
            </div>
            {temAtacado && (
              <div className="space-y-1.5">
                <Label htmlFor="produto-atacado">
                  {rotuloCampo(app.config, "produtos.atacado")} (R$)
                </Label>
                <CampoDinheiro
                  id="produto-atacado"
                  placeholder="0,00"
                  valor={atacado}
                  required
                  onValor={setAtacado}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="produto-custo">Valor de compra (R$)</Label>
              <CampoDinheiro
                id="produto-custo"
                placeholder="0,00"
                valor={custo}
                onValor={setCusto}
                aria-describedby="dica-custo"
              />
              <p id="dica-custo" className="text-xs text-muted-foreground" aria-live="polite">
                {margemDaTela(varejo, custo) ??
                  "Opcional. Quanto você paga pela unidade: mostra margem e lucro."}
              </p>
            </div>
            {regraCaixa && (
              <div className="space-y-1.5">
                <Label htmlFor="produto-caixa">{rotuloCampo(app.config, "produtos.caixa")}</Label>
                <Input
                  id="produto-caixa"
                  type="number"
                  min={2}
                  max={1000}
                  value={caixa}
                  onChange={(e) => setCaixa(e.target.value)}
                  aria-describedby="dica-caixa"
                />
                <p id="dica-caixa" className="text-xs text-muted-foreground">
                  Vazio: vende só em unidades.
                </p>
              </div>
            )}
            {temEstoque && !atual && (
              <div className="space-y-1.5">
                <Label htmlFor="produto-inicial">Estoque inicial</Label>
                <Input
                  id="produto-inicial"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="0"
                  value={inicial}
                  onChange={(e) => setInicial(e.target.value)}
                  aria-describedby="dica-inicial"
                />
                <p id="dica-inicial" className="text-xs text-muted-foreground">
                  O que já tem hoje, em unidades.
                </p>
              </div>
            )}
            {temEstoque && (
              <div className="space-y-1.5">
                <Label htmlFor="produto-minimo">Avisar abaixo de</Label>
                <Input
                  id="produto-minimo"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Sem aviso"
                  value={minimo}
                  onChange={(e) => setMinimo(e.target.value)}
                  aria-describedby="dica-minimo"
                />
                <p id="dica-minimo" className="text-xs text-muted-foreground">
                  Unidades deste {item}; vazio, avisa só quando acabar.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="produto-codigo">Código de barras</Label>
              <div className="flex gap-2">
                <Input
                  id="produto-codigo"
                  value={codigo}
                  maxLength={64}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Leitor ou digite"
                  onChange={(e) => setCodigo(e.target.value)}
                  // O leitor USB termina com Enter: não envia o formulário antes da hora.
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  aria-describedby="dica-codigo"
                />
                <BotaoCamera
                  descricao="O código lido entra no cadastro deste produto."
                  onLido={setCodigo}
                />
              </div>
              <p id="dica-codigo" className="text-xs text-muted-foreground">
                Opcional. Com o código, a venda aceita o leitor ou a câmera.
              </p>
            </div>
          </div>
          <CamposForm
            config={app.config}
            entidade="produtos"
            valores={campos}
            onChange={setCampos}
            prefixo="produto"
          />
          {erroLocal && (
            <p role="alert" className="text-sm text-destructive">
              {erroLocal}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending || nome.trim() === ""}>
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** EST-02: entrada em caixas e/ou unidades, com motivo; responsável e data ficam no registro. */
function EntradaDialog({ produto, onFechar }: { produto: ProdutoDto; onFechar: () => void }) {
  const app = useApp();
  const invalidar = useInvalidarProdutos();
  const chave = useChavePorConteudo();
  const [caixas, setCaixas] = useState("0");
  const [unidades, setUnidades] = useState("0");
  const [motivo, setMotivo] = useState("");
  const total = Number(caixas || 0) * (produto.unidadesPorCaixa ?? 0) + Number(unidades || 0);

  const m = useMutation({
    mutationFn: () => {
      const dados = {
        produto: produto.id,
        caixas: Number(caixas || 0),
        unidades: Number(unidades || 0),
        motivo: motivo.trim(),
      };
      return registrarEntrada(app.id, dados, chave(dados));
    },
    onSuccess: (mov) => {
      invalidar();
      toast.success(`Entrada de ${mov.delta} unidades registrada. Saldo: ${mov.saldoDepois}.`);
      onFechar();
    },
  });

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Entrada de {produto.nome}</DialogTitle>
            <DialogDescription>Saldo físico atual: {produto.fisico} unidades.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {produto.unidadesPorCaixa !== null && (
              <div className="space-y-1.5">
                <Label htmlFor="entrada-caixas">Caixas de {produto.unidadesPorCaixa}</Label>
                <Input
                  id="entrada-caixas"
                  type="number"
                  min={0}
                  value={caixas}
                  onChange={(e) => setCaixas(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="entrada-unidades">Unidades</Label>
              <Input
                id="entrada-unidades"
                type="number"
                min={0}
                value={unidades}
                onChange={(e) => setUnidades(e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Total da entrada:{" "}
            <span className="font-medium tabular-nums text-foreground">{total}</span> unidades
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="entrada-motivo">Motivo</Label>
            <Input
              id="entrada-motivo"
              value={motivo}
              minLength={3}
              maxLength={300}
              required
              placeholder="Ex.: compra do fornecedor"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending || total <= 0 || motivo.trim().length < 3}>
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Registrar entrada
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** EST-03/EST-04: o administrador informa o físico contado; nunca abaixo do reservado. */
function CorrecaoDialog({ produto, onFechar }: { produto: ProdutoDto; onFechar: () => void }) {
  const app = useApp();
  const invalidar = useInvalidarProdutos();
  const chave = useChavePorConteudo();
  const [novo, setNovo] = useState(String(produto.fisico));
  const [motivo, setMotivo] = useState("");

  const m = useMutation({
    mutationFn: () => {
      const dados = {
        produto: produto.id,
        fisicoEsperado: produto.fisico,
        novoFisico: Number(novo),
        motivo: motivo.trim(),
      };
      return corrigirSaldo(app.id, dados, chave(dados));
    },
    onSuccess: (mov) => {
      invalidar();
      toast.success(
        `Saldo corrigido (${mov.delta > 0 ? "+" : ""}${mov.delta}). Novo físico: ${mov.saldoDepois}.`,
      );
      onFechar();
    },
  });

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Corrigir saldo de {produto.nome}</DialogTitle>
            <DialogDescription>
              Físico atual {produto.fisico}, reservado {produto.reservado}. O novo físico não pode
              ficar abaixo do reservado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="correcao-novo">Físico contado (unidades)</Label>
            <Input
              id="correcao-novo"
              type="number"
              min={0}
              value={novo}
              required
              onChange={(e) => setNovo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="correcao-motivo">Motivo</Label>
            <Input
              id="correcao-motivo"
              value={motivo}
              minLength={3}
              maxLength={300}
              required
              placeholder="Ex.: contagem física"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                m.isPending ||
                novo === "" ||
                Number(novo) === produto.fisico ||
                motivo.trim().length < 3
              }
            >
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Corrigir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
