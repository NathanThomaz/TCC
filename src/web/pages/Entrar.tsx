import { useNavigate, useBusca } from "@/lib/rotas";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Clock, Loader2, Lock, MailCheck } from "lucide-react";
import {
  cadastroAberto,
  criarConta,
  entrar,
  enviarRecuperacao,
  reenviarConfirmacao,
} from "@/api/auth";
import { ApiError } from "@/api/cliente";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MENSAGENS: Record<string, { titulo: string; texto: string }> = {
  credenciais_invalidas: {
    titulo: "E-mail ou senha incorretos",
    texto: "Confira os dados e tente novamente.",
  },
  email_nao_confirmado: {
    titulo: "E-mail ainda não confirmado",
    texto: "Abra o link que enviamos para o seu e-mail antes de entrar.",
  },
  conta_desativada: {
    titulo: "Conta desativada",
    texto: "Fale com o administrador para reativar o acesso.",
  },
  servico_indisponivel: {
    titulo: "Serviço indisponível",
    texto: "Não conseguimos falar com o servidor. Tente de novo em instantes.",
  },
  email_em_uso: {
    titulo: "Este e-mail já tem conta",
    texto: 'Entre com ele ou use "Esqueci minha senha".',
  },
  senha_fraca: {
    titulo: "Senha fraca",
    texto: "Use pelo menos 8 caracteres, misturando letras e números.",
  },
};

const TITULOS = {
  entrar: ["Entrar", "Use o e-mail e a senha da sua conta."],
  recuperar: ["Recuperar senha", "Enviaremos um link para redefinir a senha."],
  criar: ["Criar conta", "Monte os sistemas do seu negócio com a ajuda da IA."],
} as const;

