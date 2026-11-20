/**
 * Issue #772 Part 1 — service-role helpers for the 1-active-trial lock.
 *
 * All mutating work happens inside the SECURITY DEFINER RPCs created by
 * migration 20261115100000_issue_772_one_active_trial.sql (they are locked to
 * service_role, so only this server-side file can reach them):
 *
 *   case_trial_lock_state(case_id)                  → mutex state
 *   claim_case_trial_intro(case_id, tutor_id, …)    → open the one slot
 *   close_case_trial_intro(case_id, close_kind)     → spend it
 *   clear_case_ops_approval(case_id)                → staff release
 *   case_active_trial_or_case(user, subject, child) → #759 / #716 signal
 *
 * Kept out of trial-lock.functions.ts so the submit guard in
 * src/lib/cases.functions.ts and the ops-desk server fns share one path.
 * No createServerFn here: this file is server-only (imported dynamically).
 */

import { asAdminDb } from "@/features/materials/storage-helpers";
import type { Db } from "@/features/cases/desk-db";
import { selectRowsOrEmpty } from "@/features/cases/desk-db";
import {
  closeKindForLesson1,
  type ActiveTrialOrCaseSignal,
  type CaseTrialLockState,
  type TrialCloseKind,
  type TrialIntroRow,
  type TrialIntroSource,
} from "@/features/cases/trial-lock";

export type { Db };

/** Occupying lesson statuses (#636 engine / #768 occupancy share this set). */
const OCCUPYING_LESSON_STATUSES = ["planned", "confirmed", "done"] as const;

export async function trialLockDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

// ---------------------------------------------------------------------------
// RPC payload plumbing
// ---------------------------------------------------------------------------

type RawIntro = {
  introId?: string;
  caseId?: string;
  tutorId?: string;
  state?: string;
  sequence?: number;
  source?: string;
  lessonId?: string | null;
  startedAt?: string;
  closedAt?: string | null;
};

function mapIntro(raw: RawIntro | null | undefined): TrialIntroRow | null {
  if (!raw?.introId || !raw.tutorId) return null;
  return {
    introId: raw.introId,
    caseId: raw.caseId ?? "",
    tutorId: raw.tutorId,
    state: (raw.state ?? "active") as TrialIntroRow["state"],
    sequence: Number(raw.sequence ?? 1),
    source: (raw.source ?? "in_app") as TrialIntroRow["source"],
    lessonId: raw.lessonId ?? null,
    startedAt: raw.startedAt ?? "",
    closedAt: raw.closedAt ?? null,
  };
}

