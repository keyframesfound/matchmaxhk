import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ScheduleCase } from "@/features/cases/case-schedule.functions";

/**
 * One read-only fact. Returns nothing when the value is missing, so an online
 * case simply has no address row rather than an empty one.
 */
function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/**
 * #785 AC-CONV-2: the facts a parent or tutor confirms before a lesson, assembled
 * from the case payload. Read-only on purpose: phones stay behind the fee gate on
 * the parent case page, so there is no contact field here and no link to another
 * case. Collapsed by default so the drawer's overview stays short; goals live in
 * the household briefing further down, which the hint points at.
 */
export function CaseDetailsCard({ scheduleCase }: { scheduleCase: ScheduleCase }) {
  const { t } = useTranslation();
  const duration =
    scheduleCase.durationMin === null
      ? null
      : t("sor.schedule_next_minutes", { n: scheduleCase.durationMin });

  return (
    <details className="group rounded-[var(--radius-panel)] border border-border bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {t("case_details.title")}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="px-4 pb-4">
        <dl className="space-y-2 border-t border-border pt-3">
          <Row label={t("case_details.student")} value={scheduleCase.studentName} />
          <Row label={t("case_manager.fact_subject")} value={scheduleCase.subject} />
          <Row label={t("case_manager.fact_level")} value={scheduleCase.level} />
          <Row label={t("case_manager.fact_mode")} value={scheduleCase.mode} />
          <Row label={t("case_details.address")} value={scheduleCase.address} />
          <Row label={t("case_details.duration")} value={duration} />
          <Row
            label={t("case_manager.fact_rate")}
            value={
              scheduleCase.rateHkd === null
                ? null
                : t("case_manager.rate_value", { rate: scheduleCase.rateHkd })
            }
          />
          {scheduleCase.studentCount !== null && scheduleCase.studentCount > 1 ? (
            <Row
              label={t("case_board.form_student_count")}
              value={t("case_board.students_count", { count: scheduleCase.studentCount })}
            />
          ) : null}
        </dl>

        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted-foreground">{t("billing.fee_notice")}</p>
          <p className="text-sm font-medium">{t("case_details.matching_fee")}</p>
          <p className="text-xs text-muted-foreground">{t("case_details.settlement")}</p>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{t("case_details.brief_hint")}</p>
      </div>
    </details>
  );
}
