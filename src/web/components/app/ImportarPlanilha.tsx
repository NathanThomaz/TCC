import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatarCentavos } from "../../../shared/dominio/precos";
import { importarPlanilha } from "@/api/operacao";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lerClientes, lerProdutos, type LinhaProduto } from "@/lib/planilha";
import { useApp } from "@/pages/app/Aplicacao";

// Importar de planilha (pedido do dono, 2026-11-14): colar do Excel ou enviar CSV, conferir a
// prévia e criar tudo de uma vez. Nomes que já existem ficam como estão.

/** Linhas por envio (o servidor grava cada envio de uma vez). */
const POR_ENVIO = 200;

export function ImportarPlanilha({ tipo }: { tipo: "produtos" | "clientes" }) {
  const app = useApp();
  const [aberto, setAberto] = useState(false);
  if (app.papel !== "admin") return null;
  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <FileSpreadsheet aria-hidden /> Importar planilha
      </Button>
      {aberto && <ImportarDialog tipo={tipo} onFechar={() => setAberto(false)} />}
    </>
  );
}

function ImportarDialog({
  tipo,
  onFechar,
}: {
  tipo: "produtos" | "clientes";
  onFechar: () => void;
}) {
  const app = useApp();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const regras = {
    atacado: app.config.regras.some((r) => r.tipo === "limite_atacado"),
    caixa: app.config.regras.some((r) => r.tipo === "unidades_por_caixa"),
    estoque: app.config.modulos.includes("estoque"),
  };
  const leitura =
    tipo === "produtos"
      ? lerProdutos(texto, regras)
      : { ...lerClientes(texto), erros: [] as string[], comCabecalho: false };
  const colunas =
    tipo === "produtos"
      ? [
          "Nome",
          regras.atacado ? "Preço de varejo, Atacado" : "Preço",
          ...(regras.caixa ? ["Caixa"] : []),
          ...(regras.estoque ? ["Estoque", "Mínimo"] : []),
          "Código de barras (opcional)",
        ]
      : ["Nome"];

  const m = useMutation({
    mutationFn: async () => {
      let criados = 0;
      let ignorados = 0;
      for (let i = 0; i < leitura.linhas.length; i += POR_ENVIO) {
        const r = await importarPlanilha(app.id, tipo, leitura.linhas.slice(i, i + POR_ENVIO));
        criados += r.criados;
        ignorados += r.ignorados.length;
      }
      return { criados, ignorados };
    },
    onSuccess: ({ criados, ignorados }) => {
      void qc.invalidateQueries({ queryKey: ["app", app.id, tipo] });
      void qc.invalidateQueries({ queryKey: ["app", app.id, "movimentos"] });
      toast.success(
        `${criados} ${criados === 1 ? "cadastro criado" : "cadastros criados"}` +
          (ignorados ? `; ${ignorados} já existiam e ficaram como estavam.` : "."),
      );
      onFechar();
    },
  });

  async function lerArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setTexto(await arquivo.text());
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar {tipo === "produtos" ? "produtos" : "clientes"}</DialogTitle>
          <DialogDescription>
            Copie as linhas no Excel e cole aqui, ou envie um arquivo CSV. Colunas:{" "}
            {colunas.join(", ")}. A primeira linha pode ter os títulos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="planilha-texto">Linhas da planilha</Label>
          <Textarea
            id="planilha-texto"
            rows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              tipo === "produtos"
                ? "Nome\tPreço\tEstoque\nArroz 5 kg\t28,90\t20"
                : "Nome\nBar do Zé\nMercado Bom"
            }
            className="font-mono text-xs"
          />
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-primary">
            <Upload className="size-4" aria-hidden /> Enviar arquivo CSV
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => void lerArquivo(e.target.files?.[0])}
            />
          </label>
        </div>

        {leitura.erros.length > 0 && (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
            {leitura.erros.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {leitura.erros.length > 8 && <li>e mais {leitura.erros.length - 8}.</li>}
          </ul>
        )}

        {leitura.linhas.length > 0 && (
          <div className="max-h-56 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">Prévia da importação</caption>
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Nome</th>
                  {tipo === "produtos" && <th className="px-3 py-2 font-medium">Preço</th>}
                  {tipo === "produtos" && regras.estoque && (
                    <th className="px-3 py-2 font-medium">Estoque</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {leitura.linhas.slice(0, 50).map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">{l.nome}</td>
                    {tipo === "produtos" && (
                      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                        {formatarCentavos((l as LinhaProduto).varejoCentavos)}
                      </td>
                    )}
                    {tipo === "produtos" && regras.estoque && (
                      <td className="px-3 py-1.5 tabular-nums">
                        {(l as LinhaProduto).estoque ?? "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ErroApi erro={m.error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={leitura.linhas.length === 0 || leitura.erros.length > 0 || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Importar {leitura.linhas.length || ""}{" "}
            {leitura.linhas.length === 1 ? "linha" : "linhas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
