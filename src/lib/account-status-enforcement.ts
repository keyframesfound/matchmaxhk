import { createMiddleware } from "@tanstack/react-start";

import { accountStatusBlocksParticipation } from "@/features/admin-users/account-status.shared";

/**
 * Issue #308: refuse all mutating participation for suspended/banned
 * accounts. Chain AFTER requireSupabaseAuth in any server function that
 * creates user content (case requests, tutor applications, uploads,
 * messages, reports). Suspended users keep read access — only this gate is
 * closed — and banned users should already be signed out client-side; this
 * is the server-side backstop so a stale token cannot act either way.
 *
 * Uses the service-role client: one shared read path keeps the refusal
 * message consistent. A missing profile row is treated as 'active',
 * matching the DB column default for legacy accounts.
 */
export const requireAccountActive = createMiddleware({ type: "function" }).server(
  async ({ context, next }) => {
    const userId = (context as unknown as { userId?: string }).userId;
    if (!userId) {
      throw new Error("Unauthorized: No user ID found in request context");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("account_status")
      .eq("id", userId)
      .maybeSingle();

    // Missing row (legacy account pre-backfill) or a transient read error
    // must not lock everyone out: the DB column defaults to 'active'.
    const status = error ? "active" : (data?.account_status ?? "active");

    if (accountStatusBlocksParticipation(status)) {
      throw new Error("This account is suspended. Contact support.");
    }

    return next();
  },
);
