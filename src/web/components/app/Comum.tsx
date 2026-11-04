import { useRef, type ReactNode } from "react";
import type { CamposInformativos } from "../../../shared/api";
import type { FieldEntity } from "../../../shared/contract/catalog";
import type { ConfigDraft } from "../../../shared/contract/schema";
import { ApiError, novaChave } from "@/api/cliente";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Peças comuns das telas da aplicação: campos informativos da configuração, tabela e erro.

/**
 * Idempotency-Key estável por intenção (seção 19): a mesma chave enquanto o conteúdo enviado não
 * mudar, então retry ou clique repetido não duplica efeitos; conteúdo novo, chave nova.
 */
export function useChavePorConteudo() {
  const ref = useRef<{ conteudo: string; chave: string } | null>(null);
  return (dados: unknown) => {
    const conteudo = JSON.stringify(dados);
    if (ref.current?.conteudo !== conteudo) ref.current = { conteudo, chave: novaChave() };
    return ref.current.chave;
  };
}

/** Campos informativos da entidade (seção 5), como a configuração ativa define. */
export function CamposForm({
  config,
  entidade,
  valores,
  onChange,
  prefixo,
}: {
  config: ConfigDraft;
  entidade: FieldEntity;
  valores: CamposInformativos;
  onChange: (v: CamposInformativos) => void;
  prefixo: string;
}) {
  const campos = config.campos.filter((c) => c.entidade === entidade);
  if (campos.length === 0) return null;
  const definir = (id: string, valor: string | number | undefined) => {
    const novo = { ...valores };
    if (valor === undefined || valor === "") delete novo[id];
    else novo[id] = valor;
    onChange(novo);
  };
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium">Informações adicionais</legend>
      {campos.map((c) => {
        const id = `${prefixo}-${c.id}`;
        const atual = valores[c.id];
        return (
          <div key={c.id} className="space-y-1.5">
            <Label htmlFor={id}>
              {c.rotulo}
              {c.obrigatorio ? " *" : <span className="text-muted-foreground"> (opcional)</span>}
            </Label>
            {c.tipo === "lista" ? (
              <Select
                value={typeof atual === "string" ? atual : ""}
                onValueChange={(v) => definir(c.id, v)}
              >
                <SelectTrigger id={id}>
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {(c.opcoes ?? []).map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                type={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : "text"}
                {...(c.tipo === "numero" ? { step: "any" } : {})}
                value={atual ?? ""}
                required={c.obrigatorio}
                maxLength={200}
                onChange={(e) =>
                  definir(
                    c.id,
                    c.tipo === "numero" && e.target.value !== ""
                      ? Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

/** Valores dos campos informativos para exibição ("Telefone: 5199 · ..."). */
export function resumoCampos(
  config: ConfigDraft,
  entidade: FieldEntity,
  valores: CamposInformativos,
) {
  return config.campos
    .filter((c) => c.entidade === entidade && valores[c.id] !== undefined)
    .map((c) => `${c.rotulo}: ${String(valores[c.id])}`)
    .join(" · ");
}

export function Tabela({ cabecalho, children }: { cabecalho: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/60 text-left text-muted-foreground">
          <tr>
            {cabecalho.map((c, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function ErroApi({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const mensagem = erro instanceof Error ? erro.message : "Não foi possível concluir a operação.";
  return (
    <p role="alert" className="text-sm text-destructive">
      {mensagem}
    </p>
  );
}

/** Dados extras de um 409 (ex.: faltas de estoque, serviços vinculados). */
export function dadosDoErro<T>(erro: unknown, campo: string): T | undefined {
  if (!(erro instanceof ApiError) || typeof erro.dados !== "object" || erro.dados === null)
    return undefined;
  return (erro.dados as Record<string, unknown>)[campo] as T | undefined;
}

export function codigoDoErro(erro: unknown): string | undefined {
  return erro instanceof ApiError ? erro.code : undefined;
}
