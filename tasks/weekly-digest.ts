import { defineTask } from "nitro/task";

/**
 * #796 §2.6 (AC-742-4): the Sunday 20:00 HKT weekly learning digest.
 *
 * Nitro bundles `tasks/` separately from the app, so this file only orchestrates
 * and dynamic-imports the sweep from `src/` — statically importing an app module
 * here breaks the build on the `@/` alias (verified). Same shape as
 * `tasks/action-reminders.ts`.
 */
export default defineTask({
  meta: {
    name: "weekly-digest",
    description:
      "Send the #796 §2.6 weekly learning digest, one email per parent, Sunday 20:00 HKT (capped by #783).",
  },
  async run() {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { asAdminDb } = await import("@/features/materials/storage-helpers");
      const { runWeeklyDigestSweep } = await import("@/features/cases/weekly-digest-email.server");
      const result = await runWeeklyDigestSweep(asAdminDb(supabaseAdmin), new Date());
      return { result: "ok", ...result };
    } catch (err) {
      // Never throw out of a scheduled task (fx-refresh precedent).
      console.error("[weekly-digest] sweep failed:", err);
      return { result: "error" };
    }
  },
});
