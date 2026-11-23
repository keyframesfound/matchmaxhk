/**
 * Support diagnostics: the client error boundary reports the failure it
 * rendered, so "Oops" reports are actionable without asking the visitor to
 * open devtools. Writes are service-role only; the table has RLS on and no
 * policy, so nothing can read it from the browser.
 *
 * Deliberately unauthenticated: the most common failure this catches is an
 * auth/session error, where a token may not exist.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ReportInput = z.object({
  url: z.string().max(600),
  message: z.string().max(2000),
  stack: z.string().max(4000).optional(),
  userAgent: z.string().max(500).optional(),
});

export const reportClientError = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ReportInput.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { asAdminDb } = await import("@/features/materials/storage-helpers");
      await asAdminDb(supabaseAdmin)
        .from<never>("client_error_logs")
        .insert({
          url: data.url,
          message: data.message,
          stack: data.stack ?? null,
          user_agent: data.userAgent ?? null,
        });
    } catch (error) {
      // Diagnostics must never make the error page fail.
      console.warn("[client-error] report failed:", error instanceof Error ? error.message : error);
    }
    return { ok: true };
  });
