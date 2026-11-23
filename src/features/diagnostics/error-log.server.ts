/**
 * Error pipeline, server side: worker and server-fn failures.
 *
 * Writes through the service-role-only log_error() RPC so the upsert is atomic
 * and the table stays RLS-on with no policy.
 */

import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  errorFingerprint,
  isExpectedNoise,
  isSystemFailure,
  type ErrorSource,
} from "@/features/diagnostics/error-log";

type LogInput = {
  source: ErrorSource;
  message: string;
  stack?: string | null;
  url?: string | null;
  userAgent?: string | null;
};

/** Never throws: logging must not turn a handled failure into a new one. */
export async function logError(input: LogInput): Promise<void> {
  const message = (input.message || "Unknown error").slice(0, 2000);
  if (isExpectedNoise(message)) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await asAdminDb(supabaseAdmin).rpc("log_error", {
      p_source: input.source,
      p_message: message,
      p_stack: input.stack?.slice(0, 8000) ?? null,
      p_url: input.url?.slice(0, 600) ?? null,
      p_user_agent: input.userAgent?.slice(0, 500) ?? null,
      p_fingerprint: errorFingerprint(input.source, message, input.url ?? ""),
    });
  } catch (error) {
    console.warn("[error-log] write failed:", error instanceof Error ? error.message : error);
  }
}

/**
 * Logs a worker/server failure with the request it came from.
 *
 * `onlySystem` keeps the server-fn middleware from filling the table with
 * business-rule throws the UI already explains ("Order not found.").
 */
export async function logRequestError(
  request: Request,
  error: unknown,
  opts: { onlySystem?: boolean } = {},
): Promise<void> {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  if (opts.onlySystem && !isSystemFailure(message)) return;
  await logError({
    source: "server",
    message,
    // The stack is what turns a row into a fix: it carries the file and line
    // the throw came from, on top of the PostgREST detail in the message.
    stack: error instanceof Error ? (error.stack ?? null) : null,
    url: request.url,
    userAgent: request.headers.get("user-agent"),
  });
}
