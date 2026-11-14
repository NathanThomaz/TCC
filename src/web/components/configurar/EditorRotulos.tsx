import { ROTULOS_CAMPOS, type RotuloCampo } from "../../../shared/contract/catalog";
import type { PassoProps } from "@/components/configurar/Passos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROTULO_MODULO } from "@/lib/nexus";
import type { Modulo } from "@/types/nexus";

// Nomes das telas e colunas no vocabulário do negócio (pedido do dono, 2026-11-14): só o visual
// muda; o banco continua com os nomes padrão. A IA sugere ao gerar a configuração; aqui o dono
// confere e muda. Campo vazio volta ao nome padrão.

const DESCRICAO: Partial<Record<RotuloCampo, string>> = {
  "produtos.item": "Como chamar um item (ex.: Veículo, Peça, Bebida)",
  "produtos.nome": "Coluna do nome do item (ex.: Modelo)",
  "produtos.varejo": "Coluna do preço (ex.: Preço de venda)",
};

export function EditorRotulos({ draft, set }: PassoProps) {
  const menu = draft.aparencia.rotulos_menu ?? {};
  const campos = draft.aparencia.rotulos_campos ?? {};
  const chaves = (Object.keys(ROTULOS_CAMPOS) as RotuloCampo[]).filter((k) =>
    draft.modulos.includes(ROTULOS_CAMPOS[k].modulo as Modulo),
  );
  const mudarMenu = (m: Modulo, valor: string) =>
    set((d) => {
      const proximo = { ...(d.aparencia.rotulos_menu ?? {}) };
      if (valor.trim()) proximo[m] = valor;
      else delete proximo[m];
      return { ...d, aparencia: { ...d.aparencia, rotulos_menu: proximo } };
    });
  const mudarCampo = (k: RotuloCampo, valor: string) =>
    set((d) => {
      const proximo = { ...(d.aparencia.rotulos_campos ?? {}) };
      if (valor.trim()) proximo[k] = valor;
      else delete proximo[k];
      return { ...d, aparencia: { ...d.aparencia, rotulos_campos: proximo } };
    });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Use as palavras do seu negócio. Só muda o que aparece na tela; vazio volta ao nome padrão.
      </p>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Nomes do menu</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Formas de pagamento não têm tela própria no menu (ficam dentro de Vendas). */}
          {draft.modulos
            .filter((m) => m !== "pagamentos")
            .map((m) => (
              <div key={m} className="space-y-1">
                <Label htmlFor={`menu-${m}`} className="text-xs text-muted-foreground">
                  {ROTULO_MODULO[m]}
                </Label>
                <Input
                  id={`menu-${m}`}
                  value={menu[m] ?? ""}
                  placeholder={ROTULO_MODULO[m]}
                  maxLength={40}
                  onChange={(e) => mudarMenu(m, e.target.value)}
                />
              </div>
            ))}
        </div>
      </fieldset>
      {chaves.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Nomes de telas e colunas</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {chaves.map((k) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={`rotulo-${k}`} className="text-xs text-muted-foreground">
                  {DESCRICAO[k] ?? ROTULOS_CAMPOS[k].padrao}
                </Label>
                <Input
                  id={`rotulo-${k}`}
                  value={campos[k] ?? ""}
                  placeholder={ROTULOS_CAMPOS[k].padrao}
                  maxLength={40}
                  onChange={(e) => mudarCampo(k, e.target.value)}
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
