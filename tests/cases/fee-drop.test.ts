import { describe, expect, it } from "vitest";

import {
  FEE_RULE_LABELS,
  SHADOWBAN_DAYS,
  buildOutcome,
  dropRecordError,
  normalizeBypassFlag,
  normalizeDropVerification,
  normalizePromoType,
  normalizeSplitMode,
  resolveCaseFee,
  lessonValueFromRate,
  suggestOutcomeKind,
  tierBaseMultiplier,
  trustCounterDelta,
  trustCountersFor,
  type CaseOutcome,
  type DropReasonClass,
  type DropVerification,
  type FeeResolutionInput,
} from "../../src/features/cases/fee-drop";
import { fullAdminFeeAmount } from "../../src/features/cases/fee-breakdown";

// R = $600: the case's locked rate.
const R = 600;

function stop(
  verification: DropVerification,
  reasonClass: DropReasonClass = "vague",
  initiator: "parent" | "centre" | "tutor" | "admin" = "parent",
): CaseOutcome {
  return { kind: "stopped_after_l1", initiator, verification, reasonClass };
}

function fee(overrides: Partial<FeeResolutionInput> & { outcome: CaseOutcome }) {
  return resolveCaseFee({ lessonValueHkd: R, ...overrides });
}

describe("lessonValueFromRate (R = the locked hourly rate, #385 basis)", () => {
  it("uses the hourly rate as R, matching fullAdminFeeAmount", () => {
    expect(lessonValueFromRate(600)).toBe(600);
    expect(
      resolveCaseFee({ lessonValueHkd: 600, outcome: { kind: "continued" } }).finalCommissionDueHkd,
    ).toBe(fullAdminFeeAmount(600));
  });

  it("returns null when no positive rate is locked", () => {
    expect(lessonValueFromRate(null)).toBeNull();
    expect(lessonValueFromRate(0)).toBeNull();
    expect(lessonValueFromRate(-5)).toBeNull();
  });
});

describe("tierBaseMultiplier (#508 ladder)", () => {
  it("steps 1.5 / 1.5 / 1.0 / 0.5 / 0", () => {
    expect(tierBaseMultiplier("primary")).toBe(1.5);
    expect(tierBaseMultiplier(1)).toBe(1.5);
    expect(tierBaseMultiplier(2)).toBe(1.0);
    expect(tierBaseMultiplier(3)).toBe(0.5);
    expect(tierBaseMultiplier(4)).toBe(0);
  });
});

describe("resolveCaseFee — #520 QA checklist", () => {
  it("free 15–20m online trial, parent stops → $0", () => {
    const r = fee({ promoType: "free_online_trial", outcome: { kind: "trial_only_stop" } });
    expect(r.ruleId).toBe("FREE_TRIAL_STOP");
    expect(r.finalCommissionDueHkd).toBe(0);
    expect(r.opensOwnershipWindow).toBe(false);
  });

  it("free trial → continues → 1.5×R on regular lessons", () => {
    const r = fee({ promoType: "free_online_trial", outcome: { kind: "continued" } });
    expect(r.finalCommissionDueHkd).toBe(900);
  });

  it("50% off first → continues → fee on full R", () => {
    const r = fee({
      promoType: "discounted_first",
      firstLessonDiscountPct: 50,
      outcome: { kind: "continued" },
    });
    expect(r.ruleId).toBe("CONTINUED_FULL");
    expect(r.finalCommissionDueHkd).toBe(900);
  });

  it("parent-verified drop after one paid lesson → 0.5×R", () => {
    const r = fee({ outcome: stop("verified") });
    expect(r.ruleId).toBe("DROP_PROTECTED");
    expect(r.finalCommissionDueHkd).toBe(300);
    expect(r.protectionApplied).toBe(true);
    expect(r.opensOwnershipWindow).toBe(true);
    expect(r.advancesRetainedTier).toBe(false);
  });

  it("tutor claims drop but parent says continuing → protection void", () => {
    const r = fee({ outcome: stop("rejected_bypass") });
    expect(r.ruleId).toBe("UNVERIFIED_VOID");
    expect(r.finalCommissionDueHkd).toBe(600);
    expect(r.protectionApplied).toBe(false);
  });

  it("parent no-show / <24h cancel before L1 → 100% L1, not Drop-Protection", () => {
    const r = fee({ outcome: { kind: "l1_no_show" } });
    expect(r.ruleId).toBe("NO_SHOW_L1_DUE");
    expect(r.finalCommissionDueHkd).toBe(600);
    expect(r.protectionApplied).toBe(false);
  });

  it("confirmed off-platform → full fee owed + ban", () => {
    const r = fee({ bypass: "confirmed", outcome: stop("verified") });
    expect(r.ruleId).toBe("BYPASS_CONFIRMED_FULL");
    expect(r.finalCommissionDueHkd).toBe(900);
    expect(r.consequences.banTutor).toBe(true);
  });

  it("50% off first + verified drop → protection on the paid amount", () => {
    const r = fee({
      promoType: "discounted_first",
      firstLessonDiscountPct: 50,
      outcome: stop("verified"),
    });
    expect(r.finalCommissionDueHkd).toBe(150);
  });
});

