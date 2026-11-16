/**
 * Issue #772 Part 1 — 1-Active-Trial anti-shopping lock, pure rules.
 *
 * The rebuilt ticket ([was #711]) used its own vocabulary
 * (INTRODUCED_ACTIVE / CANCELLED_PRE_L1 / STOPPED_AFTER_L1). Those names map
 * onto the EXISTING SoR machine (src/features/cases/sor.ts) — there is no
 * second case-status table anywhere in this feature:
 *
 *   INTRODUCED_ACTIVE      → sor introduced | lesson_1_scheduled | lesson_1_done
 *   CANCELLED_PRE_L1       → closed before lesson_1_done  → ledger state closed_pre_l1
 *   STOPPED_AFTER_L1       → closed after lesson_1_done   → ledger state closed_after_l1
 *   LOCKED_BY_ACTIVE_TRIAL → derived UI state on the sibling shortlist cards
 *   REQUIRES_OPS_APPROVAL  → tutoring_cases.requires_ops_approval on the request
 *
 * Everything here is pure so the vitest suite pins the mutex, the rematch cap
 * and the shared "active trial or case in this subject" definition that #759's
 * post-auth guard and #716's exclusion list both read.
 */

/**
 * SoR states where a tutor holds the trial slot (§1.4 INTRODUCED_ACTIVE).
 * The mutex is kept through lesson_1_done until the parent either continues
 * toward Lesson 2 / fee or stops after Lesson 1.
 */
export const ACTIVE_TRIAL_SOR = ["introduced", "lesson_1_scheduled", "lesson_1_done"] as const;

/**
 * SoR states a subject counts as actively matched in — the SAME definition
 * the shipped #716 "Suggested for you" exclusion uses (introduced … active).
 * Shared by the #772 submit guard, the #759 post-auth guard and #716.
 */
export const ACTIVE_SUBJECT_SOR = [
  ...ACTIVE_TRIAL_SOR,
  "lesson_2_scheduled",
  "lesson_2_done",
  "fee_invoiced",
  "fee_paid",
  "active",
] as const;

export type ActiveTrialSor = (typeof ACTIVE_TRIAL_SOR)[number];

/** §1.3.3: introduction #1 (0 closed) and #2 (1 closed) unlock cleanly. */
export const FREE_TRIAL_INTRODUCTIONS = 2;

export function isActiveTrialStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (ACTIVE_TRIAL_SOR as readonly string[]).includes(status);
}

export function isActiveTrialOrCaseStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (ACTIVE_SUBJECT_SOR as readonly string[]).includes(status);
}

/** Ledger states, mirroring the rebuilt §1.4 names. */
export const TRIAL_INTRO_STATES = [
  "active",
  "closed_pre_l1",
  "closed_after_l1",
  "replaced",
] as const;
export type TrialIntroState = (typeof TRIAL_INTRO_STATES)[number];

export const TRIAL_INTRO_SOURCES = ["in_app", "whatsapp_desk", "concierge"] as const;
export type TrialIntroSource = (typeof TRIAL_INTRO_SOURCES)[number];

/** One row of the per-request trial ledger (case_trial_intros). */
export type TrialIntroRow = {
  introId: string;
  caseId: string;
  tutorId: string;
  state: TrialIntroState;
  /** 1 = initial introduction, 2 = 1st free rematch, 3 = needs ops approval. */
  sequence: number;
  source: TrialIntroSource;
  lessonId: string | null;
  startedAt: string;
  closedAt: string | null;
};

/** Mutex state for one case request chain (case_trial_lock_state RPC). */
export type CaseTrialLockState = {
  caseId: string;
  requestId: string;
  /** Closed trial introductions on this request; 0 = the initial introduction. */
  trialAttemptCount: number;
  requiresOpsApproval: boolean;
  opsApprovalRequestedAt: string | null;
  active: TrialIntroRow | null;
  intros: TrialIntroRow[];
  /** #768 confirmed-trial emission: the occupying lesson that turns cells Busy. */
  confirmedLessonId: string | null;
};

/** A third introduction ask is anything after two closed ones. */
export function trialAttemptCapReached(trialAttemptCount: number): boolean {
  return Number.isFinite(trialAttemptCount) && trialAttemptCount >= FREE_TRIAL_INTRODUCTIONS;
}

/** The introduction number the next successful unlock would be. */
export function nextIntroSequence(trialAttemptCount: number): number {
  const closed = Number.isFinite(trialAttemptCount)
    ? Math.max(0, Math.floor(trialAttemptCount))
    : 0;
  return closed + 1;
}

export type IntroAskDenial =
  | {
      ok: false;
      reason: "LOCKED_BY_ACTIVE_TRIAL";
      activeTutorId: string | null;
      activeIntroId: string | null;
    }
  | { ok: false; reason: "REQUIRES_OPS_APPROVAL"; trialAttemptCount: number };

export type IntroAskDecision =
  { ok: true; sequence: number; alreadyActive: boolean } | IntroAskDenial;