export function Entrar() {
  const motivo = useBusca().motivo === "sessao_expirada" ? "sessao_expirada" : undefined;
  const { pronto, usuario, iniciar } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "recuperar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const aberto = useQuery({ queryKey: ["cadastro-aberto"], queryFn: cadastroAberto }).data;
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    if (pronto && usuario) navigate({ to: "/" });
  }, [pronto, usuario, navigate]);

  const login = useMutation({
    mutationFn: () => entrar(email, senha),
    onSuccess: (u) => {
      iniciar(u);
      navigate({ to: "/" });
    },
  });
  const reenviar = useMutation({ mutationFn: () => reenviarConfirmacao(email, senha) });
  const recuperar = useMutation({ mutationFn: () => enviarRecuperacao(email) });
  const criar = useMutation({ mutationFn: () => criarConta(nome, email, senha) });

  const erro = modo === "entrar" ? login.error : modo === "criar" ? criar.error : null;
  const codigo = erro instanceof ApiError ? erro.code : erro ? "servico_indisponivel" : null;
  const msg = codigo ? (MENSAGENS[codigo] ?? MENSAGENS.servico_indisponivel) : null;
  const ocupado = login.isPending || recuperar.isPending || criar.isPending;

  function trocar(novo: typeof modo) {
    setModo(novo);
    setErroLocal(null);
    login.reset();
    recuperar.reset();
    criar.reset();
    reenviar.reset();
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErroLocal("Informe um e-mail válido.");
    if (modo === "entrar" && senha.length < 6)
      return setErroLocal("A senha tem pelo menos 6 caracteres.");
    if (modo === "criar") {
      if (nome.trim().length < 2) return setErroLocal("Informe o seu nome.");
      if (senha.length < 8) return setErroLocal("A senha precisa ter pelo menos 8 caracteres.");
      if (senha !== confirmacao) return setErroLocal("As senhas não conferem.");
    }
    setErroLocal(null);
    if (modo === "entrar") login.mutate();
    else if (modo === "criar") criar.mutate();
    else recuperar.mutate();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Boxes aria-hidden /> Nexus
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Seu sistema de gestão, montado com módulos prontos.
          </h2>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Escolha um modelo, descreva as regras do seu negócio e revise o diagnóstico antes de
            ativar. Sem surpresas.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">Protótipo acadêmico · dados fictícios</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 font-semibold lg:hidden">
            <Boxes className="text-primary" aria-hidden /> Nexus
          </div>

          {motivo === "sessao_expirada" && modo === "entrar" && !login.isPending && (
            <div
              role="status"
              className="mb-6 flex gap-3 rounded-lg border border-info/30 bg-info-soft p-3 text-sm"
            >
              <Clock className="size-5 shrink-0 text-info" aria-hidden />
              <p>Sua sessão expirou. Entre novamente para continuar.</p>
            </div>
          )}

          <h1 className="text-2xl font-semibold tracking-tight">{TITULOS[modo][0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{TITULOS[modo][1]}</p>

          {modo === "recuperar" && recuperar.isSuccess ? (
            <div
              role="status"
              className="mt-6 flex gap-3 rounded-lg border border-success/30 bg-success-soft p-4 text-sm"
            >
              <MailCheck className="size-5 shrink-0 text-success" aria-hidden />
              <p>Se o e-mail existir, enviamos um link.</p>
            </div>
          ) : modo === "criar" && criar.isSuccess ? (
            <div
              role="status"
              className="mt-6 flex gap-3 rounded-lg border border-success/30 bg-success-soft p-4 text-sm"
            >
              <MailCheck className="size-5 shrink-0 text-success" aria-hidden />
              <div>
                <p className="font-medium">Conta criada. Falta confirmar o e-mail.</p>
                <p className="mt-1 text-muted-foreground">
                  Enviamos um link para <strong>{email.trim()}</strong>. Abra o link (confira o
                  spam) e depois entre com o seu e-mail e senha.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={enviar} className="mt-6 space-y-4" noValidate>
              {modo === "criar" && (
                <div className="space-y-2">
                  <Label htmlFor="nome">Seu nome</Label>
                  <Input
                    id="nome"
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={80}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {modo === "entrar" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="senha">Senha</Label>
                    <button
                      type="button"
                      className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => trocar("recuperar")}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    id="senha"
                    type="password"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              )}
              {modo === "criar" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="senha-nova">Senha</Label>
                    <Input
                      id="senha-nova"
                      type="password"
                      autoComplete="new-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                      minLength={8}
                      aria-describedby="dica-senha"
                    />
                    <p id="dica-senha" className="text-xs text-muted-foreground">
                      Pelo menos 8 caracteres.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmar-senha">Confirmar senha</Label>
                    <Input
                      id="confirmar-senha"
                      type="password"
                      autoComplete="new-password"
                      value={confirmacao}
                      onChange={(e) => setConfirmacao(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {erroLocal && (
                <p role="alert" className="text-sm text-destructive">
                  {erroLocal}
                </p>
              )}
              {modo === "recuperar" && recuperar.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Serviço indisponível. Tente de novo em instantes.
                </p>
              )}

              {msg && (
                <div
                  role="alert"
                  className="flex gap-3 rounded-lg border border-destructive/30 bg-danger-soft p-3 text-sm"
                >
                  {codigo === "conta_desativada" ? (
                    <Lock className="size-5 shrink-0 text-destructive" aria-hidden />
                  ) : (
                    <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
                  )}
                  <div>
                    <p className="font-medium">{msg.titulo}</p>
                    <p className="text-muted-foreground">{msg.texto}</p>
                    {codigo === "email_nao_confirmado" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={reenviar.isPending || reenviar.isSuccess}
                        onClick={() => reenviar.mutate()}
                      >
                        {reenviar.isPending && <Loader2 className="animate-spin" aria-hidden />}
                        {reenviar.isSuccess ? "Confirmação reenviada" : "Reenviar confirmação"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={ocupado}>
                {ocupado && <Loader2 className="animate-spin" aria-hidden />}
                {modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar conta" : "Enviar link"}
              </Button>
            </form>
          )}

          {modo !== "entrar" && (
            <button
              type="button"
              className="mt-4 rounded text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => trocar("entrar")}
            >
              {modo === "criar" && criar.isSuccess ? "Ir para entrar" : "Voltar para entrar"}
            </button>
          )}

          <p className="mt-8 border-t pt-4 text-sm text-muted-foreground">
            {aberto ? (
              modo === "criar" ? (
                "Quem recebeu acesso de um administrador não precisa criar conta: basta entrar."
              ) : (
                <>
                  Ainda não tem conta?{" "}
                  <button
                    type="button"
                    className="rounded font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => trocar("criar")}
                  >
                    Criar conta
                  </button>
                </>
              )
            ) : (
              "O acesso é criado pelo administrador."
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
