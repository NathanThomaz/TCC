import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ContasApiBody,
  OperacaoApiBody,
  SessionResponse,
  SystemsApiBody,
} from "../../src/shared/api";
import type { VerifiedToken } from "../../src/worker/auth/firebase-token";
import { InvalidTokenError } from "../../src/worker/auth/firebase-token";
import { createApp } from "../../src/worker/app";
import { AccountLookupError } from "../../src/worker/auth/firebase-admin";
import { DISTRIBUIDORA } from "../fixtures/distribuidora";
import { limparBanco } from "../limpar-banco";

// Contas secundárias mínimas (seção 7, P0): convite, vínculo por sistema, revogação e
// desativação (T01, T02, T03, T04).

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
let agora = NOW;
const IDENTITIES: Record<string, VerifiedToken> = {
  "token-admin-000000000000": {
    uid: "uid-a",
    email: "a@example.com",
    emailVerified: true,
    authTime: NOW,
  },
  "token-admin2-00000000000": {
    uid: "uid-b",
    email: "b@example.com",
    emailVerified: true,
    authTime: NOW,
  },
  "token-novo-0000000000000": {
    uid: "uid-n",
    email: "novo@example.com",
    emailVerified: true,
    authTime: NOW,
  },
};
const ADMIN = "token-admin-000000000000";
const ADMIN2 = "token-admin2-00000000000";
const NOVO = "token-novo-0000000000000";

/** Firebase simulado: registra convites, desativações e reativações. */
let chamadas: string[] = [];
let falharConvite = false;
let falharDesativar = false;
let falharLookup = false;
let aoConsultar: (() => Promise<unknown>) | undefined;
let firebaseDesativado = new Set<string>();
/** Logins que já existem no Firebase (e-mail → uid). */
let loginsExistentes = new Map<string, string>();

const app = createApp({
  clock: { now: () => agora },
  auth: () => ({
    verify: (token) => {
      const identity = IDENTITIES[token];
      return identity ? Promise.resolve(identity) : Promise.reject(new InvalidTokenError("x"));
    },
    lookup: async (uid) => {
      await aoConsultar?.();
      if (falharLookup) throw new AccountLookupError("rede");
      return { validSince: null, disabled: firebaseDesativado.has(uid) };
    },
    contas: {
      invite: (email) => {
        chamadas.push(`convite:${email}`);
        return falharConvite ? Promise.reject(new Error("rede")) : Promise.resolve(`fb-${email}`);
      },
      disable: (uid) => {
        chamadas.push(`desativar:${uid}`);
        if (falharDesativar) return Promise.reject(new Error("rede"));
        firebaseDesativado.add(uid);
        return Promise.resolve();
      },
      enable: (uid) => {
        chamadas.push(`reativar:${uid}`);
        firebaseDesativado.delete(uid);
        return Promise.resolve();
      },
      findUid: (email) => Promise.resolve(loginsExistentes.get(email) ?? null),
      createWithPassword: (email, senha, nome, existente) => {
        // A senha não entra no registro, só o tamanho (o teste confere que chegou).
        chamadas.push(
          existente
            ? `atualizar:${existente}:${senha.length}`
            : `criar:${email}:${senha.length}:${nome ?? ""}`,
        );
        return falharConvite
          ? Promise.reject(new Error("rede"))
          : Promise.resolve(existente ?? `fb-${email}`);
      },
      setPassword: (uid, senha) => {
        chamadas.push(`senha:${uid}:${senha.length}`);
        return Promise.resolve();
      },
    },
  }),
});

type Body = ContasApiBody & SystemsApiBody & OperacaoApiBody;

