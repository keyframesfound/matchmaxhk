// Issue #459 §15.8 Phase 0: verified teaching hours on the PUBLIC tutor
// profile, straight from the anon-executable SECURITY DEFINER RPC
// get_tutor_verified_hours (migration 20261031170000) — the same tolerant
// pattern as completed-cases-line / experience-badge: any error (PGRST202 on
// a pre-migration deploy) hides the component, never breaks the page.
//
// The number is always SUM(duration_hours) over verified_completed ledger
// rows (§11: public counters = ledger sum, no manual edits). Badges are
// pure recomputation: ≥25h Rising, ≥100h Azure. Zero-state rule: 0 hours →
// render NOTHING (hide-at-zero, like the experience pill).

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const RISING_HOURS = 25;
const AZURE_HOURS = 100;

function useVerifiedHours(tutorId: string | undefined): number | null {
  const [hours, setHours] = useState<number | null>(null);
  useEffect(() => {
    if (!tutorId) return;
    let cancelled = false;
    (async () => {
      // Keep the rpc call BOUND to the client, extracting the method loses
      // `this` and supabase-js throws reading `this.rest`.
      const client = supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await client.rpc("get_tutor_verified_hours", {
        _tutor_id: tutorId,
      });
      if (cancelled || error || data == null) return;
      const n = Number(Array.isArray(data) ? data[0] : data);
      if (Number.isFinite(n)) setHours(n);
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);
  return hours;
}

/**
 * Profile-header line under the completed-cases line; hides at zero.
 * Rising (25h+) is a neutral ink pill, Azure (100h+) carries the signature
 * MatchMax blue — flat borders only (DESIGN.md floating-shadow rule).
 */
export function VerifiedHoursLine({ tutorId, className }: { tutorId: string; className?: string }) {
  const { t } = useTranslation();
  const hours = useVerifiedHours(tutorId);
  if (hours == null || hours <= 0) return null;

  const azure = hours >= AZURE_HOURS;
  const rising = hours >= RISING_HOURS;

  return (
    <p className={cn("flex flex-wrap items-center gap-2 text-sm text-muted-foreground", className)}>
      <span>{t("hours.profile_line", { count: hours })}</span>
      {azure ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-link)]/30 bg-[color:var(--brand-link)]/[0.06] px-2 py-0.5 text-xs font-semibold text-[color:var(--brand-link)]">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          {t("hours.badge_azure")}
        </span>
      ) : rising ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--ink)]/15 bg-[color:var(--foreground)]/[0.04] px-2 py-0.5 text-xs font-semibold text-[color:var(--ink)]">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          {t("hours.badge_rising")}
        </span>
      ) : null}
    </p>
  );
}
