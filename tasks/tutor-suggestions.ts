import { defineTask } from "nitro/task";

/**
 * #717 / #783 §2.3: "3 tutors with open slots" suggestion emails, Tuesday and
 * Thursday 11:00 HKT (self-gated on the hourly trigger). Off until the owner
 * sets app_settings.tutor_suggestion_emails_enabled = true.
 *
 * Nitro bundles `tasks/` separately from the app, so this file only
 * orchestrates and dynamic-imports the sweep from `src/` (weekly-digest
 * precedent).
 */
export default defineTask({
  meta: {
    name: "tutor-suggestions",
    description:
      "Send #717 tutor suggestion emails (opt-in, 14-day cadence, 7-day #783 cap); off until enabled in app_settings.",
  },
  async run() {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { asAdminDb } = await import("@/features/materials/storage-helpers");
      const { runTutorSuggestionSweep } =
        await import("@/features/search/tutor-suggestions-email.server");
      const result = await runTutorSuggestionSweep(asAdminDb(supabaseAdmin), new Date());
      return { result: "ok", ...result };
    } catch (err) {
      // Never throw out of a scheduled task (fx-refresh precedent).
      console.error("[tutor-suggestions] sweep failed:", err);
      return { result: "error" };
    }
  },
});
