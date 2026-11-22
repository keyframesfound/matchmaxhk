import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { fetchCaseHeatmap, flagCaseTopic } from "@/features/cases/heatmap.functions";
import { cn } from "@/lib/utils";

/**
 * The three mastery bands the server reports, plus the uncovered case where a
 * syllabus topic has no tagged lesson yet.
 */
function pillClass(mastery: string | null): string {
  switch (mastery) {
    // DESIGN.md AA floor: brand/destructive text on a 10% wash misses AA at
    // 12px, so the LABEL stays ink and the colour rides on the border + wash.
    // The word itself ("Weak" / "Mastered") is the signal; colour only echoes it.
    case "weak":
      return "border-destructive/40 bg-destructive/10 text-[color:var(--ink)]";
    case "practicing":
      return "border-border bg-muted text-[color:var(--ink)]";
    case "mastered":
      return "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/10 text-[color:var(--ink)]";
    default:
      return "border-border bg-transparent text-muted-foreground";
  }
}

/**
 * #796 §2.1 Syllabus Topic Mastery Heatmap. Lives in the Case Workspace
 * progress tab, above the grade chart. Reads only what the server allows:
 * `null` (non-party, or no syllabus) renders nothing at all, and empty cells
 * render the empty line instead of a second gate.
 */
export function HeatmapSection({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["case-heatmap", caseId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchCaseHeatmap({ data: { caseId } }),
  });

  const flag = useMutation({
    mutationFn: (input: { topic: string; flagged: boolean }) =>
      flagCaseTopic({ data: { caseId, topic: input.topic, flagged: input.flagged } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error(t("common.error")),
  });

  if (!data) return null;

  const pct = Math.max(0, Math.min(100, data.summary.masteredPct));

  return (
    <section className="mt-4 space-y-2">
      <h2 className="text-sm font-semibold text-[color:var(--ink)]">{t("heatmap.title")}</h2>

      {data.cells.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("heatmap.empty")}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t("heatmap.summary", { pct: data.summary.masteredPct, weak: data.summary.weak })}
          </p>
          {/* The summary line already states the percentage, so the bar is a
              visual reinforcement only. */}
          <div
            className="h-2 w-full overflow-hidden rounded-full border border-border bg-muted"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-[color:var(--brand-link)]"
              style={{ width: `${pct}%` }}
            />
          </div>

          <ul className="flex flex-wrap gap-1.5">
            {data.cells.map((cell) => {
              const pending = flag.isPending && flag.variables?.topic === cell.tag;
              const label = cell.flagged ? t("heatmap.flagged") : t("heatmap.flag");

              return (
                <li
                  key={cell.tag}
                  className={cn(
                    "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                    pillClass(cell.mastery),
                  )}
                >
                  <span className="flex min-w-0 flex-col items-start">
                    <span className="[overflow-wrap:anywhere]">{cell.tag}</span>
                    {cell.weakByMistakes ? (
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {t("heatmap.suggested_weak")}
                      </span>
                    ) : null}
                  </span>

                  {data.canFlag ? (
                    <button
                      type="button"
                      aria-pressed={cell.flagged}
                      aria-label={`${label}: ${cell.tag}`}
                      disabled={pending}
                      onClick={() => flag.mutate({ topic: cell.tag, flagged: !cell.flagged })}
                      className="min-h-6 shrink-0 rounded-full px-1 text-[11px] font-medium underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {label}
                    </button>
                  ) : cell.flagged ? (
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                      {t("heatmap.flagged")}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
