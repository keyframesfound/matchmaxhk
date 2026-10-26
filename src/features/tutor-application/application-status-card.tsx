/**
 * Issue #477: tutor-applicant status panel.
 *
 * A read-only stage tracker (Arc stepper semantics: markers + connectors,
 * aria-current on the active step, screen-reader status text, current-step
 * description only) — the applicant-side sibling of the parent #466
 * MatchStatusCard. Resting surface: flat, border-delineated, no shadows.
 * Copy locks from the issue: no grade or fee promises, no "we need more
 * info" filler — the NEEDS_INFO checklist renders only exact live items.
 */

import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  APPLICATION_STAGE_ORDER,
  getApplicationStage,
} from "@/features/tutor-application/application-status";
import {
  getMyApplicationStatus,
  type MyApplicationStatus,
} from "@/features/tutor-application/application-status.functions";

export type ApplicationStatusCardProps = {
  status: string;
  linkedTutorId: string | null;
  needsInfoItems: string[];
  tutorCode: string | null;
  cardLive: boolean;
};

export function ApplicationStatusCard({
  status,
  linkedTutorId,
  needsInfoItems,
  tutorCode,
  cardLive,
}: ApplicationStatusCardProps) {
  const { t } = useTranslation();
  const stage = getApplicationStage({ status, linkedTutorId, needsInfoItems });

  if (stage === "rejected") {
    return (
      <section className="rounded-[var(--radius-panel)] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("application_status.title")}
        </h2>
        <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
          {t("application_status.stage_rejected")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("application_status.desc_rejected")}
        </p>
      </section>
    );
  }

  const currentIdx = APPLICATION_STAGE_ORDER.indexOf(stage);

  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {t("application_status.title")}
      </h2>
      <ol className="mt-4 flex items-start" aria-label={t("application_status.title")}>
        {APPLICATION_STAGE_ORDER.map((s, i) => {
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
                    done && "border-transparent bg-[color:var(--ink)] text-white",
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
                  {t(`application_status.stage_${s}`)}
                  <span className="sr-only">
                    {" "}
                    {t(
                      done
                        ? "application_status.step_done"
                        : current
                          ? "application_status.step_current"
                          : "application_status.step_upcoming",
                    )}
                  </span>
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {t(`application_status.desc_${stage}`)}
      </p>
      {stage === "needs_info" && needsInfoItems.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[color:var(--ink)]">
          {needsInfoItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {stage === "approved" && tutorCode ? (
        cardLive ? (
          <a
            href={`/tutors/${tutorCode}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-[color:var(--ink)] underline decoration-[color:var(--ink)]/30 underline-offset-2 hover:decoration-[color:var(--ink)]"
          >
            {t("application_status.view_card")}
          </a>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("application_status.card_not_live")}
          </p>
        )
      ) : null}
    </section>
  );
}

/**
 * Self-fetching panel for the two mount points (/join success screen and the
 * /account page). Renders nothing while loading or when the signed-in user
 * has no application — callers decide what shows in that case.
 */
export function ApplicationStatusPanel() {
  const { data } = useQuery({
    queryKey: ["account", "application-status"],
    queryFn: getMyApplicationStatus,
  });
  if (!data) return null;
  const panel: MyApplicationStatus = data;
  return (
    <ApplicationStatusCard
      status={panel.status}
      linkedTutorId={panel.linkedTutorId}
      needsInfoItems={panel.needsInfoItems}
      tutorCode={panel.tutorCode}
      cardLive={panel.cardLive}
    />
  );
}
