import { useTranslation } from "react-i18next";

import type { DemandBadgeKind } from "@/features/tutors/engagement";
import { cn } from "@/lib/utils";

// Issues #102/#151: dynamic demand + Parent Favorite badges. Presentational
// only — the caller passes engagement data through the card's `engagement`
// prop (or renders these directly on the profile page). No shadows (repo
// rule): elevation comes from borders + tinted backgrounds. Azure stays
// reserved for money CTAs, so these use the issue's amber/red/neutral and a
// gold Parent Favorite accent.

const DEMAND_BADGE_STYLES: Record<DemandBadgeKind, string> = {
  one_slot_left: "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high_demand: "border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400",
  popular: "border-sky-600/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

const DEMAND_BADGE_ICONS: Record<DemandBadgeKind, string> = {
  one_slot_left: "⚡",
  high_demand: "🔥",
  popular: "🔖",
};

const DEMAND_BADGE_KEYS: Record<DemandBadgeKind, string> = {
  one_slot_left: "engagement.badge.one_slot_left",
  high_demand: "engagement.badge.high_demand",
  popular: "engagement.badge.popular",
};

export function DemandBadge({ kind, className }: { kind: DemandBadgeKind; className?: string }) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 whitespace-normal rounded-md border px-1.5 py-0.5 text-center text-[11px] font-bold leading-tight",
        DEMAND_BADGE_STYLES[kind],
        className,
      )}
    >
      <span className="shrink-0" aria-hidden="true">
        {DEMAND_BADGE_ICONS[kind]}
      </span>
      {t(DEMAND_BADGE_KEYS[kind])}
    </span>
  );
}

export function ParentFavoriteBadge({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 whitespace-normal rounded-md border border-amber-600/40 bg-amber-500/10 px-1.5 py-0.5 text-center text-[11px] font-bold leading-tight text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      <span className="shrink-0" aria-hidden="true">
        🔥
      </span>
      {t("engagement.parent_favorite")}
    </span>
  );
}

/**
 * Issue #391: small-group availability pill — "👥 Group from $Y/hr". Y is the
 * cheapest per-student figure across the tutor's small-group rate rows and
 * open cohorts (badge is hidden when neither exists). Neutral pill like the
 * SEN badge: group rates must never be mistaken for the 1-on-1 card floor.
 */
export function GroupClassBadge({
  rate,
  className,
}: {
  rate: number | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();

  if (!Number.isFinite(rate) || (rate as number) <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 whitespace-normal rounded-md border border-border bg-muted px-1.5 py-0.5 text-center text-[11px] font-bold leading-tight text-[color:var(--ink)]",
        className,
      )}
      title={t("tutor_card.group_badge_title")}
    >
      <span className="shrink-0" aria-hidden="true">
        👥
      </span>
      {t("tutor_card.group_badge_rate", { rate: Math.round(rate as number) })}
    </span>
  );
}
