import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ConsolePanel } from "@/components/ui/console-panel";
import { hktClock, hktDayLabel } from "@/features/cases/case-schedule";
import { listCaseUsefulnessPulses } from "@/features/cases/usefulness-pulse.functions";
import { cn } from "@/lib/utils";

const VERDICT_LABEL: Record<string, string> = {
  very_useful: "usefulness_pulse.very_useful",
  okay: "usefulness_pulse.okay",
  needs_adjustment: "usefulness_pulse.needs_adjustment",
};

const TAG_LABEL: Record<string, string> = {
  clear_concepts: "usefulness_pulse.tag_clear_concepts",
  good_pace: "usefulness_pulse.tag_good_pace",
  pace_too_fast: "usefulness_pulse.tag_pace_too_fast",
  more_past_papers: "usefulness_pulse.tag_more_past_papers",
};

/**
 * #796 §2.4 — the desk view of the private parent/student lesson pulses.
 * Desk-only by contract: the server returns null for anyone who is not Ops,
 * and these rows are never joined, averaged or merged with the public
 * case_reviews ratings from #794. Read-only; correction stays in existing
 * desk tools.
 */
export function UsefulnessPulsePanel({ caseId }: { caseId: string }) {
  const { t, i18n } = useTranslation();
  const pulses = useQuery({
    queryKey: ["case-usefulness-pulses", caseId],
    queryFn: () => listCaseUsefulnessPulses({ data: { caseId } }),
  });

  const rows = pulses.data ?? [];
  if (pulses.isLoading || rows.length === 0) return null;

  return (
    <ConsolePanel>
      <h2 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
        {t("usefulness_pulse.ops_title")}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {t("usefulness_pulse.ops_note")}
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((pulse) => {
          const tagText = pulse.tags
            .map((tag) => TAG_LABEL[tag])
            .filter((label) => Boolean(label))
            .join(" · ");

          return (
            <li
              key={pulse.id}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                pulse.flaggedForOps
                  ? "border-destructive/40 border-l-2 bg-destructive/[0.06]"
                  : "border-[color:var(--ink)]/10",
              )}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-xs font-semibold text-[color:var(--ink)]">
                  {t("usefulness_pulse.milestone", { n: pulse.milestoneLesson })}
                </p>
                <span className="rounded-full border border-[color:var(--ink)]/15 px-2 py-0.5 text-[11px] font-medium text-[color:var(--ink)]">
                  {pulse.respondentRole === "parent"
                    ? t("usefulness_pulse.ops_respondent_parent")
                    : t("usefulness_pulse.ops_respondent_student")}
                </span>
                <span className="text-xs font-semibold text-[color:var(--ink)]">
                  {t(VERDICT_LABEL[pulse.verdict])}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {hktDayLabel(pulse.createdAt, i18n.language)}, {hktClock(pulse.createdAt)}
                </span>
              </div>
              {tagText ? (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tagText}</p>
              ) : null}
              {pulse.flaggedForOps ? (
                <p className="mt-1 text-[11px] font-medium text-destructive">
                  {t("usefulness_pulse.ops_flagged")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </ConsolePanel>
  );
}