/**
 * The mutex decision, in the order the product lock requires:
 *   1. Another tutor already holds the single active slot → LOCKED, the
 *      parent must close the current trial first (HK$0 pre-L1 cancel or
 *      stop-after-L1).
 *   2. Re-asserting the SAME tutor is idempotent (double click / retried
 *      desk action), never a second introduction.
 *   3. Two closed introductions, or an already-raised ops flag → the 3rd ask
 *      does NOT auto-unlock, it needs concierge review.
 */
export function decideIntroAsk(input: {
  tutorId: string;
  active: Pick<TrialIntroRow, "introId" | "tutorId" | "sequence"> | null;
  trialAttemptCount: number;
  requiresOpsApproval: boolean;
}): IntroAskDecision {
  const { tutorId, active, trialAttemptCount, requiresOpsApproval } = input;

  if (active) {
    if (active.tutorId === tutorId) {
      return { ok: true, sequence: active.sequence, alreadyActive: true };
    }
    return {
      ok: false,
      reason: "LOCKED_BY_ACTIVE_TRIAL",
      activeTutorId: active.tutorId,
      activeIntroId: active.introId,
    };
  }

  if (requiresOpsApproval || trialAttemptCapReached(trialAttemptCount)) {
    return { ok: false, reason: "REQUIRES_OPS_APPROVAL", trialAttemptCount };
  }

  return { ok: true, sequence: nextIntroSequence(trialAttemptCount), alreadyActive: false };
}

/**
 * What a shortlisted tutor card shows while this request has a lock:
 *   active  → "ACTIVE TRIAL — Lesson 1 Pending" + its own actions
 *   locked  → the disabled "Close Current Trial First to Unlock" button
 *   backup  → "Shortlisted Backup", unlockable
 *   spent   → a closed introduction (rematch history), no action
 */
export type ShortlistCardState = "active" | "locked" | "backup" | "spent";

export function shortlistCardState(input: {
  tutorId: string;
  lock: Pick<CaseTrialLockState, "active" | "intros">;
}): ShortlistCardState {
  const { tutorId, lock } = input;
  if (lock.active && lock.active.tutorId === tutorId) return "active";
  const spent = lock.intros.some((intro) => intro.tutorId === tutorId && intro.state !== "active");
  if (spent) return "spent";
  if (lock.active) return "locked";
  return "backup";
}

/** Close kind for the active trial: L1 done means stop-after-L1 (#760 fees). */
export type TrialCloseKind = "pre_l1" | "after_l1" | "replaced";

export function closeKindForLesson1(lesson1Done: boolean): TrialCloseKind {
  return lesson1Done ? "after_l1" : "pre_l1";
}

/** True when a subject string matches the case's subject list (case-insensitive). */
export function sameSubject(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** First non-empty subject on a case row — the tag the ledger records. */
export function primarySubject(subjects: readonly string[] | null | undefined): string | null {
  for (const subject of subjects ?? []) {
    if (subject && subject.trim()) return subject.trim();
  }
  return null;
}

export type ActiveTrialOrCaseSignal =
  | { active: false }
  | {
      active: true;
      kind: "trial" | "case";
      caseId: string;
      caseCode: string | null;
      sorStatus: string | null;
      subject: string;
      tutorId: string | null;
      trialIntroId: string | null;
    };

/**
 * Shared signal for #759's post-auth duplicate-subject guard: a submit is
 * blocked (no INSERT) when this parent — and child, when one is set — already
 * has an active trial or confirmed case in the same subject. #759 owns the
 * toast/redirect UX; this only answers the question.
 */
export function blocksNewRequestInSubject(signal: ActiveTrialOrCaseSignal): boolean {
  return signal.active;
}

/**
 * Submit-guard error contract (issue #772 → #759). The refusal carries the
 * subject and the existing workspace code so #759 can render its locked toast
 * ("You already have an active trial or case for {{subject}}…") and redirect
 * without a second round trip.
 */
export const DUPLICATE_SUBJECT_ERROR_PREFIX = "DUPLICATE_SUBJECT_ACTIVE:";

export type DuplicateSubjectError = {
  code: "DUPLICATE_SUBJECT_ACTIVE";
  subject: string;
  caseCode: string | null;
  /** #759 Part 1: workspace redirect target (/account/cases/$caseId). */
  caseId: string | null;
};

export function parseDuplicateSubjectError(
  message: string | null | undefined,
): DuplicateSubjectError | null {
  if (!message || !message.includes(DUPLICATE_SUBJECT_ERROR_PREFIX)) return null;
  const payload = message.slice(
    message.indexOf(DUPLICATE_SUBJECT_ERROR_PREFIX) + DUPLICATE_SUBJECT_ERROR_PREFIX.length,
  );
  const [subject, caseCode, caseId] = payload.split(":");
  return {
    code: "DUPLICATE_SUBJECT_ACTIVE",
    subject: (subject ?? "").trim(),
    caseCode: caseCode && caseCode.trim() ? caseCode.trim() : null,
    caseId: caseId && caseId.trim() ? caseId.trim() : null,
  };
}
