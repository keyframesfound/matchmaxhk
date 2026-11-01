import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, GraduationCap, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getCaseLearnerCv } from "@/features/account/academic-records.functions";
import { cn } from "@/lib/utils";

/**
 * Issue #545 C3: compact "Student Academic Snapshot" inside a case surface
 * (tutor case card / admin case detail). Shows the learner diagnostic
 * summary + non-private timeline records only when the learner's share
 * toggle is on; lazily fetched on expand so a list of cases costs nothing.
 */
export function LearnerSnapshotCard({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const cvQuery = useQuery({
    queryKey: ["case-learner-cv", caseId],
    queryFn: () => getCaseLearnerCv({ data: { caseId } }),
    enabled: open,
  });

  const data = cvQuery.data;
  const shared =
    data?.allowed && data.snapshot && (data.records.length > 0 || data.snapshot.current_level);

  return (
    <div className="mt-3 rounded-xl border border-[color:var(--ink)]/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium text-[color:var(--ink)]"
        aria-expanded={open}
      >
        <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t("cv.case_snapshot_title")}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-[color:var(--ink)]/10 p-3">
          {cvQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("sor.loading")}
            </div>
          ) : !shared ? (
            <p className="text-sm text-muted-foreground">{t("cv.case_snapshot_hidden")}</p>
          ) : (
            <div className="space-y-2">
              {data?.nickname && (
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {data.nickname}
                </p>
              )}
              <dl className="grid gap-1.5 text-sm sm:grid-cols-2">
                {data?.snapshot?.current_level && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("cv.level")}</dt>
                    <dd className="text-[color:var(--ink)]">{data.snapshot.current_level}</dd>
                  </div>
                )}
                {data?.snapshot?.target_goal_text && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("cv.goal")}</dt>
                    <dd className="text-[color:var(--ink)]">{data.snapshot.target_goal_text}</dd>
                  </div>
                )}
                {data?.snapshot?.strengths_text && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("cv.strengths")}</dt>
                    <dd className="text-[color:var(--ink)]">{data.snapshot.strengths_text}</dd>
                  </div>
                )}
                {data?.snapshot?.weaknesses_text && (
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("cv.needs")}</dt>
                    <dd className="text-[color:var(--ink)]">{data.snapshot.weaknesses_text}</dd>
                  </div>
                )}
              </dl>
              {(data?.records.length ?? 0) > 0 && (
                <ul className="space-y-1.5 pt-1">
                  {data?.records.map((r) => (
                    <li key={r.id} className="text-sm text-[color:var(--ink)]">
                      <span className="font-medium">
                        {r.title_or_program} · {r.institution_or_issuer}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        {r.start_year ?? ""}
                        {r.is_current ? "–" : r.end_year ? `–${r.end_year}` : ""}
                        {r.grades_or_results ? ` · ${r.grades_or_results}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
