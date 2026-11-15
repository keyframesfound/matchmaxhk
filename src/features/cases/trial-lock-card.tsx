import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Lock, Loader2, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import { cn } from "@/lib/utils";
import {
  clearTrialOpsApproval,
  closeCaseTrialIntro,
  getCaseTrialLock,
} from "@/features/cases/trial-lock.functions";
import {
  shortlistCardState,
  type CaseTrialLockState,
  type ShortlistCardState,
  type TrialCloseKind,
} from "@/features/cases/trial-lock";

/**
 * Issue #772 Part 1 — the anti-shopping lock surfaces.
 *
 * Locked copy (§1.5 of the ticket, EN + 繁中, never reworded):
 *   banner        trial_lock.banner
 *   locked button trial_lock.locked_button
 *   active status trial_lock.active_status
 *   backup status trial_lock.backup_status
 *   3rd rematch   trial_lock.ops_notice
 *
 * The mutex itself is the DB partial unique index + the SoR machine; these
 * components only read case_trial_lock_state and render it.
 */

const LOCK_QUERY_KEY = (caseId: string) => ["case", "trial-lock", caseId] as const;

export type TrialLockShortlistRow = {
  tutorId: string;
  /** Display line, e.g. "MM-T119 · IB 43/45". */
  label: string | null;
};

const STATUS_PILL =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold";

function statusPillClass(state: ShortlistCardState): string {
  if (state === "active") {
    return cn(STATUS_PILL, "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/10");
  }
  if (state === "locked") return cn(STATUS_PILL, "border-[color:var(--ink)]/15 bg-transparent");
  if (state === "spent") return cn(STATUS_PILL, "border-[color:var(--ink)]/10 bg-transparent");
  return cn(STATUS_PILL, "border-[color:var(--ink)]/15 bg-[color:var(--foreground)]/[0.04]");
}

/** The §1.5 anti-shopping banner. */
export function TrialLockBanner({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--foreground)]/[0.03] p-3",
        className,
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-link)]" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-muted-foreground">{t("trial_lock.banner")}</p>
    </div>
  );
}

function ActiveStatusLine({ label }: { label: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={statusPillClass("active")}>
        <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {t("trial_lock.active_status")}
      </span>
      {label ? <span className="text-sm font-medium text-[color:var(--ink)]">{label}</span> : null}
    </div>
  );
}

function LockedBackupLine({ label }: { label: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={statusPillClass("backup")}>{t("trial_lock.backup_status")}</span>
      {label ? <span className="text-sm font-medium text-[color:var(--ink)]">{label}</span> : null}
      <Button type="button" size="sm" variant="outline" className="h-8" disabled>
        <Lock className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        {t("trial_lock.locked_button")}
      </Button>
    </div>
  );
}

/** The 3rd-rematch ops-review notice (§1.5). */
export function TrialOpsApprovalNotice() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[color:var(--brand-link)]/30 bg-[color:var(--brand-link)]/[0.06] p-3">
      <ShieldCheck
        className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
        aria-hidden="true"
      />
      <p className="text-xs leading-relaxed text-[color:var(--ink)]">
        {t("trial_lock.ops_notice")}
      </p>
    </div>
  );
}

function useTrialLock(caseId: string) {
  return useQuery({
    queryKey: LOCK_QUERY_KEY(caseId),
    queryFn: () => getCaseTrialLock({ data: { caseId } }),
    staleTime: 30_000,
  });
}

/**
 * Parent-facing card for the Case Request inside the #735 workspace: the
 * anti-shopping banner, the active trial status and the ops notice. It never
 * offers a second tutor while a trial is open (that is the mutex, not copy).
 */
export function TrialLockCard({
  caseId,
  activeTutorLabel = null,
  className,
}: {
  caseId: string;
  activeTutorLabel?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useTrialLock(caseId);
  if (isLoading || !data) return null;
  const lock = data.lock;
  const showCard = Boolean(lock.active) || lock.requiresOpsApproval || lock.trialAttemptCount > 0;
  if (!showCard) return null;

  return (
    <section className={cn("space-y-3", className)} aria-labelledby={`trial-lock-${caseId}`}>
      <TrialLockBanner />
      <div className="space-y-2 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-3">
        <h2
          id={`trial-lock-${caseId}`}
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("trial_lock.title")}
        </h2>
        {lock.active ? <ActiveStatusLine label={activeTutorLabel} /> : null}
        {lock.trialAttemptCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("trial_lock.attempts_used", { count: lock.trialAttemptCount })}
          </p>
        ) : null}
        {lock.requiresOpsApproval ? <TrialOpsApprovalNotice /> : null}
      </div>
    </section>
  );
}