type RawLockState = {
  ok?: boolean;
  reason?: string;
  caseId?: string;
  requestId?: string;
  trialAttemptCount?: number;
  requiresOpsApproval?: boolean;
  opsApprovalRequestedAt?: string | null;
  active?: RawIntro | null;
  intros?: RawIntro[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** The mutex state of a case request chain, mapped to the structural type. */
export async function loadTrialLock(db: Db, caseId: string): Promise<CaseTrialLockState> {
  const { data, error } = await db.rpc("case_trial_lock_state", { _case_id: caseId });
  if (error) throw new Error(error.message ?? "trial lock read failed");
  const raw = asRecord(data) as RawLockState;
  if (raw.ok === false) {
    if (raw.reason === "CASE_NOT_FOUND") throw new Error("CASE_NOT_FOUND");
    throw new Error(`trial lock read failed: ${raw.reason ?? "unknown"}`);
  }
  const intros = (raw.intros ?? [])
    .map(mapIntro)
    .filter((row): row is TrialIntroRow => row !== null);
  const active = mapIntro(raw.active ?? null);
  return {
    caseId: raw.caseId ?? caseId,
    requestId: raw.requestId ?? caseId,
    trialAttemptCount: Number(raw.trialAttemptCount ?? 0),
    requiresOpsApproval: raw.requiresOpsApproval === true,
    opsApprovalRequestedAt: raw.opsApprovalRequestedAt ?? null,
    active,
    intros,
    confirmedLessonId: active?.lessonId ?? null,
  };
}

export type ClaimIntroResult =
  | { ok: true; introId: string; sequence: number; alreadyActive: boolean }
  | { ok: false; reason: "LOCKED_BY_ACTIVE_TRIAL"; active: TrialIntroRow | null }
  | { ok: false; reason: "REQUIRES_OPS_APPROVAL"; trialAttemptCount: number };

/** Open (or re-assert) the single active trial introduction on a request. */
export async function claimTrialIntro(
  db: Db,
  input: {
    caseId: string;
    tutorId: string;
    source?: TrialIntroSource;
    lessonId?: string | null;
  },
): Promise<ClaimIntroResult> {
  // #782 (CEO 2026-11-20): every new introduction passes the same hard gate
  // (Safety Attestation + AC-703-3 strike pause, tutor and parent).
  const { assertTutorCanBeIntroduced, assertParentCanBeMatched } =
    await import("@/features/trust/match-eligibility.server");
  await assertTutorCanBeIntroduced(db, input.tutorId);
  const caseRows = await selectRowsOrEmpty<{ parent_id: string | null }>(
    db,
    "tutoring_cases",
    "parent_id",
    [{ col: "id", op: "eq", value: input.caseId }],
  );
  await assertParentCanBeMatched(db, caseRows[0]?.parent_id ?? null);

  const { data, error } = await db.rpc("claim_case_trial_intro", {
    _case_id: input.caseId,
    _tutor_id: input.tutorId,
    _source: input.source ?? "in_app",
    _lesson_id: input.lessonId ?? null,
  });
  if (error) throw new Error(error.message ?? "trial intro claim failed");
  const raw = asRecord(data);
  if (raw.ok === true) {
    return {
      ok: true,
      introId: String(raw.introId ?? ""),
      sequence: Number(raw.sequence ?? 1),
      alreadyActive: raw.reason === "ALREADY_ACTIVE",
    };
  }
  if (raw.reason === "REQUIRES_OPS_APPROVAL") {
    return {
      ok: false,
      reason: "REQUIRES_OPS_APPROVAL",
      trialAttemptCount: Number(raw.trialAttemptCount ?? 0),
    };
  }
  if (raw.reason === "LOCKED_BY_ACTIVE_TRIAL") {
    return {
      ok: false,
      reason: "LOCKED_BY_ACTIVE_TRIAL",
      active: mapIntro(asRecord(raw.active) as RawIntro),
    };
  }
  throw new Error(`trial intro claim failed: ${String(raw.reason ?? "unknown")}`);
}

export type CloseIntroResult = {
  ok: boolean;
  reason?: string;
  introId?: string;
  tutorId?: string;
  state?: TrialIntroRow["state"];
  trialAttemptCount?: number;
};

/** Spend the active introduction (pre-L1 cancel / stop-after-L1 / replaced). */
export async function closeTrialIntro(
  db: Db,
  input: { caseId: string; closeKind: TrialCloseKind; actorId: string | null },
): Promise<CloseIntroResult> {
  const { data, error } = await db.rpc("close_case_trial_intro", {
    _case_id: input.caseId,
    _close_kind: input.closeKind,
    _actor: input.actorId,
  });
  if (error) throw new Error(error.message ?? "trial intro close failed");
  const raw = asRecord(data);
  return {
    ok: raw.ok === true,
    reason: typeof raw.reason === "string" ? raw.reason : undefined,
    introId: typeof raw.introId === "string" ? raw.introId : undefined,
    tutorId: typeof raw.tutorId === "string" ? raw.tutorId : undefined,
    state: typeof raw.state === "string" ? (raw.state as TrialIntroRow["state"]) : undefined,
    trialAttemptCount:
      raw.trialAttemptCount === undefined ? undefined : Number(raw.trialAttemptCount),
  };
}

/** Staff release of REQUIRES_OPS_APPROVAL after the concierge review. */
export async function clearTrialOpsApproval(
  db: Db,
  caseId: string,
): Promise<{ ok: boolean; wasRaised: boolean }> {
  const { data, error } = await db.rpc("clear_case_ops_approval", { _case_id: caseId });
  if (error) throw new Error(error.message ?? "ops approval clear failed");
  const raw = asRecord(data);
  return { ok: raw.ok === true, wasRaised: raw.wasRaised === true };
}

// ---------------------------------------------------------------------------
// #759 / #716 shared signal
// ---------------------------------------------------------------------------

/**
 * "Does this account (and child, when set) already have an active trial or
 * confirmed case in this subject?" — the ONE authoritative answer. #759 calls
 * it after Google sign-in on Submit and for already-signed-in parents; #716's
 * "Suggested for you" exclusion uses the same SoR status set
 * (ACTIVE_SUBJECT_SOR in trial-lock.ts).
 */
export async function activeTrialOrCaseSignal(
  db: Db,
  input: {
    userId: string;
    subject: string | null | undefined;
    childId?: string | null;
    excludeCaseId?: string | null;
  },
): Promise<ActiveTrialOrCaseSignal> {
  if (!input.userId || !input.subject || !input.subject.trim()) return { active: false };
  const { data, error } = await db.rpc("case_active_trial_or_case", {
    _user_id: input.userId,
    _subject: input.subject,
    _child_id: input.childId ?? null,
    _exclude_case_id: input.excludeCaseId ?? null,
  });
  if (error) throw new Error(error.message ?? "active trial or case probe failed");
  const raw = asRecord(data);
  if (raw.active !== true) return { active: false };
  return {
    active: true,
    kind: raw.kind === "trial" ? "trial" : "case",
    caseId: String(raw.caseId ?? ""),
    caseCode: typeof raw.caseCode === "string" ? raw.caseCode : null,
    sorStatus: typeof raw.sorStatus === "string" ? raw.sorStatus : null,
    subject: typeof raw.subject === "string" ? raw.subject : input.subject,
    tutorId: typeof raw.tutorId === "string" ? raw.tutorId : null,
    trialIntroId: typeof raw.trialIntroId === "string" ? raw.trialIntroId : null,
  };
}

// ---------------------------------------------------------------------------
// Case row + roles
// ---------------------------------------------------------------------------

export type LockCaseRow = {
  id: string;
  case_code: string;
  parent_id: string | null;
  student_id: string | null;
  subjects: string[] | null;
  status: string;
  sor_status: string | null;
  matched_tutor_id: string | null;
};

export async function loadLockCase(db: Db, caseId: string): Promise<LockCaseRow> {
  const rows = await selectRowsOrEmpty<LockCaseRow>(
    db,
    "tutoring_cases",
    "id, case_code, parent_id, student_id, subjects, status, sor_status, matched_tutor_id",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const row = rows[0];
  if (!row) throw new Error("CASE_NOT_FOUND");
  return row;
}

export async function hasStaffRole(db: Db, userId: string): Promise<boolean> {
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

/** Parent-owner or staff — the reads below are parent-facing too. */
export async function requireParentOrStaff(
  db: Db,
  row: LockCaseRow,
  userId: string,
): Promise<void> {
  if (row.parent_id && row.parent_id === userId) return;
  if (await hasStaffRole(db, userId)) return;
  throw new Error("FORBIDDEN");
}

// ---------------------------------------------------------------------------
// #768 confirmed-trial slot emission
// ---------------------------------------------------------------------------

export type ConfirmedTrialSlot = {
  lessonId: string;
  startsAt: string;
  /**
   * Which store makes the cell Busy. `case_lessons` is today's only one: the
   * #768 occupancy read (PR #774, availability-occupancy.functions.ts) derives
   * Occupied at READ time from case_lessons rows in an occupying status, so a
   * confirmed trial lesson IS the auto-Busy write. No separate slot table
   * exists on main yet — when #774's grid storage lands, extend this function
   * instead of writing a second store.
   */
  busySource: "case_lessons";
};

/**
 * Emit the confirmed-trial write that #768 consumes: one occupying
 * case_lessons row (sequence 1 = the trial lesson) for the matched tutor, so
 * the public grid stops showing that hour as Open. Idempotent on the case's
 * lesson 1: an existing row is re-confirmed in place rather than duplicated.
 *
 * TODO(#768): when weekly-grid cell storage ships (PR #774 slice 2+), extend
 * this hook with the cell/Busy write — do NOT add a second availability store.
 */
export async function emitConfirmedTrialBusy(
  db: Db,
  input: {
    caseId: string;
    tutorId: string;
    startsAtIso: string;
    durationMin: number;
    locationOrLink?: string | null;
    source: TrialIntroSource;
    actorId: string | null;
  },
): Promise<ConfirmedTrialSlot> {
  const startsAt = new Date(input.startsAtIso).toISOString();
  const now = new Date().toISOString();
  const existing = await selectRowsOrEmpty<{ id: string; starts_at: string }>(
    db,
    "case_lessons",
    "id, starts_at",
    [
      { col: "case_id", op: "eq", value: input.caseId },
      { col: "sequence", op: "eq", value: 1 },
    ],
  );
  const prior = existing[0];

  if (prior) {
    const { error } = await db
      .from<Record<string, unknown>>("case_lessons")
      .update({
        tutor_id: input.tutorId,
        starts_at: startsAt,
        duration_min: input.durationMin,
        location_or_link: input.locationOrLink ?? null,
        status: "confirmed",
        confirmed_by_parent_at: now,
        confirmed_by_tutor_at: input.source === "whatsapp_desk" ? now : null,
      })
      .eq("id", prior.id);
    if (error) throw new Error(error.message ?? "trial lesson confirm failed");
    return { lessonId: prior.id, startsAt, busySource: "case_lessons" };
  }

  const { data, error } = await db
    .from<{ id: string }>("case_lessons")
    .insert({
      case_id: input.caseId,
      sequence: 1,
      tutor_id: input.tutorId,
      starts_at: startsAt,
      duration_min: input.durationMin,
      location_or_link: input.locationOrLink ?? null,
      status: "confirmed",
      confirmed_by_parent_at: now,
      confirmed_by_tutor_at: input.source === "whatsapp_desk" ? now : null,
      created_by: input.actorId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message ?? "trial lesson insert failed");
  return { lessonId: data.id as string, startsAt, busySource: "case_lessons" };
}

/** Link the occupying lesson to the intro row so the lock state can show it. */
export async function attachLessonToActiveIntro(
  db: Db,
  caseId: string,
  lessonId: string,
): Promise<void> {
  const { error } = await db
    .from<Record<string, unknown>>("case_trial_intros")
    .update({ lesson_id: lessonId })
    .eq("case_id", caseId)
    .eq("state", "active");
  if (error) throw new Error(error.message ?? "trial intro lesson link failed");
}

/** True when this case's Lesson 1 is already done (stop-after-L1 close kind). */
export async function lesson1Done(
  db: Db,
  caseId: string,
  sorStatus: string | null,
): Promise<boolean> {
  if (
    sorStatus === "lesson_1_done" ||
    sorStatus === "lesson_2_scheduled" ||
    sorStatus === "lesson_2_done"
  ) {
    return true;
  }
  const rows = await selectRowsOrEmpty<{ status: string }>(db, "case_lessons", "status", [
    { col: "case_id", op: "eq", value: caseId },
    { col: "sequence", op: "eq", value: 1 },
  ]);
  return rows.some((row) => row.status === "done");
}

/** Close kind derived from the live lesson rows (fallback for a manual close). */
export async function derivedCloseKind(
  db: Db,
  caseId: string,
  sorStatus: string | null,
): Promise<TrialCloseKind> {
  return closeKindForLesson1(await lesson1Done(db, caseId, sorStatus));
}

export { OCCUPYING_LESSON_STATUSES };