describe("resolveCaseFee — verification gate (tutor word never reduces the fee)", () => {
  it("pending or missing verification leaves nothing final", () => {
    expect(fee({ outcome: stop("pending") }).finalCommissionDueHkd).toBeNull();
    expect(fee({ outcome: stop("none") }).ruleId).toBe("VERIFICATION_PENDING");
  });

  it("in-progress cases have no final fee", () => {
    const r = fee({ outcome: { kind: "in_progress" } });
    expect(r.ruleId).toBe("IN_PROGRESS");
    expect(r.finalCommissionDueHkd).toBeNull();
  });

  it("pre-L1 reject is $0 and opens no ownership window", () => {
    const r = fee({ outcome: { kind: "pre_l1_reject" } });
    expect(r.finalCommissionDueHkd).toBe(0);
    expect(r.opensOwnershipWindow).toBe(false);
  });
});

describe("resolveCaseFee — #525 full rules", () => {
  it("clear tutor fault voids protection → 1.0×R", () => {
    expect(fee({ outcome: stop("verified", "tutor_fault") }).finalCommissionDueHkd).toBe(600);
    expect(fee({ outcome: stop("rejected_tutor_fault") }).ruleId).toBe("TUTOR_FAULT_VOID");
  });

  it("serious misconduct voids, bans and offers a rematch (no parent refund)", () => {
    const r = fee({ outcome: stop("verified", "serious_misconduct") });
    expect(r.ruleId).toBe("SERIOUS_MISCONDUCT_VOID");
    expect(r.finalCommissionDueHkd).toBe(600);
    expect(r.consequences).toMatchObject({ banTutor: true, priorityRematch: true });
  });

  it("centre-verified drops follow the same rules", () => {
    const r = fee({ outcome: stop("verified", "vague", "centre") });
    expect(r.ruleId).toBe("DROP_PROTECTED");
    expect(r.finalCommissionDueHkd).toBe(300);
  });

  it("repeat early-drop pattern voids protection and flags the tutor", () => {
    const r = fee({ priorQualityDrops: 2, outcome: stop("verified") });
    expect(r.ruleId).toBe("REPEAT_PATTERN_VOID");
    expect(r.finalCommissionDueHkd).toBe(600);
    expect(r.consequences.flagTutorForReview).toBe(true);
  });

  it("one prior quality drop still gets protection", () => {
    expect(fee({ priorQualityDrops: 1, outcome: stop("verified") }).ruleId).toBe("DROP_PROTECTED");
  });

  it("suspected bypass voids protection", () => {
    const r = fee({ bypass: "suspected", outcome: stop("verified") });
    expect(r.ruleId).toBe("BYPASS_SUSPECTED_VOID");
    expect(r.finalCommissionDueHkd).toBe(600);
  });
});

describe("resolveCaseFee — #508 ladder + floor", () => {
  it("tier 2 continues at 1.0×R and drops to 0.5×R", () => {
    expect(fee({ tier: 2, outcome: { kind: "continued" } }).finalCommissionDueHkd).toBe(600);
    expect(fee({ tier: 2, outcome: stop("verified") }).finalCommissionDueHkd).toBe(300);
  });

  it("tier 3 stays at the 0.5×R floor (never 0.25) and reports no protection", () => {
    const r = fee({ tier: 3, outcome: stop("verified") });
    expect(r.finalCommissionDueHkd).toBe(300);
    expect(r.protectionApplied).toBe(false);
  });

  it("tier 3 void never exceeds the tier base", () => {
    expect(fee({ tier: 3, outcome: stop("verified", "tutor_fault") }).finalCommissionDueHkd).toBe(
      300,
    );
  });

  it("4th+ inside the window is $0", () => {
    expect(fee({ tier: 4, outcome: { kind: "continued" } }).finalCommissionDueHkd).toBe(0);
  });

  it("day 181+ is $0 whatever happened", () => {
    const r = fee({ ownership: "closed", outcome: { kind: "continued" } });
    expect(r.ruleId).toBe("OWNERSHIP_EXPIRED");
    expect(r.finalCommissionDueHkd).toBe(0);
  });

  it("only continued cases advance the retained tier", () => {
    expect(fee({ outcome: { kind: "continued" } }).advancesRetainedTier).toBe(true);
    expect(fee({ outcome: stop("verified") }).advancesRetainedTier).toBe(false);
  });
});

