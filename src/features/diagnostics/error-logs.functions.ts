/**
 * Error pipeline: the browser-side reporter as a server fn.
 *
 * Called by the route error boundary and by the window listeners below.
 * Deliberately unauthenticated — the most valuable failures include an auth
 * or session failure, where no token exists. Rows are deduped by fingerprint,
 * so volume cannot be used to flood the table with unique entries.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { errorFingerprint, isExpectedNoise } from "@/features/diagnostics/error-log";

const ReportInput = z.object({
  url: z.string().max(600),
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  userAgent: z.string().max(500).optional(),
});

export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ReportInput.parse(data))
  .handler(async ({ data }) => {
    const message = data.message.slice(0, 2000);
    if (isExpectedNoise(message)) return { ok: true };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { asAdminDb } = await import("@/features/materials/storage-helpers");
      await asAdminDb(supabaseAdmin).rpc("log_error", {
        p_source: "client",
        p_message: message,
        p_stack: data.stack ?? null,
        p_url: data.url.slice(0, 600),
        p_user_agent: data.userAgent ?? null,
        p_fingerprint: errorFingerprint("client", message, data.url),
      });
    } catch (error) {
      console.warn("[error-log] report failed:", error instanceof Error ? error.message : error);
    }
    return { ok: true };
  });