async function call(method: string, path: string, token: string, body?: unknown, key?: string) {
  const response = await app(
    new Request(`https://app.test/api/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(method === "POST" ? { "idempotency-key": key ?? crypto.randomUUID() } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
  );
  return { status: response.status, body: await response.json<Body>() };
}

async function ativar(token: string, nome: string): Promise<string> {
  const id = (await call("POST", "/systems", token, { nome })).body.sistema!.id;
  const v = (
    await call("POST", `/systems/${id}/versions`, token, {
      origem: "formulario",
      rascunho: DISTRIBUIDORA,
    })
  ).body.versao!;
  await call("POST", `/systems/${id}/versions/${v.id}/approve`, token, { hash: v.hash });
  await call("POST", `/systems/${id}/activate`, token, { versao: v.id });
  return id;
}

let S1 = "";
let S2 = "";

beforeEach(async () => {
  agora = NOW;
  chamadas = [];
  falharConvite = false;
  falharDesativar = false;
  falharLookup = false;
  aoConsultar = undefined;
  firebaseDesativado = new Set();
  loginsExistentes = new Map();
  await limparBanco();
  const T = NOW - 1000;
  await env.DB.prepare(
    `INSERT INTO users (id, firebase_uid, email, role, status, owner_id, created_at, updated_at) VALUES
     ('a', 'uid-a', 'a@example.com', 'admin', 'active', NULL, ${T}, ${T}),
     ('b', 'uid-b', 'b@example.com', 'admin', 'active', NULL, ${T}, ${T})`,
  ).run();
  S1 = await ativar(ADMIN, "Distribuidora");
  S2 = await ativar(ADMIN, "Filial");
});

async function convidar(sistemas: string[], email = "novo@example.com") {
  return call("POST", "/contas", ADMIN, { email, nome: "Bruno", sistemas });
}

describe("contas secundárias", () => {
  it("convite: conta pendente com os sistemas escolhidos e link pedido ao Firebase", async () => {
    const r = await convidar([S1]);
    expect(r.status).toBe(201);
    expect(r.body.conviteEnviado).toBe(true);
    expect(r.body.conta).toMatchObject({
      email: "novo@example.com",
      nome: "Bruno",
      status: "pending",
    });
    expect(r.body.conta!.sistemas.map((s) => [s.nome, s.ativo])).toEqual([
      ["Distribuidora", true],
      ["Filial", false],
    ]);
    expect(chamadas).toEqual(["convite:novo@example.com"]);
    expect((await convidar([S1])).body.error!.code).toBe("email_em_uso");
  });

  it("primeiro acesso ativa a conta; ela opera só o sistema autorizado (T04)", async () => {
    await convidar([S1]);
    expect((await call("GET", `/systems/${S1}/produtos`, NOVO)).status).toBe(200);
    expect((await call("GET", `/systems/${S2}/produtos`, NOVO)).status).toBe(404);
    expect((await call("GET", "/contas", ADMIN)).body.contas![0]!.status).toBe("active");
  });

  it("T02: secundário não gerencia contas nem cria sistemas", async () => {
    await convidar([S1]);
    expect((await call("GET", "/contas", NOVO)).status).toBe(403);
    expect(
      (await call("POST", "/contas", NOVO, { email: "x@example.com", sistemas: [] })).status,
    ).toBe(403);
    expect((await call("POST", "/systems", NOVO, { nome: "Meu" })).status).toBe(403);
  });

  it("sistema de outro administrador não entra no convite, e nada é gravado", async () => {
    const alheio = await ativar(ADMIN2, "Alheio");
    const r = await convidar([S1, alheio]);
    expect(r.status).toBe(409);
    const n = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM users WHERE email = 'novo@example.com'",
    ).first<{
      n: number;
    }>();
    expect(n!.n).toBe(0);
    expect(chamadas).toEqual([]);
  });

  it("T03: revogar bloqueia a API do sistema; conceder de novo libera", async () => {
    const id = (await convidar([S1])).body.conta!.id;
    await call("GET", "/session", NOVO); // primeiro acesso
    const revogado = await call("POST", `/contas/${id}/acessos`, ADMIN, {
      sistema: S1,
      ativo: false,
    });
    expect(revogado.body.conta!.sistemas[0]!.ativo).toBe(false);
    expect((await call("GET", `/systems/${S1}/vendas`, NOVO)).status).toBe(404);
    await call("POST", `/contas/${id}/acessos`, ADMIN, { sistema: S2, ativo: true });
    expect((await call("GET", `/systems/${S2}/vendas`, NOVO)).status).toBe(200);
  });

  it("T01: desativar bloqueia na hora, revoga acessos e o Firebase; reativar exige revisar acessos", async () => {
    const id = (await convidar([S1, S2])).body.conta!.id;
    await call("GET", "/session", NOVO);
    agora = NOW + 1000;
    const d = await call("POST", `/contas/${id}/status`, ADMIN, { status: "disabled" });
    expect(d.body.conta).toMatchObject({ status: "disabled" });
    expect(d.body.conta!.sistemas.every((s) => !s.ativo)).toBe(true);
    expect((await call("GET", "/session", NOVO)).status).toBe(403);
    expect(chamadas).toContain("desativar:uid-n");
    // Sem reativar, conceder acesso é recusado.
    expect(
      (await call("POST", `/contas/${id}/acessos`, ADMIN, { sistema: S1, ativo: true })).status,
    ).toBe(409);

    const r = await call("POST", `/contas/${id}/status`, ADMIN, { status: "active" });
    expect(r.body.conta).toMatchObject({ status: "active" });
    expect(r.body.conta!.sistemas.every((s) => !s.ativo)).toBe(true);
    expect(chamadas).toContain("reativar:uid-n");
    // A sessão anterior à desativação continua inválida: é preciso entrar de novo.
    expect((await call("GET", "/session", NOVO)).status).toBe(401);
  });

  it("convite que falha no Firebase: a conta fica pendente e o convite é reenviado", async () => {
    falharConvite = true;
    const r = await convidar([S1]);
    expect(r.status).toBe(201);
    expect(r.body.conviteEnviado).toBe(false);
    falharConvite = false;
    const de_novo = await call("POST", `/contas/${r.body.conta!.id}/convite`, ADMIN, {});
    expect(de_novo.body.conviteEnviado).toBe(true);
    expect(chamadas).toEqual(["convite:novo@example.com", "convite:novo@example.com"]);
  });

  it("convite repetido com a mesma chave não duplica conta nem convite", async () => {
    const corpo = { email: "novo@example.com", sistemas: [S1] };
    const a = await call("POST", "/contas", ADMIN, corpo, "chave-convite-1");
    const b = await call("POST", "/contas", ADMIN, corpo, "chave-convite-1");
    expect(b.body.conta!.id).toBe(a.body.conta!.id);
    expect(chamadas).toHaveLength(1);
  });

  it("outro administrador não vê nem altera a conta", async () => {
    const id = (await convidar([S1])).body.conta!.id;
    expect((await call("GET", "/contas", ADMIN2)).body.contas).toEqual([]);
    expect(
      (await call("POST", `/contas/${id}/status`, ADMIN2, { status: "disabled" })).status,
    ).toBe(404);
  });
});

describe("contas: revisão cruzada", () => {
  async function contaAtiva(sistemas: string[]) {
    const id = (await convidar(sistemas)).body.conta!.id;
    await call("GET", "/session", NOVO); // primeiro acesso
    return id;
  }

  it("conta desativada não recebe acesso nem numa concessão em corrida (trigger)", async () => {
    const id = await contaAtiva([S1]);
    await call("POST", `/contas/${id}/status`, ADMIN, { status: "disabled" });
    await expect(
      env.DB.prepare(
        "INSERT INTO system_access (user_id, system_id, status, granted_by, created_at, updated_at) VALUES (?, ?, 'active', 'a', ?, ?) ON CONFLICT (user_id, system_id) DO UPDATE SET status = 'active'",
      )
        .bind(id, S1, NOW, NOW)
        .run(),
    ).rejects.toThrow(/conta_desativada/);
  });

  it("Firebase fora do ar: a tolerância não aceita conta desativada durante a consulta", async () => {
    const id = await contaAtiva([S1]);
    agora = NOW + 6 * 60_000; // conferência de revogação vencida (> 5 min), dentro da tolerância
    // O administrador desativa exatamente enquanto o Firebase é consultado, e a consulta falha.
    aoConsultar = () =>
      env.DB.prepare("UPDATE users SET status = 'disabled', updated_at = ? WHERE id = ?")
        .bind(agora, id)
        .run();
    falharLookup = true;
    expect((await call("GET", "/session", NOVO)).status).toBe(403);
  });
  it("desativada pelo Firebase: os acessos também são revogados e reativar volta sem acessos", async () => {
    const id = await contaAtiva([S1, S2]);
    firebaseDesativado.add("uid-n");
    agora = NOW + 6 * 60_000; // força a nova consulta ao Firebase
    expect((await call("GET", "/session", NOVO)).status).toBe(403);
    const r = await call("POST", `/contas/${id}/status`, ADMIN, { status: "active" });
    expect(r.body.conta!.sistemas.every((s) => !s.ativo)).toBe(true);
  });

  it("conta ainda pendente também é desativada no Firebase (uid guardado no convite)", async () => {
    const id = (await convidar([S1])).body.conta!.id;
    await call("POST", `/contas/${id}/status`, ADMIN, { status: "disabled" });
    expect(chamadas).toContain("desativar:fb-novo@example.com");
  });

  it("falha ao desativar no Firebase fica pendente e repetir tenta de novo", async () => {
    const id = await contaAtiva([S1]);
    falharDesativar = true;
    await call("POST", `/contas/${id}/status`, ADMIN, { status: "disabled" });
    const pendente = await env.DB.prepare("SELECT provider_sync FROM users WHERE id = ?")
      .bind(id)
      .first<{ provider_sync: string | null }>();
    expect(pendente!.provider_sync).toBe("desativar");
    falharDesativar = false;
    await call("POST", `/contas/${id}/status`, ADMIN, { status: "disabled" });
    const depois = await env.DB.prepare("SELECT provider_sync FROM users WHERE id = ?")
      .bind(id)
      .first<{ provider_sync: string | null }>();
    expect(depois!.provider_sync).toBeNull();
    expect(chamadas.filter((c) => c === "desativar:uid-n")).toHaveLength(2);
  });

  it("corte das sessões cobre o segundo inteiro (token emitido no mesmo segundo é recusado)", async () => {
    const id = await contaAtiva([S1]);
    // agora = NOW, exatamente no início de um segundo, igual ao auth_time do token.
    await call("POST", `/contas/${id}/status`, ADMIN, { status: "disabled" });
    await call("POST", `/contas/${id}/status`, ADMIN, { status: "active" });
    expect((await call("GET", "/session", NOVO)).status).toBe(401);
  });

  it("convite interrompido: a repetição com a mesma chave envia o convite e informa o envio", async () => {
    const corpo = { email: "novo@example.com", sistemas: [S1] };
    falharConvite = true;
    const a = await call("POST", "/contas", ADMIN, corpo, "chave-convite-2");
    expect(a.body.conviteEnviado).toBe(false);
    falharConvite = false;
    const b = await call("POST", "/contas", ADMIN, corpo, "chave-convite-2");
    expect(b.body.conviteEnviado).toBe(true);
    const c = await call("POST", "/contas", ADMIN, corpo, "chave-convite-2");
    expect(c.body.conviteEnviado).toBe(true);
    expect(chamadas).toEqual(["convite:novo@example.com", "convite:novo@example.com"]);
  });
});

describe("contas com senha e administradores (pedido do dono, 2026-11-13)", () => {
  const SENHA = "Senha-forte-123";

  it("secundária com senha: o acesso é criado na hora, sem e-mail, e o primeiro login ativa", async () => {
    const r = await call("POST", "/contas", ADMIN, {
      email: "novo@example.com",
      nome: "Bruno",
      sistemas: [S1],
      senha: SENHA,
    });
    expect(r.status).toBe(201);
    expect(r.body.acessoCriado).toBe(true);
    expect(r.body.conta).toMatchObject({ papel: "secondary", status: "pending" });
    expect(chamadas).toEqual([`criar:novo@example.com:${SENHA.length}:Bruno`]);
    expect((await call("GET", `/systems/${S1}/produtos`, NOVO)).status).toBe(200);
    // A senha nunca é gravada nem devolvida.
    const linha = await env.DB.prepare(
      "SELECT * FROM users WHERE email = 'novo@example.com'",
    ).first();
    expect(JSON.stringify(linha)).not.toContain(SENHA);
    expect(JSON.stringify(r.body)).not.toContain(SENHA);
  });

  it("senha curta é recusada; falha no Firebase deixa a conta pendente e a repetição cria", async () => {
    const curta = await call("POST", "/contas", ADMIN, {
      email: "novo@example.com",
      senha: "123",
    });
    expect(curta.status).toBe(422);
    falharConvite = true;
    const chave = crypto.randomUUID();
    const corpo = { email: "novo@example.com", sistemas: [S1], senha: SENHA };
    expect((await call("POST", "/contas", ADMIN, corpo, chave)).body.acessoCriado).toBe(false);
    falharConvite = false;
    expect((await call("POST", "/contas", ADMIN, corpo, chave)).body.acessoCriado).toBe(true);
  });

  it("só o dono do Nexus cria administrador independente, que não recebe acessos", async () => {
    const outro = await call("POST", "/contas", ADMIN2, {
      email: "novo@example.com",
      senha: SENHA,
      papel: "admin",
    });
    expect(outro.status).toBe(403);
    expect(outro.body.error!.code).toBe("so_o_dono");

    const r = await call("POST", "/contas", ADMIN, {
      email: "novo@example.com",
      nome: "Cliente",
      senha: SENHA,
      papel: "admin",
    });
    expect(r.status).toBe(201);
    expect(r.body.conta).toMatchObject({ papel: "admin", nome: "Cliente" });
    const acesso = await call("POST", `/contas/${r.body.conta!.id}/acessos`, ADMIN, {
      sistema: S1,
      ativo: true,
    });
    expect(acesso.status).toBe(422);

    // O novo administrador entra, cria o próprio sistema e não vê os do dono.
    const sistema = await call("POST", "/systems", NOVO, { nome: "Loja da cliente" });
    expect(sistema.status).toBe(201);
    const lista = (await call("GET", "/systems", NOVO)).body.sistemas!.map((s) => s.nome);
    expect(lista).toEqual(["Loja da cliente"]);
    expect((await call("GET", `/systems/${S1}/produtos`, NOVO)).status).toBe(404);
    // O dono vê, desativa e o login para.
    const contas = (await call("GET", "/contas", ADMIN)).body.contas!;
    expect(contas.map((c) => c.papel)).toEqual(["admin"]);
    await call("POST", `/contas/${r.body.conta!.id}/status`, ADMIN, { status: "disabled" });
    expect((await call("GET", "/systems", NOVO)).status).toBe(403);
  });

  it("login do Firebase de outra conta do Nexus não é tomado (e-mail mudou só no Firebase)", async () => {
    // O dono (uid-a) trocou o e-mail no Firebase; o D1 ainda tem o antigo.
    loginsExistentes.set("novo-do-dono@example.com", "uid-a");
    const r = await call("POST", "/contas", ADMIN2, {
      email: "novo-do-dono@example.com",
      senha: SENHA,
    });
    expect(r.status).toBe(409);
    expect(r.body.error!.code).toBe("email_em_uso");
    expect(chamadas).toEqual([]); // nenhuma senha trocada
  });

  it("login órfão no Firebase (sem conta no Nexus) é reaproveitado com a senha nova", async () => {
    loginsExistentes.set("novo@example.com", "fb-antigo");
    const r = await call("POST", "/contas", ADMIN, { email: "novo@example.com", senha: SENHA });
    expect(r.body.acessoCriado).toBe(true);
    expect(chamadas).toEqual([`atualizar:fb-antigo:${SENHA.length}`]);
  });

  describe("login de quem se cadastrou sozinho (ADR-009)", () => {
    // ADMIN2 não é o dono do Nexus: com o cadastro aberto, pode ser qualquer pessoa.
    it("outro administrador não troca a senha nem manda link para um login que já existe", async () => {
      loginsExistentes.set("vitima@example.com", "fb-vitima");
      const comSenha = await call("POST", "/contas", ADMIN2, {
        email: "vitima@example.com",
        senha: SENHA,
      });
      expect(comSenha.status).toBe(409);
      expect(comSenha.body.error!.code).toBe("email_ja_tem_login");
      const comLink = await call("POST", "/contas", ADMIN2, { email: "vitima@example.com" });
      expect(comLink.body.error!.code).toBe("email_ja_tem_login");
      expect(chamadas).toEqual([]);
      const linha = await env.DB.prepare(
        "SELECT id FROM users WHERE email = 'vitima@example.com'",
      ).first();
      expect(linha).toBeNull();
    });

    it("login criado depois do convite também não é tomado pelo reenvio nem pela senha", async () => {
      falharConvite = true;
      const r = await call("POST", "/contas", ADMIN2, { email: "vitima@example.com" });
      const id = r.body.conta!.id;
      falharConvite = false;
      // A pessoa se cadastra sozinha antes de o convite sair.
      loginsExistentes.set("vitima@example.com", "fb-vitima");
      chamadas = [];
      const reenvio = await call("POST", `/contas/${id}/convite`, ADMIN2);
      expect(reenvio.body.error!.code).toBe("email_ja_tem_login");
      const senha = await call("POST", `/contas/${id}/senha`, ADMIN2, { senha: SENHA });
      expect(senha.body.error!.code).toBe("email_ja_tem_login");
      expect(chamadas).toEqual([]);
    });
  });

  it("repetição atrasada não cria o acesso de novo nem volta a senha inicial", async () => {
    const chave = crypto.randomUUID();
    const corpo = { email: "novo@example.com", senha: SENHA };
    const primeira = await call("POST", "/contas", ADMIN, corpo, chave);
    await call("POST", `/contas/${primeira.body.conta!.id}/senha`, ADMIN, {
      senha: "Senha-nova-789",
    });
    chamadas = [];
    // Mesma chave, até com outra senha: é repetição; nada vai ao Firebase.
    const repetida = await call(
      "POST",
      "/contas",
      ADMIN,
      { ...corpo, senha: "Outra-123456" },
      chave,
    );
    expect(repetida.status).toBe(201);
    expect(repetida.body.acessoCriado).toBe(true);
    expect(chamadas).toEqual([]);
    // A senha não fica no registro de idempotência.
    const registros = await env.DB.prepare("SELECT * FROM operation_requests").all();
    expect(JSON.stringify(registros.results)).not.toContain(SENHA);
  });

  it("provisionamento interrompido: a reserva expira e a repetição cria o acesso", async () => {
    const chave = crypto.randomUUID();
    const corpo = { email: "novo@example.com", senha: SENHA };
    const r = await call("POST", "/contas", ADMIN, corpo, chave);
    // Simula a requisição que morreu depois de reservar e antes de criar o login.
    await env.DB.prepare("UPDATE users SET invited_uid = NULL, invite_sent_at = ? WHERE id = ?")
      .bind(agora, r.body.conta!.id)
      .run();
    chamadas = [];
    const reservada = await call("POST", "/contas", ADMIN, corpo, chave);
    expect(reservada.body.acessoCriado).toBe(false); // em andamento, não "concluído"
    expect(chamadas).toEqual([]);
    agora += 3 * 60_000;
    const retomada = await call("POST", "/contas", ADMIN, corpo, chave);
    expect(retomada.body.acessoCriado).toBe(true);
    expect(chamadas).toEqual([`criar:novo@example.com:${SENHA.length}:`]);
  });

  it("o administrador redefine a senha de uma conta sua; de outra, não", async () => {
    const id = (await call("POST", "/contas", ADMIN, { email: "novo@example.com", senha: SENHA }))
      .body.conta!.id;
    chamadas = [];
    const r = await call("POST", `/contas/${id}/senha`, ADMIN, { senha: "Outra-senha-456" });
    expect(r.status).toBe(200);
    expect(chamadas).toEqual(["senha:fb-novo@example.com:15"]);
    expect((await call("POST", `/contas/${id}/senha`, ADMIN2, { senha: SENHA })).status).toBe(404);
  });

  it("sessão: nome cadastrado e dono do Nexus; a pessoa edita o próprio nome", async () => {
    const antes = (await call("GET", "/session", ADMIN)).body as unknown as SessionResponse;
    expect(antes.usuario).toMatchObject({ nome: null, dono: true });
    expect(
      ((await call("GET", "/session", ADMIN2)).body as unknown as SessionResponse).usuario.dono,
    ).toBe(false);
    const r = await call("PATCH", "/session", ADMIN, { nome: "Nathan Thomaz" });
    expect((r.body as unknown as SessionResponse).usuario.nome).toBe("Nathan Thomaz");
    expect(
      ((await call("GET", "/session", ADMIN)).body as unknown as SessionResponse).usuario.nome,
    ).toBe("Nathan Thomaz");
    expect((await call("PATCH", "/session", ADMIN, { nome: "" })).status).toBe(422);
  });
});
