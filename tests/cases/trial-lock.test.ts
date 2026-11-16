import { describe, expect, it } from "vitest";

import {
  ACTIVE_SUBJECT_SOR,
  ACTIVE_TRIAL_SOR,
  DUPLICATE_SUBJECT_ERROR_PREFIX,
  FREE_TRIAL_INTRODUCTIONS,
  blocksNewRequestInSubject,
  closeKindForLesson1,
  decideIntroAsk,
  isActiveTrialOrCaseStatus,
  isActiveTrialStatus,
  nextIntroSequence,
  parseDuplicateSubjectError,
  primarySubject,
  shortlistCardState,
  trialAttemptCapReached,
  type CaseTrialLockState,
  type TrialIntroRow,
} from "../../src/features/cases/trial-lock";

function intro(overrides: Partial<TrialIntroRow> = {}): TrialIntroRow {
  return {
    introId: "intro-1",
    caseId: "case-1",
    tutorId: "tutor-A",
    state: "active",
    sequence: 1,
    source: "in_app",
    lessonId: null,
    startedAt: "2026-11-15T00:00:00.000Z",
    closedAt: null,
    ...overrides,
  };
}

function lock(overrides: Partial<CaseTrialLockState> = {}): CaseTrialLockState {
  return {
    caseId: "case-1",
    requestId: "case-1",
    trialAttemptCount: 0,
    requiresOpsApproval: false,
    opsApprovalRequestedAt: null,
    active: null,
    intros: [],
    confirmedLessonId: null,
    ...overrides,
  };
}

describe("#772 active-trial SoR definition", () => {
  it("keeps the mutex through lesson_1_done", () => {
    expect(ACTIVE_TRIAL_SOR).toEqual(["introduced", "lesson_1_scheduled", "lesson_1_done"]);
    expect(isActiveTrialStatus("introduced")).toBe(true);
    expect(isActiveTrialStatus("lesson_1_scheduled")).toBe(true);
    expect(isActiveTrialStatus("lesson_1_done")).toBe(true);
    expect(isActiveTrialStatus("lesson_2_scheduled")).toBe(false);
    expect(isActiveTrialStatus("closed")).toBe(false);
    expect(isActiveTrialStatus(null)).toBe(false);
  });

  it("matches the shipped #716 exclusion range (introduced … active)", () => {
    expect(new Set(ACTIVE_SUBJECT_SOR)).toEqual(
      new Set([
        "introduced",
        "lesson_1_scheduled",
        "lesson_1_done",
        "lesson_2_scheduled",
        "lesson_2_done",
        "fee_invoiced",
        "fee_paid",
        "active",
      ]),
    );
    for (const status of ["introduced", "lesson_2_scheduled", "fee_paid", "active"]) {
      expect(isActiveTrialOrCaseStatus(status)).toBe(true);
    }
    for (const status of ["draft", "closed", "replaced", "waived", ""]) {
      expect(isActiveTrialOrCaseStatus(status)).toBe(false);
    }
  });
});

describe("#772 introduction counter + rematch cap", () => {
  it("counts free introductions from 0", () => {
    expect(FREE_TRIAL_INTRODUCTIONS).toBe(2);
    expect(nextIntroSequence(0)).toBe(1);
    expect(nextIntroSequence(1)).toBe(2);
    expect(nextIntroSequence(2)).toBe(3);
    expect(nextIntroSequence(-3)).toBe(1);
  });

  it("flags the cap only after two closed introductions", () => {
    expect(trialAttemptCapReached(0)).toBe(false);
    expect(trialAttemptCapReached(1)).toBe(false);
    expect(trialAttemptCapReached(2)).toBe(true);
    expect(trialAttemptCapReached(3)).toBe(true);
    expect(trialAttemptCapReached(Number.NaN)).toBe(false);
  });
});

