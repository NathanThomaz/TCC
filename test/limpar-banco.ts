import { env } from "cloudflare:workers";

// Zera o D1 de teste respeitando as chaves estrangeiras. Itens de venda concluída não podem ser
// apagados (PRE-07), então a venda sai antes dos itens, com as chaves adiadas até o fim do lote.
export async function limparBanco(): Promise<void> {
  await env.DB.batch(
    [
      "PRAGMA defer_foreign_keys = ON",
      "DELETE FROM stock_movements",
      "DELETE FROM reservations",
      "DELETE FROM appointments",
      "DELETE FROM sales",
      "DELETE FROM sale_items",
      "DELETE FROM products",
      "DELETE FROM customers",
      "DELETE FROM professionals",
      "DELETE FROM system_logos",
      "DELETE FROM dev_request_events",
      "DELETE FROM dev_requests",
      "DELETE FROM requirements",
      "DELETE FROM messages",
      "DELETE FROM conversations",
      "DELETE FROM ai_usage",
      "DELETE FROM creation_state",
      "DELETE FROM operation_requests",
      "DELETE FROM approvals",
      "DELETE FROM validation_runs",
      "UPDATE systems SET active_version_id = NULL",
      "DELETE FROM model_versions",
      "DELETE FROM audit_events",
      "DELETE FROM system_access",
      "DELETE FROM systems",
      "DELETE FROM users WHERE owner_id IS NOT NULL",
      "DELETE FROM users",
    ].map((sql) => env.DB.prepare(sql)),
  );
}
