import { authenticate, requireAdmin, requireSystemAccess } from "../auth/session";
import { AppError, notFound } from "../http/errors";
import { json } from "../http/responses";
import type { Handler, RequestContext } from "../http/router";

// Logotipo do sistema (seções 5 e 29): PNG ou JPEG de até 200 KB no D1. O tipo vem do conteúdo
// (assinatura do arquivo), nunca do nome nem do Content-Type enviado: SVG e qualquer outro formato
// são recusados. Servido com o tipo conferido e nosniff. Sem logotipo, a tela mostra iniciais.

export const LOGO_MAX_BYTES = 200 * 1024;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

/** Tipo pelo conteúdo: só PNG e JPEG são aceitos; qualquer outra coisa devolve null. */
export function tipoDoLogotipo(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  const comeca = (assinatura: number[]) => assinatura.every((b, i) => bytes[i] === b);
  if (bytes.length > PNG.length && comeca(PNG)) return "image/png";
  if (bytes.length > JPEG.length && comeca(JPEG)) return "image/jpeg";
  return null;
}

const grandeDemais = () =>
  new AppError(413, "logotipo_grande_demais", "O logotipo pode ter no máximo 200 KB.");

async function hexSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function abrir(ctx: RequestContext, admin: boolean) {
  const user = await authenticate(ctx, ctx.auth);
  if (admin) requireAdmin(user);
  const systemId = ctx.params.systemId ?? "";
  await requireSystemAccess(ctx.env.DB, user, systemId);
  return { user, systemId };
}

/** PUT: envia (ou troca) o logotipo. Corpo = o arquivo em si. Repetir o mesmo arquivo não muda nada. */
export const enviarLogotipo: Handler = async (ctx) => {
  const { user, systemId } = await abrir(ctx, true);
  const declarado = Number(ctx.request.headers.get("content-length") ?? "0");
  if (declarado > LOGO_MAX_BYTES) throw grandeDemais();
  const bytes = new Uint8Array(await ctx.request.arrayBuffer());
  if (bytes.length > LOGO_MAX_BYTES) throw grandeDemais();
  if (bytes.length === 0) {
    throw new AppError(400, "logotipo_vazio", "Escolha um arquivo PNG ou JPEG.");
  }
  const tipo = tipoDoLogotipo(bytes);
  if (!tipo) {
    throw new AppError(
      415,
      "logotipo_tipo_invalido",
      "O logotipo precisa ser PNG ou JPEG (SVG e outros formatos não são aceitos).",
    );
  }
  const now = ctx.clock.now();
  const sha256 = await hexSha256(bytes);
  const db = ctx.env.DB;
  await db.batch([
    db
      .prepare(
        `INSERT INTO system_logos (system_id, content_type, bytes, sha256, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (system_id) DO UPDATE SET content_type = excluded.content_type,
           bytes = excluded.bytes, sha256 = excluded.sha256, updated_by = excluded.updated_by,
           updated_at = excluded.updated_at
         WHERE system_logos.sha256 <> excluded.sha256`,
      )
      .bind(systemId, tipo, bytes, sha256, user.id, now),
    db
      .prepare(
        "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'logotipo.enviado', 'sistema', ?, ?)",
      )
      .bind(systemId, user.id, systemId, now),
  ]);
  return json({ logotipo: { tipo, bytes: bytes.length, sha256 } });
};

/** GET: qualquer conta com acesso ao sistema vê o logotipo (404 quando não há). */
export const obterLogotipo: Handler = async (ctx) => {
  const { systemId } = await abrir(ctx, false);
  const row = await ctx.env.DB.prepare(
    "SELECT content_type, bytes FROM system_logos WHERE system_id = ?",
  )
    .bind(systemId)
    .first<{ content_type: string; bytes: ArrayBuffer | number[] }>();
  if (!row) throw notFound();
  const corpo = row.bytes instanceof ArrayBuffer ? row.bytes : new Uint8Array(row.bytes).buffer;
  return new Response(corpo, {
    headers: {
      "content-type": row.content_type,
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
      "cache-control": "private, no-cache",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
};

/** DELETE: volta às iniciais. */
export const removerLogotipo: Handler = async (ctx) => {
  const { user, systemId } = await abrir(ctx, true);
  const now = ctx.clock.now();
  const db = ctx.env.DB;
  await db.batch([
    db.prepare("DELETE FROM system_logos WHERE system_id = ?").bind(systemId),
    db
      .prepare(
        "INSERT INTO audit_events (system_id, actor_id, action, target_type, target_id, created_at) VALUES (?, ?, 'logotipo.removido', 'sistema', ?, ?)",
      )
      .bind(systemId, user.id, systemId, now),
  ]);
  return json({ logotipo: null });
};
