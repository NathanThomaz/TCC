import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { excluirSistema, inativarSistema, reativarSistema } from "@/api/sistemas";
import { ApiError } from "@/api/cliente";
import { ErroApi } from "@/components/app/Comum";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link, useNavigate } from "@/lib/rotas";
import type { Sistema } from "@/types/nexus";

// Situação do sistema (pedido do dono, 2026-11-16): inativar e reativar qualquer sistema; excluir
// só o que nunca foi ativado (os outros têm histórico e ficam guardados ao inativar).

export function SituacaoSistema({ sistema }: { sistema: Sistema }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ["sistema", sistema.id] });
    void qc.invalidateQueries({ queryKey: ["sistemas"] });
    void qc.invalidateQueries({ queryKey: ["inicio"] });
  };
  const inativar = useMutation({
    mutationFn: () => inativarSistema(sistema.id),
    onSuccess: () => {
      atualizar();
      toast.success("Sistema inativado. Os dados ficam guardados; reative quando quiser.");
    },
  });
  const reativar = useMutation({
    mutationFn: () => reativarSistema(sistema.id),
    onSuccess: () => {
      atualizar();
      toast.success("Sistema reativado.");
    },
  });
  const excluir = useMutation({
    mutationFn: () => excluirSistema(sistema.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sistemas"] });
      void qc.invalidateQueries({ queryKey: ["inicio"] });
      toast.success(`“${sistema.nome}” foi excluído.`);
      navigate({ to: "/sistemas", replace: true });
    },
  });
  const inativo = sistema.status === "archived";
  const nuncaAtivado = sistema.versaoAtiva === null;
  const comPendencias =
    inativar.error instanceof ApiError && inativar.error.code === "sistema_com_pendencias";

  return (
    <section
      aria-labelledby="titulo-situacao"
      className="mt-8 rounded-xl border bg-card p-5 shadow-card"
    >
      <h2 id="titulo-situacao" className="text-lg font-semibold">
        Situação do sistema
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {inativo
          ? "Inativo: não aparece para quem opera e não recebe vendas nem cadastros. Os dados continuam guardados."
          : "Inativar tira o sistema de uso sem apagar nada: some para quem opera e você pode reativar quando quiser."}
        {nuncaAtivado
          ? " Como ele nunca foi ativado, também pode ser excluído de vez."
          : " Sistemas que já foram ativados têm histórico e não podem ser excluídos."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {inativo ? (
          <Button variant="outline" disabled={reativar.isPending} onClick={() => reativar.mutate()}>
            {reativar.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <ArchiveRestore aria-hidden />
            )}
            Reativar sistema
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={inativar.isPending}>
                {inativar.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Archive aria-hidden />
                )}
                Inativar sistema
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Inativar “{sistema.nome}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  O sistema sai das telas de quem opera e para de receber vendas, cadastros e
                  agendamentos. Nada é apagado e você pode reativar a qualquer momento.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={() => inativar.mutate()}>Inativar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {nuncaAtivado && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={excluir.isPending}
              >
                {excluir.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Trash2 aria-hidden />
                )}
                Excluir sistema
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir “{sistema.nome}” de vez?</AlertDialogTitle>
                <AlertDialogDescription>
                  O sistema, a conversa de criação e as versões somem da sua conta e não há como
                  desfazer. O nome fica livre para um sistema novo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={() => excluir.mutate()}
                >
                  Excluir de vez
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <div className="mt-3 space-y-2">
        <ErroApi erro={inativar.error ?? reativar.error ?? excluir.error} />
        {comPendencias && (
          <p className="flex flex-wrap gap-3 text-sm">
            <Link
              to="/sistemas/$id/app/vendas"
              params={{ id: sistema.id }}
              className="font-medium text-primary underline"
            >
              Ver vendas
            </Link>
            <Link
              to="/sistemas/$id/app/agenda"
              params={{ id: sistema.id }}
              className="font-medium text-primary underline"
            >
              Ver agenda
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