describe("resolveCaseFee — #528 / #529 tutor-initiated stops", () => {
  it("tutor flake keeps 1.0×R + 30-day shadowban + strike + priority rematch", () => {
    const r = fee({ outcome: stop("none", "tutor_flake", "tutor") });
    expect(r.ruleId).toBe("TUTOR_FLAKE_VOID");
    expect(r.finalCommissionDueHkd).toBe(600);
    expect(r.consequences).toMatchObject({
      shadowbanTutorDays: SHADOWBAN_DAYS,
      strikeTutor: true,
      priorityRematch: true,
    });
  });

  it("never chases the extra 0.5 to force 1.5 on a flake", () => {
    expect(fee({ outcome: stop("verified", "tutor_flake", "tutor") }).multiplier).toBe(1.0);
  });

  it("verified hostile parent → tutor keeps 0.5×R, parent blacklisted, no tutor penalty", () => {
    const r = fee({ outcome: stop("verified", "hostile_parent", "tutor") });
    expect(r.ruleId).toBe("HOSTILE_PARENT_PROTECTED");
    expect(r.finalCommissionDueHkd).toBe(300);
    expect(r.consequences).toMatchObject({
      blacklistParent: true,
      shadowbanTutorDays: 0,
      strikeTutor: false,
    });
  });

  it("unverified hostile claim is treated as a flake", () => {
    expect(fee({ outcome: stop("pending", "hostile_parent", "tutor") }).ruleId).toBe(
      "TUTOR_FLAKE_VOID",
    );
  });

  it("emergency with proof → no shadowban, strike still counted", () => {
    const r = fee({ outcome: stop("verified", "tutor_emergency", "tutor") });
    expect(r.ruleId).toBe("TUTOR_EMERGENCY_VOID");
    expect(r.consequences).toMatchObject({ shadowbanTutorDays: 0, strikeTutor: true });
  });
});

describe("resolveCaseFee — split mode, scaling, pro-bono", () => {
  it("75_75: protection still lands at 0.5×R; void is the 0.75 L1 portion", () => {
    expect(fee({ splitMode: "75_75", outcome: stop("verified") }).finalCommissionDueHkd).toBe(300);
    expect(
      fee({ splitMode: "75_75", outcome: stop("verified", "tutor_fault") }).finalCommissionDueHkd,
    ).toBe(450);
  });

  it("scales by student count and rounds once", () => {
    const r = resolveCaseFee({ lessonValueHkd: 333, studentCount: 3, outcome: stop("verified") });
    expect(r.finalCommissionDueHkd).toBe(500);
  });

  it("pro-bono is always $0", () => {
    const r = fee({ packageType: "pro_bono", outcome: { kind: "continued" } });
    expect(r.finalCommissionDueHkd).toBe(0);
  });

  it("every rule has desk copy", () => {
    for (const label of Object.values(FEE_RULE_LABELS)) expect(label.length).toBeGreaterThan(0);
  });
});

describe("suggestOutcomeKind + buildOutcome", () => {
  const done = (sequence: number) => ({ sequence, status: "done" });

  it("suggests from the lesson rows", () => {
    expect(suggestOutcomeKind({ lessons: [done(1), done(2)], caseEnded: true })).toBe("continued");
    expect(suggestOutcomeKind({ lessons: [done(1)], caseEnded: true })).toBe("stopped_after_l1");
    expect(suggestOutcomeKind({ lessons: [done(1)], caseEnded: false })).toBe("in_progress");
    expect(
      suggestOutcomeKind({ lessons: [{ sequence: 1, status: "no_show" }], caseEnded: false }),
    ).toBe("l1_no_show");
    expect(suggestOutcomeKind({ lessons: [], caseEnded: true })).toBe("pre_l1_reject");
  });

  it("buildOutcome defaults an unverified stop to pending/vague/parent", () => {
    expect(buildOutcome({ kind: "stopped_after_l1" })).toEqual({
      kind: "stopped_after_l1",
      initiator: "parent",
      verification: "pending",
      reasonClass: "vague",
    });
    expect(buildOutcome({ kind: "continued", verification: "verified" })).toEqual({
      kind: "continued",
    });
  });
});

