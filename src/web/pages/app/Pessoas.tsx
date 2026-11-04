import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import type { CamposInformativos, ClienteDto } from "../../../shared/api";
import {
  criarPessoa,
  editarPessoa,
  listarPessoas,
  mudarStatus,
  type TipoPessoa,
} from "@/api/operacao";
import {
  CamposForm,
  ErroApi,
  resumoCampos,
  Tabela,
  useChavePorConteudo,
} from "@/components/app/Comum";
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
import { Skeleton } from "@/components/ui/skeleton";
import { rotuloModulo, useApp } from "./Aplicacao";

// Clientes e profissionais (seção 14): cadastrar, editar, inativar e reativar; sem exclusão.
// Cadastro de técnico não cria login (seção 7).

const ENTIDADE = { clientes: "clientes", profissionais: "profissionais" } as const;

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
        <Tabela
          cabecalho={["Nome", "Informações", "Situação", <span className="sr-only">Ações</span>]}
        >
          {q.data.map((p) => (
            <tr
              key={p.id}
              className={p.status === "inactive" ? "text-muted-foreground" : undefined}
            >
              <td className="px-4 py-2 font-medium">{p.nome}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {resumoCampos(app.config, ENTIDADE[tipo], p.campos) || "—"}
              </td>
              <td className="px-4 py-2">{p.status === "active" ? "Ativo" : "Inativo"}</td>
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
