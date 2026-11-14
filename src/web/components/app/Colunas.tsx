import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Columns3, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { LIMITS, type FieldEntity } from "../../../shared/contract/catalog";
import { ajustarColuna, type AjusteColuna } from "@/api/operacao";
import { ErroApi } from "@/components/app/Comum";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/pages/app/Aplicacao";

// Colunas das tabelas de um sistema ativo (pedido do dono, 2026-11-14): o administrador renomeia
// uma coluna direto no cabeçalho (só o visual muda) e inclui colunas novas depois de criado.

function useAjustarColuna(onFeito?: () => void, onErro?: (e: Error) => void) {
  const app = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ajuste: AjusteColuna) => ajustarColuna(app.id, ajuste),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["app", app.id], exact: true });
      onFeito?.();
    },
    ...(onErro ? { onError: onErro } : {}),
  });
}

/**
 * Cabeçalho de coluna que o administrador renomeia ali mesmo. `chave` é a coluna padrão
 * ("produtos.nome") ou o campo incluído ("campo:clientes:telefone").
 */
export function ColunaEditavel({ chave, rotulo }: { chave: string; rotulo: string }) {
  const app = useApp();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(rotulo);
  const m = useAjustarColuna(
    () => {
      setEditando(false);
      toast.success("Coluna renomeada.");
    },
    (e) => toast.error(e.message),
  );
  if (app.papel !== "admin") return <>{rotulo}</>;
  if (!editando) {
    return (
      <span className="group inline-flex items-center gap-1 whitespace-nowrap">
        {rotulo}
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={`Renomear a coluna ${rotulo}`}
          title="Renomear coluna (só muda o nome na tela)"
          onClick={() => {
            setTexto(rotulo);
            setEditando(true);
          }}
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      </span>
    );
  }
  const salvar = () => {
    const novo = texto.trim();
    if (!novo || novo === rotulo) return setEditando(false);
    m.mutate({ acao: "renomear", chave, rotulo: novo });
  };
  return (
    <form
      className="inline-flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <Input
        autoFocus
        aria-label={`Novo nome da coluna ${rotulo}`}
        className="h-7 w-36 px-2 text-xs"
        value={texto}
        maxLength={40}
        disabled={m.isPending}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditando(false);
        }}
      />
      <Button type="submit" size="icon" variant="ghost" className="size-7" aria-label="Salvar nome">
        {m.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Cancelar"
        onClick={() => setEditando(false)}
      >
        <X aria-hidden />
      </Button>
    </form>
  );
}

const TIPOS = [
  { valor: "texto", rotulo: "Texto" },
  { valor: "numero", rotulo: "Número" },
  { valor: "data", rotulo: "Data" },
  { valor: "lista", rotulo: "Lista de opções" },
] as const;

/** Botão "Nova coluna" (só administrador): o campo entra no cadastro e na tabela. */
export function NovaColuna({ entidade }: { entidade: FieldEntity }) {
  const app = useApp();
  const [aberto, setAberto] = useState(false);
  if (app.papel !== "admin") return null;
  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <Columns3 aria-hidden /> Nova coluna
      </Button>
      {aberto && <NovaColunaDialog entidade={entidade} onFechar={() => setAberto(false)} />}
    </>
  );
}

function NovaColunaDialog({ entidade, onFechar }: { entidade: FieldEntity; onFechar: () => void }) {
  const [rotulo, setRotulo] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["valor"]>("texto");
  const [opcoes, setOpcoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const m = useAjustarColuna(() => {
    toast.success("Coluna incluída. Preencha nos cadastros quando quiser.");
    onFechar();
  });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const lista = opcoes
      .split(/[,;\n]/)
      .map((o) => o.trim())
      .filter(Boolean);
    if (!rotulo.trim()) return setErro("Informe o nome da coluna.");
    if (tipo === "lista" && lista.length < LIMITS.listOptions.min) {
      return setErro(`Informe pelo menos ${LIMITS.listOptions.min} opções, separadas por vírgula.`);
    }
    setErro(null);
    m.mutate({
      acao: "incluir",
      entidade,
      rotulo: rotulo.trim(),
      tipo,
      ...(tipo === "lista" ? { opcoes: [...new Set(lista)] } : {}),
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Nova coluna</DialogTitle>
            <DialogDescription>
              A coluna aparece na tabela e no cadastro. Os registros que já existem ficam com ela
              vazia até você preencher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="coluna-nome">Nome da coluna</Label>
            <Input
              id="coluna-nome"
              autoFocus
              maxLength={60}
              placeholder="Ex.: Cor, Validade, Fornecedor preferido"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coluna-tipo">Tipo de informação</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger id="coluna-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tipo === "lista" && (
            <div className="space-y-1.5">
              <Label htmlFor="coluna-opcoes">Opções (separadas por vírgula)</Label>
              <Input
                id="coluna-opcoes"
                placeholder="Ex.: Pequeno, Médio, Grande"
                value={opcoes}
                onChange={(e) => setOpcoes(e.target.value)}
              />
            </div>
          )}
          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
          <ErroApi erro={m.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending && <Loader2 className="animate-spin" aria-hidden />}Incluir coluna
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