describe("dropRecordError (desk verification gate)", () => {
  const base = {
    kind: "stopped_after_l1" as const,
    initiator: "parent" as const,
    verification: "verified" as const,
    verifiedBy: "parent_wa" as const,
    proofNote: "Parent: lesson happened, timing did not suit",
    promoType: "standard" as const,
    discountPct: null,
  };

  it("accepts a parent-verified stop with pasted proof", () => {
    expect(dropRecordError(base)).toBeNull();
  });

  it("requires a source and a real proof note", () => {
    expect(dropRecordError({ ...base, verifiedBy: null })).toBe("VERIFIED_BY_REQUIRED");
    expect(dropRecordError({ ...base, proofNote: "ok" })).toBe("PROOF_NOTE_REQUIRED");
  });

  it("refuses admin evidence on a parent-reported stop (tutor word never reduces the fee)", () => {
    expect(dropRecordError({ ...base, verifiedBy: "admin_evidence" })).toBe(
      "CLIENT_CONFIRMATION_REQUIRED",
    );
    expect(
      dropRecordError({ ...base, initiator: "tutor", verifiedBy: "admin_evidence" }),
    ).toBeNull();
  });

  it("pending stops and other outcomes need no proof", () => {
    expect(dropRecordError({ ...base, verification: "pending", verifiedBy: null })).toBeNull();
    expect(dropRecordError({ ...base, kind: "continued", verifiedBy: null })).toBeNull();
  });

  it("a discounted first lesson needs its percentage", () => {
    expect(dropRecordError({ ...base, promoType: "discounted_first", discountPct: null })).toBe(
      "DISCOUNT_PCT_REQUIRED",
    );
  });
});

describe("trust counters (idempotent consequences)", () => {
  it("counts only from the resolved rule", () => {
    expect(trustCountersFor("VERIFICATION_PENDING")).toEqual({
      strikes: 0,
      tutorDrops: 0,
      qualityDrops: 0,
      shadowbanDays: 0,
    });
    expect(trustCountersFor("HOSTILE_PARENT_PROTECTED").tutorDrops).toBe(0);
    expect(trustCountersFor("TUTOR_FAULT_VOID").qualityDrops).toBe(1);
  });

  it("re-saving the same rule is a zero delta", () => {
    expect(trustCounterDelta("TUTOR_FLAKE_VOID", "TUTOR_FLAKE_VOID")).toMatchObject({
      strikes: 0,
      tutorDrops: 0,
      shadowban: "keep",
    });
  });

  it("pending → tutor fault counts the quality drop once", () => {
    expect(trustCounterDelta(null, "VERIFICATION_PENDING").qualityDrops).toBe(0);
    expect(trustCounterDelta("VERIFICATION_PENDING", "TUTOR_FAULT_VOID").qualityDrops).toBe(1);
  });

  it("correcting a flake to an emergency keeps one strike and clears the shadowban", () => {
    expect(trustCounterDelta("TUTOR_FLAKE_VOID", "TUTOR_EMERGENCY_VOID")).toMatchObject({
      strikes: 0,
      tutorDrops: 0,
      shadowban: "clear",
    });
  });

  it("a hostile parent wins over the repeat-pattern rule", () => {
    const r = fee({ priorQualityDrops: 3, outcome: stop("verified", "hostile_parent") });
    expect(r.ruleId).toBe("HOSTILE_PARENT_PROTECTED");
  });
});

describe("normalizers", () => {
  it("fall back to safe defaults for junk", () => {
    expect(normalizePromoType("free_online_trial")).toBe("free_online_trial");
    expect(normalizePromoType("bogus")).toBe("standard");
    expect(normalizeSplitMode(null)).toBe("100_50");
    expect(normalizeBypassFlag(undefined)).toBe("none");
    expect(normalizeDropVerification("verified")).toBe("verified");
    expect(normalizeDropVerification(42)).toBe("none");
  });
});
