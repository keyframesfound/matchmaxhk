// Issue #459 §15.8 Phase 0: verified teaching hours on the PUBLIC tutor
// profile, straight from the anon-executable SECURITY DEFINER RPC
// get_tutor_verified_hours (migration 20261031170000) — the same tolerant
// pattern as completed-cases-line / experience-badge: any error (PGRST202 on
// a pre-migration deploy) hides the component, never breaks the page.
//
// The number is always SUM(duration_hours) over verified_completed ledger
// rows (§11: public counters = ledger sum, no manual edits). Badges are
// pure recomputation: ≥25h Rising, ≥100h Azure, ≥10 own learning hours
// Verified MatchMax Scholar. Zero-state rule: 0 hours →
// render NOTHING (hide-at-zero, like the experience pill).

import { useEffect, useState } from "react";
import { BadgeCheck, GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { isVerifiedScholar, teachingBadge } from "@/features/hours/hours";

type HoursRpc = "get_tutor_verified_hours" | "get_tutor_learning_hours";

function useTutorHours(rpc: HoursRpc, tutorId: string | undefined): number | null {
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
      const { data, error } = await client.rpc(rpc, {
        _tutor_id: tutorId,
      });
      if (cancelled || error || data == null) return;
      const n = Number(Array.isArray(data) ? data[0] : data);
      if (Number.isFinite(n)) setHours(n);
    })();
    return () => {
      cancelled = true;
    };
  }, [rpc, tutorId]);
  return hours;
}

/**
 * Profile-header line under the completed-cases line; hides at zero.
 * Rising (25h+) is a neutral ink pill, Azure (100h+) carries the signature
 * MatchMax blue — flat borders only (DESIGN.md floating-shadow rule).
 */
export function VerifiedHoursLine({ tutorId, className }: { tutorId: string; className?: string }) {
  const { t } = useTranslation();
  const hours = useTutorHours("get_tutor_verified_hours", tutorId);
  // #459 §4.2 step 4: the tutor's own verified learning hours (as a former
  // MatchMax student) unlock Scholar, even before they have taught.
  const learningHours = useTutorHours("get_tutor_learning_hours", tutorId);
  const teaching = hours ?? 0;
  const scholar = isVerifiedScholar(learningHours ?? 0);
  if (teaching <= 0 && !scholar) return null;

  const badge = teachingBadge(teaching);

  return (
    <p className={cn("flex flex-wrap items-center gap-2 text-sm text-muted-foreground", className)}>
      {teaching > 0 ? <span>{t("hours.profile_line", { count: teaching })}</span> : null}
      {badge === "azure" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-link)]/30 bg-[color:var(--brand-link)]/[0.06] px-2 py-0.5 text-xs font-semibold text-[color:var(--brand-link)]">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          {t("hours.badge_azure")}
        </span>
      ) : badge === "rising" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--ink)]/15 bg-[color:var(--foreground)]/[0.04] px-2 py-0.5 text-xs font-semibold text-[color:var(--ink)]">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          {t("hours.badge_rising")}
        </span>
      ) : null}
      {scholar ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--success)]/30 bg-[color:var(--success)]/[0.06] px-2 py-0.5 text-xs font-semibold text-[color:var(--success)]">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          {t("hours.badge_scholar")}
        </span>
      ) : null}
    </p>
  );
}
