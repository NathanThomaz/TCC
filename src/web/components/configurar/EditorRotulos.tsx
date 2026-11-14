import type { PassoProps } from "@/components/configurar/Passos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROTULO_MODULO } from "@/lib/nexus";
import type { Modulo } from "@/types/nexus";

// Nomes do menu no vocabulário do negócio (pedido do dono, 2026-11-14): só o visual muda. As
// colunas das tabelas se renomeiam direto na tabela, depois de criado o sistema. Campo vazio volta
// ao nome padrão.

export function EditorRotulos({ draft, set }: PassoProps) {
  const menu = draft.aparencia.rotulos_menu ?? {};
  const mudarMenu = (m: Modulo, valor: string) =>
    set((d) => {
      const proximo = { ...(d.aparencia.rotulos_menu ?? {}) };
      if (valor.trim()) proximo[m] = valor;
      else delete proximo[m];
      return { ...d, aparencia: { ...d.aparencia, rotulos_menu: proximo } };
    });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Use as palavras do seu negócio. Só muda o que aparece no menu; vazio volta ao nome padrão.
        As colunas das tabelas você renomeia direto na tabela, depois de criar o sistema.
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
    </div>
  );
}
