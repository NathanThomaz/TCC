import type { ApiErrorBody } from "../../shared/api";
import type { AppError } from "./errors";

const SECURITY_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
};

export function json(
  data: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(JSON.stringify(data), { status: init.status ?? 200, headers });
}

export function errorResponse(error: AppError, requestId: string, headers?: HeadersInit): Response {
  const body: ApiErrorBody = {
    error: { code: error.code, message: error.message, requestId },
  };
  return json(body, { status: error.status, ...(headers ? { headers } : {}) });
}
