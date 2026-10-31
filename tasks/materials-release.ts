// Nitro scheduled task (issue #543): the 72-hour materials checkout hold.
// Flips past-due paid_held orders to completed_released (skipping orders
// with an open dispute). Fired hourly by the Cloudflare cron trigger via
// Nitro's scheduledTasks config in vite.config.ts; sweepCheckoutHolds is
// also called lazily from desk reads so a misfired cron never stalls a
// release for long.
import { defineTask } from "nitro/task";
import { asAdminDb } from "../src/features/materials/storage-helpers";
import { sweepCheckoutHolds } from "../src/features/materials/checkout-v2.functions";

export default defineTask({
  meta: {
    name: "materials-release",
    description:
      "Release #543 checkout holds: paid_held orders past hold_expires_at become completed_released (open disputes freeze).",
  },
  run: async () => {
    try {
      const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
      await sweepCheckoutHolds(asAdminDb(supabaseAdmin));
      return { result: { ok: true } };
    } catch (error) {
      console.error("[materials-release] failed:", error);
      return { result: { ok: false } };
    }
  },
});