describe("#772 mutex decision", () => {
  it("unlocks introduction #1 cleanly", () => {
    expect(
      decideIntroAsk({
        tutorId: "tutor-A",
        active: null,
        trialAttemptCount: 0,
        requiresOpsApproval: false,
      }),
    ).toEqual({ ok: true, sequence: 1, alreadyActive: false });
  });

  it("unlocks the 1st free rematch (#2) after one close", () => {
    expect(
      decideIntroAsk({
        tutorId: "tutor-B",
        active: null,
        trialAttemptCount: 1,
        requiresOpsApproval: false,
      }),
    ).toEqual({ ok: true, sequence: 2, alreadyActive: false });
  });

  it("locks every other tutor while one tutor is active", () => {
    const decision = decideIntroAsk({
      tutorId: "tutor-B",
      active: intro({ tutorId: "tutor-A" }),
      trialAttemptCount: 0,
      requiresOpsApproval: false,
    });
    expect(decision).toEqual({
      ok: false,
      reason: "LOCKED_BY_ACTIVE_TRIAL",
      activeTutorId: "tutor-A",
      activeIntroId: "intro-1",
    });
  });

  it("treats re-asserting the same tutor as idempotent, never a 2nd intro", () => {
    expect(
      decideIntroAsk({
        tutorId: "tutor-A",
        active: intro({ tutorId: "tutor-A", sequence: 2 }),
        trialAttemptCount: 1,
        requiresOpsApproval: false,
      }),
    ).toEqual({ ok: true, sequence: 2, alreadyActive: true });
  });

  it("never auto-unlocks a 3rd introduction", () => {
    expect(
      decideIntroAsk({
        tutorId: "tutor-C",
        active: null,
        trialAttemptCount: 2,
        requiresOpsApproval: false,
      }),
    ).toEqual({ ok: false, reason: "REQUIRES_OPS_APPROVAL", trialAttemptCount: 2 });
  });

  it("stays blocked while the ops flag is raised, even below the cap", () => {
    expect(
      decideIntroAsk({
        tutorId: "tutor-C",
        active: null,
        trialAttemptCount: 0,
        requiresOpsApproval: true,
      }),
    ).toEqual({ ok: false, reason: "REQUIRES_OPS_APPROVAL", trialAttemptCount: 0 });
  });
});

describe("#772 shortlist card states", () => {
  it("labels the active tutor, locks the siblings, keeps spent ones as history", () => {
    const state = lock({
      active: intro({ tutorId: "tutor-A" }),
      intros: [
        intro({ tutorId: "tutor-B", state: "closed_pre_l1", introId: "intro-0", sequence: 1 }),
      ],
    });
    expect(shortlistCardState({ tutorId: "tutor-A", lock: state })).toBe("active");
    expect(shortlistCardState({ tutorId: "tutor-C", lock: state })).toBe("locked");
    expect(shortlistCardState({ tutorId: "tutor-B", lock: state })).toBe("spent");
  });

  it("every shortlisted tutor is unlockable when no trial is open", () => {
    expect(shortlistCardState({ tutorId: "tutor-A", lock: lock() })).toBe("backup");
  });
});

describe("#772 close kind", () => {
  it("maps lesson 1 done to stop-after-L1", () => {
    expect(closeKindForLesson1(false)).toBe("pre_l1");
    expect(closeKindForLesson1(true)).toBe("after_l1");
  });
});

describe("#772 shared duplicate-subject signal", () => {
  it("blocks a submit only when the shared signal is active", () => {
    expect(blocksNewRequestInSubject({ active: false })).toBe(false);
    expect(
      blocksNewRequestInSubject({
        active: true,
        kind: "trial",
        caseId: "case-1",
        caseCode: "REQ-882",
        sorStatus: "lesson_1_scheduled",
        subject: "Biology",
        tutorId: "tutor-A",
        trialIntroId: "intro-1",
      }),
    ).toBe(true);
  });

  it("round-trips the submit-guard error contract for #759", () => {
    // #759 Part 1: the error now carries subject:caseCode:caseId so the
    // client can toast-redirect straight to the #735 Case Workspace.
    const message = `${DUPLICATE_SUBJECT_ERROR_PREFIX}Biology:REQ-882:11111111-1111-4111-8111-111111111111`;
    expect(parseDuplicateSubjectError(message)).toEqual({
      code: "DUPLICATE_SUBJECT_ACTIVE",
      subject: "Biology",
      caseCode: "REQ-882",
      caseId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parseDuplicateSubjectError(`${DUPLICATE_SUBJECT_ERROR_PREFIX}Mathematics:`)).toEqual({
      code: "DUPLICATE_SUBJECT_ACTIVE",
      subject: "Mathematics",
      caseCode: null,
      caseId: null,
    });
    expect(
      parseDuplicateSubjectError(`${DUPLICATE_SUBJECT_ERROR_PREFIX}Mathematics::`),
    ).toEqual({
      code: "DUPLICATE_SUBJECT_ACTIVE",
      subject: "Mathematics",
      caseCode: null,
      caseId: null,
    });
    expect(parseDuplicateSubjectError("Submission could not be accepted.")).toBeNull();
    expect(parseDuplicateSubjectError(null)).toBeNull();
  });

  it("picks the first non-empty subject for the ledger tag", () => {
    expect(primarySubject([" ", "Biology", "Chemistry"])).toBe("Biology");
    expect(primarySubject([])).toBeNull();
    expect(primarySubject(null)).toBeNull();
  });
});
