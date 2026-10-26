import { useTranslation } from "react-i18next";

/**
 * Issue #443 — tutor-facing `[Short Case: X Lessons]` chip. Renders ONLY when
 * the case is flagged short; the rate display is untouched (the chip describes
 * the package shape, never the rate).
 */
export function ShortCaseChip({
  isShortCase,
  scheduledLessonCount,
}: {
  isShortCase: boolean;
  scheduledLessonCount: number | null;
}) {
  const { t } = useTranslation();
  if (!isShortCase || !scheduledLessonCount) return null;
  return (
    <span className="shrink-0 rounded-full border border-[color:var(--brand-link)]/30 bg-[color:var(--brand-link)]/[0.08] px-2 py-0.5 text-[11px] font-bold text-[color:var(--brand-link)]">
      {t("sor.short_case_chip", { n: scheduledLessonCount })}
    </span>
  );
}
