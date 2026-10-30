import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * Issue #520: first-lesson offer badges on the public tutor card. Copy is
 * CEO-locked (tutor_card.trial_badge / discount_badge / promo_tooltip); same
 * pill anatomy as GroupClassBadge so the badge column wraps cleanly.
 */

const PILL =
  "inline-flex max-w-full items-center whitespace-normal rounded-md border border-border bg-muted px-1.5 py-0.5 text-center text-[11px] font-bold leading-tight text-[color:var(--ink)]";

export type PromoBadgeInput = {
  offers_free_trial: boolean;
  offers_first_lesson_discount: boolean;
  first_lesson_discount_pct: number;
};

export function PromoBadges({ tutor, className }: { tutor: PromoBadgeInput; className?: string }) {
  const { t } = useTranslation();
  if (!tutor.offers_free_trial && !tutor.offers_first_lesson_discount) return null;
  const tooltip = t("tutor_card.promo_tooltip");
  return (
    <>
      {tutor.offers_free_trial ? (
        <span className={cn(PILL, className)} title={tooltip}>
          {t("tutor_card.trial_badge")}
        </span>
      ) : null}
      {tutor.offers_first_lesson_discount ? (
        <span className={cn(PILL, className)} title={tooltip}>
          {t("tutor_card.discount_badge", { pct: tutor.first_lesson_discount_pct })}
        </span>
      ) : null}
    </>
  );
}
