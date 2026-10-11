// Nitro scheduled task (issue #112): refreshes daily FX rates. Fired by the
// Cloudflare cron trigger ("0 22 * * *" = 6am HKT, after the ~16:00 UTC ECB
// fix) via Nitro's scheduledTasks config in vite.config.ts; the lazy refresh
// in ensureFreshRates covers the gap if the cron ever misfires.
import { defineTask } from "nitro/task";
import { refreshFxRates } from "../src/lib/fx.server";

export default defineTask({
  meta: {
    name: "fx-refresh",
    description: "Fetch daily FX rates (Frankfurter, HKD base) into exchange_rates.",
  },
  run: async () => {
    try {
      const { date } = await refreshFxRates();
      return { result: { ok: true, date } };
    } catch (error) {
      // Never bubble a failed fetch into a crashed cron invocation; the next
      // lazy request retries and the table keeps serving the previous rates.
      console.error("[fx-refresh] failed:", error);
      return { result: { ok: false } };
    }
  },
});
