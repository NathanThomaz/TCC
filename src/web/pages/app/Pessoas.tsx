import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import type { CamposInformativos, ClienteDto } from "../../../shared/api";
import type { Campo } from "@/types/nexus";
import { formatarDataHora } from "../../../shared/dominio/agenda";
import { formatarCentavos } from "../../../shared/dominio/precos";
import {
  criarPessoa,
  editarPessoa,
  listarPessoas,
  mudarStatus,
  type TipoPessoa,
} from "@/api/operacao";
import { CamposForm, ErroApi, Tabela, useChavePorConteudo } from "@/components/app/Comum";
import { EmptyState, ErrorState, PageHeader } from "@/components/nexus/Estados";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { rotuloModulo, useApp } from "./Aplicacao";

// Clientes e profissionais (seção 14): cadastrar, editar, inativar e reativar; sem exclusão.
// Cadastro de técnico não cria login (seção 7).

const ENTIDADE = { clientes: "clientes", profissionais: "profissionais" } as const;

export type Filtro = "todos" | "active" | "inactive";
export type Ordem = "nome" | "total" | "ultima" | "proximo";

/** Valor de um campo informativo como texto da célula (data em dd/mm/aaaa). */
export function textoDoCampo(campo: Campo, valor: CamposInformativos[string] | undefined): string {
  if (valor === undefined || valor === null || valor === "") return "—";
  if (campo.tipo === "data" && typeof valor === "string") {
    const [a, m, d] = valor.split("-");
    return d && m && a ? `${d}/${m}/${a}` : valor;
  }
  if (campo.tipo === "numero" && typeof valor === "number") return valor.toLocaleString("pt-BR");
  return String(valor);
}

const data = (instante: number | null | undefined) =>
  instante ? formatarDataHora(instante).slice(0, 10) : "—";

/** Busca sem acento nem caixa, no nome e nos campos informativos. */
const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Busca (nome e campos, no valor guardado e no mostrado), situação e ordem da tabela. */
export function filtrarPessoas(
  pessoas: ClienteDto[],
  campos: Campo[],
  busca: string,
  filtro: Filtro,
  ordem: Ordem,
): ClienteDto[] {
  const termo = normalizar(busca.trim());
  const lista = pessoas.filter(
    (p) =>
      (filtro === "todos" || p.status === filtro) &&
      (!termo ||
        normalizar(
          [
            p.nome,
            ...Object.values(p.campos).map(String),
            ...campos.map((c) => textoDoCampo(c, p.campos[c.id])),
          ].join(" "),
        ).includes(termo)),
  );
  const r = (p: ClienteDto) => p.resumo;
  const porOrdem: Record<Ordem, (a: ClienteDto, b: ClienteDto) => number> = {
    nome: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
    total: (a, b) => (r(b)?.totalCentavos ?? 0) - (r(a)?.totalCentavos ?? 0),
    ultima: (a, b) => (r(b)?.ultimaCompra ?? 0) - (r(a)?.ultimaCompra ?? 0),
    // Sem próximo atendimento vai para o fim.
    proximo: (a, b) =>
      (r(a)?.proximoAtendimento ?? Infinity) - (r(b)?.proximoAtendimento ?? Infinity),
  };
  return [...lista].sort(porOrdem[ordem]);
}

