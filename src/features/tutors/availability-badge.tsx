import { useTranslation } from "react-i18next";

import type { Tutor } from "@/features/tutors/queries";
import { cn } from "@/lib/utils";
import { getTutorAvailabilityBadge } from "./tutor-display";

/**
 * Issue #715: compact availability pill on the public tutor card, under the
 * photo in the badge column (same wrap-friendly pill anatomy as the
 * status/SEN/demand badges). Emerald = open for intake, neutral slate =
 * currently full. Renders NOTHING for taking tutors with no slot data —
 * we never claim availability we cannot see.
 */
export function TutorAvailabilityBadge({
  tutor,
  className,
}: {
  tutor: Pick<Tutor, "is_accepting_students" | "remaining_student_slots">;
  className?: string;
}) {
  const { t } = useTranslation();
  const badge = getTutorAvailabilityBadge(tutor);
  if (!badge) return null;

  const label =
    badge.kind === "slots_left"
      ? t("tutor_card.badge_slots_left", { count: badge.count })
      : badge.kind === "available_now"
        ? t("tutor_card.badge_available_now")
        : t("tutor_card.status_full");

  return (
    <span
      className={cn(
        "inline-flex max-w-full whitespace-normal rounded-md border px-1.5 py-0.5 text-center text-[11px] font-bold leading-tight",
        badge.kind === "full"
          ? "border-border bg-muted text-[color:var(--ink)]"
          : "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      {label}
    </span>
  );
}
