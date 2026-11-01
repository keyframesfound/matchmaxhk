import { defineTask } from "nitro/task";

/**
 * #561: daily Action Required reminder sweep, 09:00 HKT (01:00 UTC).
 * Sends follow-up emails for open actions whose next_reminder_at has passed,
 * respecting the locked urgency cadence (High +1d/+3d, Medium +2d/+5d,
 * Low +7d, max 3 sends) and the recipient's preference gate. In-app items
 * are already pinned and never re-sent by this sweep.
 */
export default defineTask({
  meta: {
    name: "action-reminders",
    description: "Send due Action Required reminder emails (#561), 09:00 HKT daily.",
  },
  async run() {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { asAdminDb } = await import("@/features/materials/storage-helpers");
      const { runActionReminderSweep } = await import("@/features/cases/action-required.functions");
      await runActionReminderSweep(asAdminDb(supabaseAdmin), new Date());
      return { result: "ok" };
    } catch (err) {
      // Never throw out of a scheduled task (fx-refresh precedent).
      console.error("[action-reminders] sweep failed:", err);
      return { result: "error" };
    }
  },
});