export function Pessoas({ tipo }: { tipo: TipoPessoa }) {
  const app = useApp();
  const qc = useQueryClient();
  const chave = ["app", app.id, tipo];
  const q = useQuery({ queryKey: chave, queryFn: () => listarPessoas(app.id, tipo) });
  const [editando, setEditando] = useState<ClienteDto | "novo" | null>(null);
  const titulo = rotuloModulo(app, tipo);

  const status = useMutation({
    mutationFn: (p: ClienteDto) =>
      mudarStatus(app.id, tipo, p.id, p.status === "active" ? "inactive" : "active"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
    onError: (e) => toast.error(e.message),
  });

  const campos = useMemo(
    () => app.config.campos.filter((c) => c.entidade === ENTIDADE[tipo]),
    [app.config.campos, tipo],
  );
  const temVendas = tipo === "clientes" && app.config.modulos.includes("vendas");
  const temAgenda = app.config.modulos.includes("agenda");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ordem, setOrdem] = useState<Ordem>("nome");

  const linhas = useMemo(
    () => filtrarPessoas(q.data ?? [], campos, busca, filtro, ordem),
    [q.data, campos, busca, filtro, ordem],
  );

  const ativos = (q.data ?? []).filter((p) => p.status === "active").length;
  const cabecalho = [
    "Nome",
    ...campos.map((c) => c.rotulo),
    ...(temVendas ? ["Compras", "Total comprado", "Última compra"] : []),
    ...(temAgenda ? ["Atendimentos", "Próximo atendimento"] : []),
    "Cadastrado em",
    "Situação",
    <span className="sr-only">Ações</span>,
  ];

  return (
    <>
      <PageHeader
        titulo={titulo}
        descricao="Inativos continuam no histórico, mas não entram em novas operações."
        acoes={
          <Button onClick={() => setEditando("novo")}>
            <Plus aria-hidden /> Novo
          </Button>
        }
      />
      {q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : q.isError ? (
        <ErrorState mensagem={q.error.message} onTentar={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icone={Users}
          titulo="Nenhum cadastro ainda"
          descricao="Comece pelo botão Novo."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor={`busca-${tipo}`}>Buscar</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id={`busca-${tipo}`}
                  className="pl-9"
                  placeholder="Nome ou qualquer informação"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
            <div className="w-40 space-y-1.5">
              <Label htmlFor={`situacao-${tipo}`}>Situação</Label>
              <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                <SelectTrigger id={`situacao-${tipo}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(temVendas || temAgenda) && (
              <div className="w-52 space-y-1.5">
                <Label htmlFor={`ordem-${tipo}`}>Ordenar por</Label>
                <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
                  <SelectTrigger id={`ordem-${tipo}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nome">Nome</SelectItem>
                    {temVendas && <SelectItem value="total">Quem mais comprou</SelectItem>}
                    {temVendas && <SelectItem value="ultima">Compra mais recente</SelectItem>}
                    {temAgenda && <SelectItem value="proximo">Próximo atendimento</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {linhas.length} de {q.data.length} · {ativos} {ativos === 1 ? "ativo" : "ativos"}
          </p>
          {linhas.length === 0 ? (
            <EmptyState
              icone={Search}
              titulo="Nada encontrado"
              descricao="Mude a busca ou o filtro de situação."
            />
          ) : (
            <Tabela cabecalho={cabecalho}>
              {linhas.map((p) => (
                <tr
                  key={p.id}
                  className={p.status === "inactive" ? "text-muted-foreground" : undefined}
                >
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{p.nome}</td>
                  {campos.map((c) => (
                    <td key={c.id} className="px-4 py-2 text-muted-foreground">
                      {textoDoCampo(c, p.campos[c.id])}
                    </td>
                  ))}
                  {temVendas && (
                    <>
                      <td className="px-4 py-2 tabular-nums">{p.resumo?.compras ?? 0}</td>
                      <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                        {formatarCentavos(p.resumo?.totalCentavos ?? 0)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">
                        {data(p.resumo?.ultimaCompra)}
                      </td>
                    </>
                  )}
                  {temAgenda && (
                    <>
                      <td className="px-4 py-2 tabular-nums">{p.resumo?.atendimentos ?? 0}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                        {p.resumo?.proximoAtendimento
                          ? formatarDataHora(p.resumo.proximoAtendimento)
                          : "—"}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">
                    {data(p.resumo?.desde)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === "active"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditando(p)}
                        aria-label={`Editar ${p.nome}`}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
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
        </>
      )}
      {editando && (
        <PessoaDialog
          tipo={tipo}
          atual={editando === "novo" ? null : editando}
          onFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}

function PessoaDialog({
  tipo,
  atual,
  onFechar,
}: {
  tipo: TipoPessoa;
  atual: ClienteDto | null;
  onFechar: () => void;
}) {
  const app = useApp();
  const qc = useQueryClient();
  const [nome, setNome] = useState(atual?.nome ?? "");
  const [campos, setCampos] = useState<CamposInformativos>(atual?.campos ?? {});
  const chave = useChavePorConteudo();

  const m = useMutation({
    mutationFn: () => {
      const dados = { nome: nome.trim(), campos };
      if (atual) return editarPessoa(app.id, tipo, atual.id, dados);
      return criarPessoa(app.id, tipo, dados, chave(dados));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["app", app.id, tipo] });
      toast.success(atual ? "Cadastro atualizado." : "Cadastro criado.");
      onFechar();
    },
  });

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>
              {atual ? `Editar ${atual.nome}` : `Novo cadastro em ${rotuloModulo(app, tipo)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pessoa-nome">Nome</Label>
            <Input
              id="pessoa-nome"
              value={nome}
              maxLength={120}
              required
              autoFocus
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <CamposForm
            config={app.config}
            entidade={ENTIDADE[tipo]}
            valores={campos}
            onChange={setCampos}
            prefixo="pessoa"
          />
          <ErroApi erro={m.error} />
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
