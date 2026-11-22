import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getMyUsefulnessPulse,
  submitUsefulnessPulse,
} from "@/features/cases/usefulness-pulse.functions";
import {
  PULSE_TAGS,
  PULSE_TAG_MAX,
  PULSE_VERDICTS,
  type PulseTag,
  type PulseVerdict,
} from "@/features/cases/usefulness-pulse-logic";
import { InlineReportLink } from "@/features/reports/report-button";
import { cn } from "@/lib/utils";

/** Selected pill: azure border plus a 6% wash, label stays ink (AA floor). */
const PILL_SELECTED =
  "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/[0.06] text-[color:var(--ink)]";
const PILL_RESTING =
  "border-border text-muted-foreground hover:bg-muted hover:text-[color:var(--ink)]";
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]";

/**
 * Issue #796 §2.4 (was #733) Private lesson pulse, learner card.
 *
 * The parent or the student owner answers one private one-tap pulse at
 * verified-lesson milestones (5, 10, 15, …). The server decides who is due and
 * whether the milestone is already answered: `null` (Ops, tutor, non-party) and
 * `dueMilestone === null` both render nothing here, so the card never hints at
 * a case the caller cannot see.
 *
 * "Needs adjustment" quietly flags the row for Ops server-side; this card shows
 * no alarm and opens no review. A tutor never sees any of it.
 */
export function UsefulnessPulseCard({ caseId, tutorId }: { caseId: string; tutorId?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["case-usefulness-pulse", caseId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => getMyUsefulnessPulse({ data: { caseId } }),
  });

  const [verdict, setVerdict] = useState<PulseVerdict | null>(null);
  const [tags, setTags] = useState<PulseTag[]>([]);
  const [sent, setSent] = useState(false);
  const verdictRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const submit = useMutation({
    mutationFn: () =>
      submitUsefulnessPulse({ data: { caseId, verdict: verdict as PulseVerdict, tags } }),
    onSuccess: () => {
      setSent(true);
      void queryClient.invalidateQueries({ queryKey });
      toast.success(t("usefulness_pulse.thanks"));
    },
    onError: (error: Error) => {
      toast.error(
        t(`usefulness_pulse.err_${error.message}`, {
          defaultValue: error.message,
        }),
      );
      // ALREADY_ANSWERED means someone (or an earlier tab) already stored this
      // milestone: re-read so the card collapses instead of silently retrying.
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  // Nothing to ask: not a party, off-cadence, or already answered.
  if (!data || data.dueMilestone === null || data.answered || sent) return null;
  const dueMilestone = data.dueMilestone;

  const tagCapReached = tags.length >= PULSE_TAG_MAX;
  const toggleTag = (tag: PulseTag) => {
    setTags((current) => {
      if (current.includes(tag)) return current.filter((x) => x !== tag);
      if (current.length >= PULSE_TAG_MAX) return current;
      return [...current, tag];
    });
  };

  // Roving focus across the three verdicts (role="radio"); Tab still reaches
  // the group, Enter/Space select natively.
  const moveVerdict = (from: number, step: number) => {
    const next = (from + step + PULSE_VERDICTS.length) % PULSE_VERDICTS.length;
    setVerdict(PULSE_VERDICTS[next]);
    verdictRefs.current[next]?.focus();
  };

  return (
    <section
      aria-label={t("usefulness_pulse.title")}
      className="mt-4 rounded-[var(--radius-panel)] border border-border p-3"
    >
      <h2 className="text-sm font-semibold text-[color:var(--ink)]">
        {t("usefulness_pulse.milestone", { n: dueMilestone })}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("usefulness_pulse.body")}</p>
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        {t("usefulness_pulse.privacy")}
      </p>

      <div
        role="radiogroup"
        aria-label={t("usefulness_pulse.title")}
        className="mt-3 flex flex-wrap gap-2"
      >
        {PULSE_VERDICTS.map((option, index) => {
          const selected = verdict === option;
          return (
            <button
              key={option}
              ref={(node) => {
                verdictRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setVerdict(option)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  moveVerdict(index, 1);
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveVerdict(index, -1);
                }
              }}
              className={cn(
                "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                FOCUS_RING,
                selected ? PILL_SELECTED : PILL_RESTING,
              )}
            >
              {t(`usefulness_pulse.${option}`)}
            </button>
          );
        })}
      </div>

      <p id={`pulse-tags-${caseId}`} className="mt-3 text-xs text-muted-foreground">
        {t("usefulness_pulse.labels_hint")}
      </p>
      <div
        role="group"
        aria-labelledby={`pulse-tags-${caseId}`}
        className="mt-1.5 flex flex-wrap gap-1.5"
      >
        {PULSE_TAGS.map((tag) => {
          const selected = tags.includes(tag);
          const blocked = tagCapReached && !selected;
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={selected}
              aria-disabled={blocked || undefined}
              onClick={() => {
                if (blocked) return;
                toggleTag(tag);
              }}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                FOCUS_RING,
                selected && PILL_SELECTED,
                !selected && !blocked && PILL_RESTING,
                blocked && "border-border text-muted-foreground opacity-60",
              )}
            >
              {t(`usefulness_pulse.tag_${tag}`)}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          disabled={verdict === null || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {t("usefulness_pulse.submit")}
        </Button>
        {tutorId ? (
          <InlineReportLink
            targetType="tutor_card"
            targetId={tutorId}
            label={t("report.case_tutor_label")}
          />
        ) : null}
      </div>
    </section>
  );
}
