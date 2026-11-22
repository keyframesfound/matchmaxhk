import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  addCasePlannedTopic,
  fetchCaseHeatmap,
  flagCaseTopic,
  getCaseTopicPlan,
  removeCasePlannedTopic,
} from "@/features/cases/heatmap.functions";
import { TOPIC_PLAN_MAX } from "@/features/cases/heatmap-logic";
import { cn } from "@/lib/utils";

/**
 * The three mastery bands the server reports, plus the uncovered case where a
 * syllabus topic has no tagged lesson yet (including planned-but-unlogged, which
 * arrives as `mastery: null`).
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

/** #796 2.1: the mastery word, so the pill never leans on colour alone. */
function masteryLabel(mastery: string | null, t: (key: string) => string): string {
  switch (mastery) {
    case "weak":
      return t("heatmap.weak");
    case "practicing":
      return t("heatmap.practicing");
    case "mastered":
      return t("heatmap.mastered");
    default:
      return t("heatmap.not_covered");
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
  const [draft, setDraft] = useState("");

  const queryKey = ["case-heatmap", caseId];
  const planKey = ["case-topic-plan", caseId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchCaseHeatmap({ data: { caseId } }),
  });

  // Learners cannot edit, so they never pay for the plan fetch either.
  const { data: plan } = useQuery({
    queryKey: planKey,
    queryFn: () => getCaseTopicPlan({ data: { caseId } }),
    enabled: Boolean(data?.canEdit),
  });

  const flag = useMutation({
    mutationFn: (input: { topic: string; flagged: boolean }) =>
      flagCaseTopic({ data: { caseId, topic: input.topic, flagged: input.flagged } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error(t("common.error")),
  });

  const add = useMutation({
    mutationFn: (topic: string) => addCasePlannedTopic({ data: { caseId, topic } }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: planKey });
    },
    onError: (error: Error) => {
      // The server names its refusals; anything else stays generic.
      toast.error(
        error.message.includes("TOPIC_CAP")
          ? t("heatmap.err_TOPIC_CAP")
          : error.message.includes("TOPIC_REQUIRED")
            ? t("heatmap.err_TOPIC_REQUIRED")
            : t("common.error"),
      );
    },
  });

  const remove = useMutation({
    mutationFn: (topic: string) => removeCasePlannedTopic({ data: { caseId, topic } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKey });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error(t("common.error")),
  });

  if (!data) return null;

  const pct = Math.max(0, Math.min(100, data.summary.masteredPct));
  const planned = plan?.planned ?? [];
  const suggestions = plan?.suggestions ?? [];

  const submitTopic = (raw: string) => {
    const topic = raw.trim();
    if (!topic || add.isPending) return;
    add.mutate(topic);
  };

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
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {masteryLabel(cell.mastery, t)}
                    </span>
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

      {data.canEdit && plan ? (
        <div className="space-y-2 rounded-[var(--radius-panel)] border border-border bg-card p-3">
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-[color:var(--ink)]">
              {t("heatmap.plan_title")}
            </h3>
            <p className="text-[11px] text-muted-foreground">{t("heatmap.plan_hint")}</p>
            <p className="text-[11px] font-medium text-muted-foreground">
              {t("heatmap.plan_cap", { n: planned.length, max: TOPIC_PLAN_MAX })}
            </p>
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitTopic(draft);
            }}
          >
            <input
              type="text"
              value={draft}
              aria-label={t("heatmap.plan_placeholder")}
              placeholder={t("heatmap.plan_placeholder")}
              disabled={add.isPending}
              onChange={(event) => setDraft(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border bg-background px-3 text-xs text-[color:var(--ink)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={add.isPending || !draft.trim()}
              className="h-9 shrink-0 rounded-[var(--radius-control)] border border-border bg-card px-3 text-xs font-semibold text-[color:var(--ink)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("heatmap.plan_add")}
            </button>
          </form>

          {suggestions.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                {t("heatmap.plan_suggestions")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    disabled={add.isPending}
                    onClick={() => submitTopic(topic)}
                    className="h-8 rounded-full border border-border px-3 text-[11px] font-medium text-[color:var(--ink)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {planned.length > 0 ? (
            <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-control)] border border-border">
              {planned.map((topic) => {
                const pending = remove.isPending && remove.variables === topic;

                return (
                  <li key={topic} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="min-w-0 flex-1 text-xs text-[color:var(--ink)] [overflow-wrap:anywhere]">
                      {topic}
                    </span>
                    <button
                      type="button"
                      aria-label={t("heatmap.plan_remove", { topic })}
                      disabled={pending}
                      onClick={() => remove.mutate(topic)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
