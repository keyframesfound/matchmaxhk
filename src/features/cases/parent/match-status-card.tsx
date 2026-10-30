/**
 * Issue #466: parent match-status card.
 *
 * A read-only stage tracker (Arc stepper semantics: markers + connectors,
 * aria-current on the active step, screen-reader status text, current-step
 * description only). Resting surface: flat, border-delineated, no shadows.
 * WhatsApp-first copy per the issue's copy locks; the admin fee is never
 * presented as parent-owed (#444 tutor-pays).
 */

import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SorStatus } from "@/features/cases/sor-db";
import { getMatchStage, MATCH_STAGE_ORDER } from "@/features/cases/parent/match-status";

export type MatchStageProps = {
  status: string;
  matchedTutorId: string | null;
  sorStatus: SorStatus | null;
};

export function MatchStatusCard({ status, matchedTutorId, sorStatus }: MatchStageProps) {
  const { t } = useTranslation();
  const stage = getMatchStage({ status, matchedTutorId, sorStatus });

  if (stage === "closed") {
    return (
      <section className="rounded-[var(--radius-panel)] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("case_status.title")}</h2>
        <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
          {t("case_status.stage_closed")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("case_status.desc_closed")}
        </p>
      </section>
    );
  }

  const currentIdx = MATCH_STAGE_ORDER.indexOf(stage);

  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-muted-foreground">{t("case_status.title")}</h2>
      <ol className="mt-4 flex items-start" aria-label={t("case_status.title")}>
        {MATCH_STAGE_ORDER.map((s, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          return (
            <Fragment key={s}>
              {i > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn("mt-3 h-px flex-1", done ? "bg-[color:var(--ink)]" : "bg-border")}
                />
              ) : null}
              <li
                aria-current={current ? "step" : undefined}
                className="flex w-16 flex-col items-center gap-1.5 sm:w-20"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                    done &&
                      "border-transparent bg-[color:var(--ink)] text-[color:var(--background)]",
                    current && "border-[color:var(--ink)] bg-card text-[color:var(--ink)]",
                    !done && !current && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-center text-xs leading-tight",
                    current
                      ? "font-semibold text-[color:var(--ink)]"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {t(`case_status.stage_${s}`)}
                  <span className="sr-only">
                    {" "}
                    {t(
                      done
                        ? "case_status.step_done"
                        : current
                          ? "case_status.step_current"
                          : "case_status.step_upcoming",
                    )}
                  </span>
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {t(`case_status.desc_${stage}`)}
      </p>
      {/* #529 bait-and-switch guard, shown once a tutor is matched. */}
      {matchedTutorId ? (
        <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-[color:var(--ink)]">
          {t("case_status.safety_note")}
        </p>
      ) : null}
    </section>
  );
}

/** Compact list-row chip with the same stage mapping (#466 cases list). */
export function MatchStageChip({ status, matchedTutorId, sorStatus }: MatchStageProps) {
  const { t } = useTranslation();
  const stage = getMatchStage({ status, matchedTutorId, sorStatus });
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--foreground)]/[0.06] px-3 py-1 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          stage === "closed" ? "bg-muted-foreground" : "bg-[color:var(--ink)]",
        )}
      />
      {t(`case_status.stage_${stage}`)}
    </span>
  );
}