/**
 * Desk (Case Manager / Matching Ops Desk) panel. Shows the same lock plus the
 * shortlist rows with the locked backup button, the close actions that free
 * the slot, and the staff release for a 3rd rematch.
 */
export function TrialLockDeskPanel({
  caseId,
  shortlist = [],
  labelsById = {},
}: {
  caseId: string;
  shortlist?: TrialLockShortlistRow[];
  labelsById?: Record<string, string | null>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useTrialLock(caseId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: LOCK_QUERY_KEY(caseId) });

  const closeMutation = useMutation({
    mutationFn: (closeKind: TrialCloseKind) => closeCaseTrialIntro({ data: { caseId, closeKind } }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(t("trial_lock.closed_toast"));
        void invalidate();
      } else {
        toast.error(t("trial_lock.close_failed"));
      }
    },
    onError: () => toast.error(t("trial_lock.close_failed")),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearTrialOpsApproval({ data: { caseId } }),
    onSuccess: () => {
      toast.success(t("trial_lock.ops_cleared_toast"));
      void invalidate();
    },
    onError: () => toast.error(t("trial_lock.ops_clear_failed")),
  });

  if (isLoading || !data) return null;
  const lock: CaseTrialLockState = data.lock;
  const labelFor = (tutorId: string) => labelsById[tutorId] ?? null;
  const activeLabel = lock.active ? labelFor(lock.active.tutorId) : null;
  // No explicit shortlist passed → show the request's own intro ledger, so the
  // spent introductions and the locked siblings are still visible.
  const rows: TrialLockShortlistRow[] =
    shortlist.length > 0
      ? shortlist
      : lock.intros.map((intro) => ({ tutorId: intro.tutorId, label: labelFor(intro.tutorId) }));

  return (
    <ConsolePanel title={t("trial_lock.title")}>
      <div className="space-y-3">
        <TrialLockBanner />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t("trial_lock.request_ref", { code: data.caseCode })}</span>
          <span aria-hidden="true">·</span>
          <span>{t("trial_lock.attempts_used", { count: lock.trialAttemptCount })}</span>
          <span aria-hidden="true">·</span>
          <span>
            {lock.active
              ? t("trial_lock.slot_taken", { tutor: activeLabel ?? lock.active.tutorId })
              : t("trial_lock.slot_open")}
          </span>
        </div>

        {lock.active ? (
          <div className="space-y-2 rounded-xl border border-[color:var(--ink)]/10 p-3">
            <ActiveStatusLine label={activeLabel} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate("pre_l1")}
              >
                {closeMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                {t("trial_lock.close_pre_l1")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate("after_l1")}
              >
                {t("trial_lock.close_after_l1")}
              </Button>
            </div>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((row) => {
              const state = shortlistCardState({ tutorId: row.tutorId, lock });
              if (state === "active") return null;
              if (state === "locked") {
                return <LockedBackupLine key={row.tutorId} label={row.label} />;
              }
              return (
                <div key={row.tutorId} className="flex flex-wrap items-center gap-2">
                  <span className={statusPillClass(state)}>
                    {state === "spent"
                      ? t("trial_lock.spent_status")
                      : t("trial_lock.backup_status")}
                  </span>
                  <span className="text-sm font-medium text-[color:var(--ink)]">
                    {row.label ?? row.tutorId}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        {lock.requiresOpsApproval ? (
          <div className="space-y-2">
            <TrialOpsApprovalNotice />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={clearMutation.isPending}
              onClick={() => clearMutation.mutate()}
            >
              {clearMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {t("trial_lock.ops_release")}
            </Button>
          </div>
        ) : null}
      </div>
    </ConsolePanel>
  );
}
