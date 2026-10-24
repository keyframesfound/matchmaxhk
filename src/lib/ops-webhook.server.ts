/**
 * Issues #55 + #81 — internal ops webhook.
 *
 * One fire-and-forget notifier for events that need a human nudge beyond the
 * in-app desk: a new website case request (#55), a new 1-click tutor
 * application (#81) and a new tutor join application.
 *
 * The webhook URL lives in app_settings under the key `ops_webhook_url`
 * (set directly in Supabase — deliberately no admin UI). When the key is
 * absent or empty this is a silent no-op, so dev environments and unset
 * production keys cost nothing.
 *
 * NEVER throws: callers fire it with `void notifyOps(...).catch(() => {})`
 * and a webhook failure must never fail the user-facing action.
 * Dependency-free (plain fetch), server-only module.
 */
export async function notifyOps(event: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "ops_webhook_url")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const url = typeof data?.value === "string" ? data.value.trim() : "";
    if (!url) return;

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "matchmax",
        event,
        payload,
        occurred_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`[ops-webhook] ${event} rejected with HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`[ops-webhook] notification failed for ${event}:`, error);
  }
}
